const db = require('../config/database');
const { uploads, deleteFile } = require('../utils/upload');
const reports = require('../utils/reports');

const sefController = {
    uploadMulter: uploads.task.fields([
        { name: 'task_file', maxCount: 10 }
    ]),

    // ── Dashboard ────────────────────────────────────────────────
    dashboard: (req, res) => {
        try {
            const sefId = req.session.user.id;

            const myTasks = db.prepare(`
                SELECT t.*,
                    COUNT(ta.id) as total_assignments,
                    SUM(CASE WHEN ta.status = 'completed' THEN 1 ELSE 0 END) as completed_assignments
                FROM tasks t
                LEFT JOIN task_assignments ta ON ta.task_id = t.id
                WHERE t.created_by = ?
                GROUP BY t.id
                ORDER BY t.created_at DESC
            `).all(sefId);

            const totalTasks = myTasks.length;
            const activeTasks = myTasks.filter(t => new Date(t.deadline) >= new Date()).length;
            const totalAssignments = myTasks.reduce((s, t) => s + (t.total_assignments || 0), 0);
            const completedAssignments = myTasks.reduce((s, t) => s + (t.completed_assignments || 0), 0);
            const successRate = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

            res.render('sef/dashboard', {
                title: 'Şef Paneli',
                activePage: 'dashboard',
                myTasks: myTasks.slice(0, 5),
                totalTasks,
                activeTasks,
                totalAssignments,
                completedAssignments,
                successRate
            });
        } catch (error) {
            console.error('Şef dashboard hatası:', error);
            res.status(500).send('Bir hata oluştu');
        }
    },

    // ── Görev Listesi ────────────────────────────────────────────
    taskList: (req, res) => {
        try {
            const sefId = req.session.user.id;

            const tasks = db.prepare(`
                SELECT t.*,
                    COUNT(ta.id) as total_assignments,
                    SUM(CASE WHEN ta.status = 'completed' THEN 1 ELSE 0 END) as completed_assignments,
                    CASE WHEN COUNT(ta.id) > 0 
                         THEN ROUND(SUM(CASE WHEN ta.status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(ta.id))
                         ELSE 0 END as completion_rate
                FROM tasks t
                LEFT JOIN task_assignments ta ON ta.task_id = t.id
                WHERE t.created_by = ?
                GROUP BY t.id
                ORDER BY t.created_at DESC
            `).all(sefId);

            const schoolTypes = db.prepare(`
                SELECT DISTINCT school_type FROM users WHERE role = 'school' AND school_type IS NOT NULL
            `).all().map(r => r.school_type);

            const schools = db.prepare(`SELECT id, full_name, school_type, has_canteen, has_pension FROM users WHERE role = 'school' ORDER BY full_name ASC`).all();

            const csrf = require('csurf');
            res.render('sef/tasks', {
                title: 'Görevlerim',
                activePage: 'tasks',
                tasks,
                schools,
                schoolTypes,
                csrfToken: req.csrfToken ? req.csrfToken() : ''
            });
        } catch (error) {
            console.error('Şef görev listesi hatası:', error);
            res.status(500).send('Bir hata oluştu');
        }
    },

    // ── Yeni Görev Oluştur (POST) ─────────────────────────────────
    store: (req, res) => {
        try {
            const sefId = req.session.user.id;
            const { title, description, deadline, ebys_no, requires_file, is_file_mandatory, max_file_count, school_ids } = req.body;

            if (!title || !deadline) {
                return res.redirect('/sef/tasks?error=missing_fields');
            }

            // Görevi kaydet
            const result = db.prepare(`
                INSERT INTO tasks (title, description, deadline, requires_file, is_file_mandatory, max_file_count, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                title,
                description || '',
                deadline,
                requires_file ? 1 : 0,
                is_file_mandatory ? 1 : 0,
                parseInt(max_file_count) || 1,
                sefId
            );

            const taskId = result.lastInsertRowid;

            // Ek dosyaları kaydet
            if (req.files && req.files.task_file) {
                req.files.task_file.forEach(file => {
                    db.prepare(`
                        INSERT INTO task_attachments (task_id, file_path, original_name, file_size)
                        VALUES (?, ?, ?, ?)
                    `).run(taskId, file.filename, file.originalname, file.size);
                });
            }

            // Form alanlarını kaydet
            let fields = [];
            try { fields = JSON.parse(req.body.fields_json || '[]'); } catch(e) {}
            fields.forEach((field, idx) => {
                db.prepare(`
                    INSERT INTO task_fields (task_id, field_type, field_label, field_options, is_required, field_order)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(taskId, field.type, field.label, JSON.stringify(field.options || []), field.required ? 1 : 0, idx);
            });

            // Okullara ata
            const ids = Array.isArray(school_ids) ? school_ids : (school_ids ? [school_ids] : []);
            ids.forEach(schoolId => {
                db.prepare(`
                    INSERT OR IGNORE INTO task_assignments (task_id, user_id, status)
                    VALUES (?, ?, 'pending')
                `).run(taskId, parseInt(schoolId));
            });

            res.redirect(`/sef/tasks/${taskId}?success=created`);
        } catch (error) {
            console.error('Şef görev oluşturma hatası:', error);
            res.redirect('/sef/tasks?error=create_failed');
        }
    },

    // ── Görev Detay ──────────────────────────────────────────────
    detail: (req, res) => {
        try {
            const sefId = req.session.user.id;
            const taskId = req.params.id;

            // Sadece kendi görevi mi?
            const task = db.prepare(`SELECT * FROM tasks WHERE id = ? AND created_by = ?`).get(taskId, sefId);
            if (!task) return res.status(403).render('404', { title: 'Erişim Yok' });

            // Atamalar
            const assignments = db.prepare(`
                SELECT ta.*, u.full_name, u.username, u.school_type,
                    (SELECT COUNT(*) FROM task_messages WHERE assignment_id = ta.id AND is_read = 0 AND sender_id != ?) as unread_count
                FROM task_assignments ta
                JOIN users u ON ta.user_id = u.id
                WHERE ta.task_id = ?
                ORDER BY ta.status ASC, u.full_name ASC
            `).all(sefId, taskId);

            // Form alanları
            const taskFields = db.prepare(`SELECT * FROM task_fields WHERE task_id = ? ORDER BY field_order ASC`).all(taskId);

            // Her atama için form yanıtları
            const assignmentsWithResponses = assignments.map(a => {
                const fieldResponses = db.prepare(`
                    SELECT tfr.*, tf.field_label, tf.field_type
                    FROM task_field_responses tfr
                    JOIN task_fields tf ON tfr.field_id = tf.id
                    WHERE tfr.assignment_id = ?
                `).all(a.id);

                const files = db.prepare(`SELECT * FROM task_assignment_files WHERE assignment_id = ?`).all(a.id);
                const messages = db.prepare(`SELECT * FROM task_messages WHERE assignment_id = ? ORDER BY created_at ASC`).all(a.id);

                return { ...a, fieldResponses, files, messages };
            });

            // Ek dosyalar (yönetici tarafından yüklenen)
            const taskAttachments = db.prepare(`SELECT * FROM task_attachments WHERE task_id = ?`).all(taskId);

            // Mesajlar map
            const messagesMap = {};
            assignmentsWithResponses.forEach(a => {
                messagesMap[a.id] = a.messages || [];
            });

            res.render('sef/task_detail', {
                title: task.title,
                activePage: 'tasks',
                task,
                assignments: assignmentsWithResponses,
                taskFields,
                taskAttachments,
                messagesMapJSON: JSON.stringify(messagesMap),
                assignmentsJSON: JSON.stringify(assignmentsWithResponses),
                csrfToken: req.csrfToken ? req.csrfToken() : '',
                status: req.query.status || null
            });
        } catch (error) {
            console.error('Şef görev detay hatası:', error);
            res.status(500).send('Bir hata oluştu');
        }
    },

    // ── Mesaj Gönder ─────────────────────────────────────────────
    sendMessage: (req, res) => {
        try {
            const sefId = req.session.user.id;
            const { assignmentId } = req.params;
            const { message } = req.body;

            // Assignment şefe ait mi?
            const assignment = db.prepare(`
                SELECT ta.* FROM task_assignments ta
                JOIN tasks t ON ta.task_id = t.id
                WHERE ta.id = ? AND t.created_by = ?
            `).get(assignmentId, sefId);

            if (!assignment) return res.status(403).json({ error: 'Erişim yok' });

            db.prepare(`
                INSERT INTO task_messages (assignment_id, sender_id, message)
                VALUES (?, ?, ?)
            `).run(assignmentId, sefId, message);

            res.json({ success: true });
        } catch (error) {
            console.error('Şef mesaj hatası:', error);
            res.status(500).json({ error: 'Bir hata oluştu' });
        }
    },

    // ── Rapor İndir (Excel) ──────────────────────────────────────
    downloadReport: async (req, res) => {
        try {
            const sefId = req.session.user.id;
            const taskId = req.params.id;

            // Görev şefe ait mi?
            const task = db.prepare(`SELECT * FROM tasks WHERE id = ? AND created_by = ?`).get(taskId, sefId);
            if (!task) return res.status(403).send('Erişim yok');

            const result = await reports.generateTaskDetailExcel(taskId);
            if (result) {
                res.download(result.filePath, result.fileName);
            } else {
                res.redirect(`/sef/tasks/${taskId}?error=report_failed`);
            }
        } catch (error) {
            console.error('Şef rapor hatası:', error);
            res.redirect('/sef/tasks?error=report_failed');
        }
    },

    // ── Profil ───────────────────────────────────────────────────
    profile: (req, res) => {
        try {
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
            const logs = db.prepare(`
                SELECT * FROM logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10
            `).all(req.session.user.id);

            res.render('sef/profile', {
                title: 'Profilim',
                activePage: 'profile',
                user,
                logs,
                status: req.query.status || null
            });
        } catch (error) {
            console.error('Şef profil hatası:', error);
            res.redirect('/sef/dashboard');
        }
    },

    // ── Şifre Değiştir ───────────────────────────────────────────
    changePassword: (req, res) => {
        try {
            const userId = req.session.user.id;
            const { current_password, new_password, confirm_password } = req.body;
            const bcrypt = require('bcryptjs');

            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
            if (!user) return res.redirect('/sef/profile?status=error');

            const passwordValid = bcrypt.compareSync(current_password, user.password);
            if (!passwordValid) return res.redirect('/sef/profile?status=wrong_password');
            if (new_password !== confirm_password) return res.redirect('/sef/profile?status=mismatch');
            if (new_password.length < 6) return res.redirect('/sef/profile?status=too_short');

            const hashedPassword = bcrypt.hashSync(new_password, 10);
            db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, userId);

            res.redirect('/sef/profile?status=password_changed');
        } catch (error) {
            console.error('Şef şifre değiştirme hatası:', error);
            res.redirect('/sef/profile?status=error');
        }
    }
};

module.exports = sefController;
