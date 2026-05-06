const db = require('../config/database');
const { uploads, deleteFile } = require('../utils/upload');
const reports = require('../utils/reports');
const { sendPushNotification } = require('../utils/push');

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
            const fieldTypes = req.body.field_types || [];
            const fieldLabels = req.body.field_labels || [];
            const fieldOptions = req.body.field_options || [];
            const fieldRequired = req.body.field_required || [];

            if (fieldTypes && fieldLabels) {
                const typesArr = Array.isArray(fieldTypes) ? fieldTypes : [fieldTypes];
                const labelsArr = Array.isArray(fieldLabels) ? fieldLabels : [fieldLabels];
                const optionsArr = Array.isArray(fieldOptions) ? fieldOptions : [fieldOptions];
                const requiredArr = Array.isArray(fieldRequired) ? fieldRequired : [fieldRequired];

                const fieldStmt = db.prepare(`
                    INSERT INTO task_fields
                        (task_id, field_type, field_label, field_options, is_required, field_order)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

                typesArr.forEach((type, i) => {
                    if (labelsArr[i] && labelsArr[i].trim()) {
                        const options = optionsArr[i] || '';
                        const isRequired = requiredArr.includes(i.toString()) ? 1 : 0;
                        fieldStmt.run(taskId, type, labelsArr[i], options, isRequired, i);
                    }
                });
            }

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

    // ── Görev Detay (Admin seviyesi) ────────────────────────────
    detail: (req, res) => {
        try {
            const sefId = req.session.user.id;
            const taskId = req.params.id;

            const task = db.prepare(`SELECT t.*, u.full_name AS creator_name, u.role AS creator_role FROM tasks t LEFT JOIN users u ON t.created_by = u.id WHERE t.id = ? AND t.created_by = ?`).get(taskId, sefId);
            if (!task) return res.status(403).render('404', { title: 'Erişim Yok' });

            const taskAttachments = db.prepare('SELECT * FROM task_attachments WHERE task_id = ? ORDER BY created_at ASC').all(taskId);

            const assignments = db.prepare(`
                SELECT ta.*, u.full_name, u.username
                FROM task_assignments ta
                JOIN users u ON ta.user_id = u.id
                WHERE ta.task_id = ?
                ORDER BY ta.status DESC, ta.is_read DESC
            `).all(taskId);

            const total = assignments.length;
            let readCount = 0, completedCount = 0, pendingApprovalCount = 0;
            assignments.forEach(a => {
                if (a.is_read) readCount++;
                if (a.status === 'completed') completedCount++;
                if (a.status === 'pending_approval') pendingApprovalCount++;
            });

            const taskFields = db.prepare('SELECT * FROM task_fields WHERE task_id = ? ORDER BY field_order ASC').all(taskId);

            const allResponses = db.prepare(`
                SELECT tfr.*, tf.field_label, tf.field_type
                FROM task_field_responses tfr
                JOIN task_fields tf ON tfr.field_id = tf.id
                WHERE tf.task_id = ?
            `).all(taskId);

            const allFiles = db.prepare(`
                SELECT taf.* FROM task_assignment_files taf
                JOIN task_assignments ta ON taf.assignment_id = ta.id
                WHERE ta.task_id = ?
            `).all(taskId);

            const responsesMap = {}, filesMap = {};
            allResponses.forEach(r => {
                if (!responsesMap[r.assignment_id]) responsesMap[r.assignment_id] = [];
                responsesMap[r.assignment_id].push(r);
            });
            allFiles.forEach(f => {
                if (!filesMap[f.assignment_id]) filesMap[f.assignment_id] = [];
                filesMap[f.assignment_id].push(f);
            });

            const assignmentsWithResponses = assignments.map(a => ({
                ...a,
                fieldResponses: responsesMap[a.id] || [],
                files: filesMap[a.id] || []
            }));

            const allMessages = db.prepare(`
                SELECT tm.*, u.full_name, u.role
                FROM task_messages tm
                JOIN users u ON tm.sender_id = u.id
                WHERE tm.assignment_id IN (SELECT id FROM task_assignments WHERE task_id = ?)
                ORDER BY tm.created_at ASC
            `).all(taskId);

            db.prepare(`
                UPDATE task_messages SET is_read = 1
                WHERE assignment_id IN (SELECT id FROM task_assignments WHERE task_id = ?)
                  AND sender_id IN (SELECT user_id FROM task_assignments WHERE id = task_messages.assignment_id)
                  AND is_read = 0
            `).run(taskId);

            const messagesMap = {};
            allMessages.forEach(msg => {
                if (!messagesMap[msg.assignment_id]) messagesMap[msg.assignment_id] = [];
                messagesMap[msg.assignment_id].push(msg);
            });

            res.render('sef/task_detail', {
                title: 'Görev Takibi',
                activePage: 'tasks',
                task,
                taskAttachments,
                assignments: assignmentsWithResponses,
                taskFields,
                total,
                readCount,
                completedCount,
                pendingApprovalCount,
                messagesMap,
                currentUserId: sefId,
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

    // ── Görev Onayla ─────────────────────────────────────────────
    approveAssignment: async (req, res) => {
        try {
            const sefId = req.session.user.id;
            const { taskId, assignmentId } = req.params;
            const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND created_by = ?').get(taskId, sefId);
            if (!task) return res.status(403).send('Erişim yok');

            const assignment = db.prepare('SELECT * FROM task_assignments WHERE id = ? AND task_id = ?').get(assignmentId, taskId);
            if (!assignment) return res.redirect(`/sef/tasks/${taskId}?error=not_found`);

            const now = new Date().toISOString();
            db.prepare(`UPDATE task_assignments SET status = 'completed', completed_at = ?, rejection_note = NULL WHERE id = ?`).run(now, assignmentId);

            await sendPushNotification(assignment.user_id, {
                title: '✅ Göreviniz Onaylandı',
                body: `"${task.title}" başlıklı göreviniz onaylandı.`,
                url: `/okul/tasks/${assignmentId}`,
                tag: 'approved-' + assignmentId
            });

            res.redirect(`/sef/tasks/${taskId}?status=approved`);
        } catch (error) {
            console.error('Şef onay hatası:', error);
            res.redirect(`/sef/tasks/${req.params.taskId}?error=1`);
        }
    },

    // ── Görev İade Et (Reject) ───────────────────────────────────
    rejectAssignment: async (req, res) => {
        try {
            const sefId = req.session.user.id;
            const { taskId, assignmentId } = req.params;
            const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND created_by = ?').get(taskId, sefId);
            if (!task) return res.status(403).send('Erişim yok');

            const assignment = db.prepare('SELECT * FROM task_assignments WHERE id = ? AND task_id = ?').get(assignmentId, taskId);
            if (!assignment) return res.redirect(`/sef/tasks/${taskId}?error=not_found`);

            const note = req.body.rejection_note || 'Eksik veya hatalı gönderim.';
            db.prepare(`UPDATE task_assignments SET status = 'rejected', rejection_note = ? WHERE id = ?`).run(note, assignmentId);

            await sendPushNotification(assignment.user_id, {
                title: '⚠️ Göreviniz İade Edildi',
                body: `"${task.title}" başlıklı göreviniz iade edildi. Not: ${note}`,
                url: `/okul/tasks/${assignmentId}`,
                tag: 'rejected-' + assignmentId
            });

            res.redirect(`/sef/tasks/${taskId}?status=rejected`);
        } catch (error) {
            console.error('Şef iade hatası:', error);
            res.redirect(`/sef/tasks/${req.params.taskId}?error=1`);
        }
    },

    // ── Toplu Onay ───────────────────────────────────────────────
    approveBulk: async (req, res) => {
        try {
            const sefId = req.session.user.id;
            const { taskId } = req.params;
            const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND created_by = ?').get(taskId, sefId);
            if (!task) return res.status(403).send('Erişim yok');

            let { assignmentIds } = req.body;
            if (!assignmentIds) return res.redirect(`/sef/tasks/${taskId}?error=1`);
            if (!Array.isArray(assignmentIds)) assignmentIds = [assignmentIds];
            if (assignmentIds.length === 0) return res.redirect(`/sef/tasks/${taskId}?error=1`);

            const placeholders = assignmentIds.map(() => '?').join(',');
            db.prepare(`UPDATE task_assignments SET status = 'completed' WHERE task_id = ? AND status = 'pending_approval' AND id IN (${placeholders})`).run(taskId, ...assignmentIds);

            assignmentIds.forEach(id => {
                const ta = db.prepare('SELECT user_id FROM task_assignments WHERE id = ?').get(id);
                if (ta) {
                    sendPushNotification(ta.user_id, {
                        title: '✅ Görev Onaylandı',
                        body: `'${task.title}' görevi için gönderdiğiniz yanıt onaylandı.`,
                        url: `/okul/tasks/${taskId}`
                    }).catch(e => console.error('Push error:', e.message));
                }
            });

            res.redirect(`/sef/tasks/${taskId}?success=1`);
        } catch (error) {
            console.error('Şef toplu onay hatası:', error);
            res.redirect(`/sef/tasks/${req.params.taskId}?error=1`);
        }
    },

    // ── Yanıt Dosyası İndir ──────────────────────────────────────
    downloadResponseFile: (req, res) => {
        try {
            const sefId = req.session.user.id;
            const { assignmentId } = req.params;
            const assignment = db.prepare(`
                SELECT ta.response_file, u.full_name AS school_name, t.title AS task_title
                FROM task_assignments ta
                JOIN users u ON ta.user_id = u.id
                JOIN tasks t ON ta.task_id = t.id
                WHERE ta.id = ? AND t.created_by = ?
            `).get(assignmentId, sefId);

            if (!assignment || !assignment.response_file) return res.status(404).send('Dosya bulunamadı.');

            const path = require('path');
            const fs = require('fs');
            const { sanitizeFilename } = require('../utils/upload');
            const filePath = path.join(__dirname, '..', 'public', 'uploads', 'responses', assignment.response_file);
            if (!fs.existsSync(filePath)) return res.status(404).send('Dosya sunucuda bulunamadı.');

            const ext = path.extname(assignment.response_file);
            const downloadName = `${sanitizeFilename(assignment.school_name)}_${sanitizeFilename(assignment.task_title)}${ext}`;
            res.download(filePath, downloadName);
        } catch (error) {
            console.error('Şef dosya indirme hatası:', error);
            res.status(500).send('Dosya indirilirken bir hata oluştu.');
        }
    },

    // ── Mesaj Gönder (Admin seviyesi) ────────────────────────────
    sendAdminMessage: async (req, res) => {
        try {
            const sefId = req.session.user.id;
            const { assignmentId } = req.params;
            const { message, task_id } = req.body;

            const check = db.prepare(`
                SELECT ta.id FROM task_assignments ta
                JOIN tasks t ON ta.task_id = t.id
                WHERE ta.id = ? AND t.created_by = ?
            `).get(assignmentId, sefId);
            if (!check) return res.status(403).json({ error: 'Erişim yok' });

            if (!message || !message.trim()) return res.redirect(`/sef/tasks/${task_id}?error=empty_message`);

            db.prepare('INSERT INTO task_messages (assignment_id, sender_id, message) VALUES (?, ?, ?)').run(assignmentId, sefId, message.trim());

            const info = db.prepare(`
                SELECT ta.user_id, t.title AS task_title
                FROM task_assignments ta JOIN tasks t ON ta.task_id = t.id WHERE ta.id = ?
            `).get(assignmentId);

            if (info) {
                const preview = message.trim().length > 50 ? message.trim().substring(0, 50) + '...' : message.trim();
                try {
                    await sendPushNotification(info.user_id, {
                        title: `💬 Yeni Mesaj: ${info.task_title || 'Görev'}`,
                        body: preview,
                        url: `/okul/tasks/${assignmentId}`,
                        tag: 'message-' + assignmentId + '-' + Date.now()
                    });
                } catch (pushErr) { console.error('Push bildirim hatası:', pushErr); }
            }

            res.redirect(`/sef/tasks/${task_id}`);
        } catch (error) {
            console.error('Şef mesaj hatası:', error);
            res.redirect(req.headers.referer || '/sef/tasks');
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
