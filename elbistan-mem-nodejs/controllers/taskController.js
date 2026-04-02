const db = require('../config/database');
const { uploads, deleteFile } = require('../utils/upload');
const { sendPushNotification } = require('../utils/push');

const taskController = {
    uploadMulter: uploads.task.single('task_file'),

    /* ─────────────────────────────────────
       Görev Listesi
    ───────────────────────────────────── */
    index: (req, res) => {
        try {
            const tasks = db.prepare(`
                SELECT t.*,
                       COUNT(ta.id) as total_assignments,
                       SUM(CASE WHEN ta.status = 'completed' THEN 1 ELSE 0 END) as completed_assignments
                FROM tasks t
                LEFT JOIN task_assignments ta ON t.id = ta.task_id
                GROUP BY t.id
                ORDER BY t.id DESC
            `).all();

            const schools = db.prepare(
                "SELECT * FROM users WHERE role = 'school' ORDER BY full_name ASC"
            ).all();

            // Tamamlanma oranını hesapla
            tasks.forEach(t => {
                t.completion_rate = t.total_assignments > 0
                    ? Math.round((t.completed_assignments / t.total_assignments) * 100)
                    : 0;
            });

            // Okul türlerini al (hızlı seçim butonları için)
            const schoolTypes = db.prepare(
                "SELECT DISTINCT school_type FROM users WHERE role = 'school' AND school_type IS NOT NULL ORDER BY school_type ASC"
            ).all().map(r => r.school_type);

            res.render('admin/tasks', {
                title: 'Görev Yönetimi',
                activePage: 'tasks',
                tasks,
                schools,
                schoolTypes,
                status: req.query.status || null
            });
        } catch (error) {
            console.error('Görev listesi hatası:', error);
            res.status(500).send('Bir hata oluştu');
        }
    },

    /* ─────────────────────────────────────
       Görev Ekle
    ───────────────────────────────────── */
    store: async (req, res) => {
        try {
            const { title, description, deadline, school_ids } = req.body;
            const requiresFile    = req.body.requires_file    ? 1 : 0;
            const isFileMandatory = req.body.is_file_mandatory ? 1 : 0;
            const filePath        = req.file ? req.file.filename : null;
            const allowedFileTypes = req.body.allowed_file_types || '';
            const maxFileCount     = req.body.max_file_count || 1;

            // Form alanları
            const fieldTypes   = req.body.field_types   || [];
            const fieldLabels  = req.body.field_labels  || [];
            const fieldOptions = req.body.field_options || [];
            const fieldRequired = req.body.field_required || [];

            // Görevi ekle
            const result = db.prepare(`
                INSERT INTO tasks
                    (title, description, deadline, file_path, requires_file,
                     is_file_mandatory, allowed_file_types, max_file_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(title, description, deadline, filePath,
                   requiresFile, isFileMandatory, allowedFileTypes, maxFileCount);

            const taskId = result.lastInsertRowid;

            // Form alanlarını kaydet
            if (fieldTypes && fieldLabels) {
                const typesArr    = Array.isArray(fieldTypes)    ? fieldTypes    : [fieldTypes];
                const labelsArr   = Array.isArray(fieldLabels)   ? fieldLabels   : [fieldLabels];
                const optionsArr  = Array.isArray(fieldOptions)  ? fieldOptions  : [fieldOptions];
                const requiredArr = Array.isArray(fieldRequired) ? fieldRequired : [fieldRequired];

                const fieldStmt = db.prepare(`
                    INSERT INTO task_fields
                        (task_id, field_type, field_label, field_options, is_required, field_order)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

                typesArr.forEach((type, i) => {
                    if (labelsArr[i] && labelsArr[i].trim()) {
                        const options    = optionsArr[i] || '';
                        const isRequired = requiredArr.includes(i.toString()) ? 1 : 0;
                        fieldStmt.run(taskId, type, labelsArr[i], options, isRequired, i);
                    }
                });
            }

            // Okullara ata + bildirim gönder
            if (school_ids && school_ids.length > 0) {
                const schoolIdsArray = Array.isArray(school_ids) ? school_ids : [school_ids];
                const stmt = db.prepare(
                    'INSERT INTO task_assignments (task_id, user_id, status) VALUES (?, ?, ?)'
                );

                for (const schoolId of schoolIdsArray) {
                    stmt.run(taskId, schoolId, 'pending');
                    await sendPushNotification(schoolId, {
                        title: '📋 Yeni Bir Görev Atandı',
                        body:  `"${title}" başlıklı yeni bir görev hesabınıza tanımlanmıştır. Lütfen giriş yapıp kontrol ediniz.`,
                        url:   '/okul/dashboard',
                        tag:   'task-new-' + taskId
                    });
                }
            }

            res.redirect('/admin/tasks?status=success');
        } catch (error) {
            console.error('CRITICAL ERROR in taskController.store:', error);
            res.status(500).render('404', {
                title:   'Hata',
                message: 'Görev eklenirken bir hata oluştu: ' + error.message
            });
        }
    },

    /* ─────────────────────────────────────
       Görev Detay (Admin görünümü)
    ───────────────────────────────────── */
    detail: (req, res) => {
        try {
            const { id } = req.params;

            const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
            if (!task) return res.status(404).send('Görev bulunamadı');

            // Atamalar (okul bilgileriyle)
            const assignments = db.prepare(`
                SELECT ta.*, u.full_name, u.username
                FROM task_assignments ta
                JOIN users u ON ta.user_id = u.id
                WHERE ta.task_id = ?
                ORDER BY ta.status DESC, ta.is_read DESC
            `).all(id);

            // İstatistikler
            const total = assignments.length;
            let readCount = 0, completedCount = 0, pendingApprovalCount = 0;
            assignments.forEach(a => {
                if (a.is_read)                        readCount++;
                if (a.status === 'completed')         completedCount++;
                if (a.status === 'pending_approval')  pendingApprovalCount++;
            });

            // Form alanları
            const taskFields = db.prepare(
                'SELECT * FROM task_fields WHERE task_id = ? ORDER BY field_order ASC'
            ).all(id);

            // Her atama için form cevapları + dosyalar
            const assignmentsWithResponses = assignments.map(assignment => {
                const responses = db.prepare(`
                    SELECT tfr.*, tf.field_label, tf.field_type
                    FROM task_field_responses tfr
                    JOIN task_fields tf ON tfr.field_id = tf.id
                    WHERE tfr.assignment_id = ?
                `).all(assignment.id);

                const files = db.prepare(
                    'SELECT * FROM task_assignment_files WHERE assignment_id = ?'
                ).all(assignment.id);

                return { ...assignment, fieldResponses: responses, files };
            });

            // Tüm mesajları getir ve okul mesajlarını okundu yap
            const allMessages = db.prepare(`
                SELECT tm.*, u.full_name, u.role
                FROM task_messages tm
                JOIN users u ON tm.sender_id = u.id
                WHERE tm.assignment_id IN (
                    SELECT id FROM task_assignments WHERE task_id = ?
                )
                ORDER BY tm.created_at ASC
            `).all(id);

            db.prepare(`
                UPDATE task_messages
                SET is_read = 1
                WHERE assignment_id IN (SELECT id FROM task_assignments WHERE task_id = ?)
                  AND sender_id IN (
                      SELECT user_id FROM task_assignments
                      WHERE id = task_messages.assignment_id
                  )
                  AND is_read = 0
            `).run(id);

            const messagesMap = {};
            allMessages.forEach(msg => {
                if (!messagesMap[msg.assignment_id]) messagesMap[msg.assignment_id] = [];
                messagesMap[msg.assignment_id].push(msg);
            });

            res.render('admin/task_detail', {
                title:               'Görev Takibi',
                activePage:          'tasks',
                task,
                assignments:         assignmentsWithResponses,
                taskFields,
                total,
                readCount,
                completedCount,
                pendingApprovalCount,
                messagesMap,
                currentUserId:       req.session.user.id
            });
        } catch (error) {
            console.error('Görev detay hatası:', error);
            res.status(500).send('Bir hata oluştu');
        }
    },

    /* ─────────────────────────────────────
       Görev Sil
    ───────────────────────────────────── */
    delete: (req, res) => {
        try {
            const { id } = req.params;
            const task = db.prepare('SELECT file_path FROM tasks WHERE id = ?').get(id);
            if (task && task.file_path) deleteFile('tasks', task.file_path);
            db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
            res.redirect('/admin/tasks?status=deleted');
        } catch (error) {
            console.error('Görev silme hatası:', error);
            res.redirect('/admin/tasks?status=error');
        }
    },

    /* ─────────────────────────────────────
       Görev Düzenle – Form
    ───────────────────────────────────── */
    edit: (req, res) => {
        try {
            const { id } = req.params;

            const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
            if (!task) return res.redirect('/admin/tasks?status=not_found');

            const schools = db.prepare(
                "SELECT * FROM users WHERE role = 'school' ORDER BY full_name ASC"
            ).all();

            const assignedSchools = db.prepare(`
                SELECT ta.user_id, u.full_name, u.username
                FROM task_assignments ta
                JOIN users u ON ta.user_id = u.id
                WHERE ta.task_id = ?
                ORDER BY u.full_name ASC
            `).all(id);

            const assignedIds = assignedSchools.map(a => a.user_id);
            const assignedSchoolDetails = assignedSchools.map(a => ({
                id:        a.user_id,
                full_name: a.full_name,
                username:  a.username
            }));

            const taskFields = db.prepare(
                'SELECT * FROM task_fields WHERE task_id = ? ORDER BY field_order ASC'
            ).all(id);

            // Okul türlerini al (hızlı seçim butonları için)
            const schoolTypes = db.prepare(
                "SELECT DISTINCT school_type FROM users WHERE role = 'school' AND school_type IS NOT NULL ORDER BY school_type ASC"
            ).all().map(r => r.school_type);

            res.render('admin/task_edit', {
                title:               'Görev Düzenle',
                activePage:          'tasks',
                task,
                schools,
                assignedIds,
                assignedSchoolDetails,
                taskFields,
                schoolTypes,
                status: req.query.status || null
            });
        } catch (error) {
            console.error('Görev düzenleme hatası:', error);
            res.redirect('/admin/tasks?status=error');
        }
    },

    /* ─────────────────────────────────────
       Görev Güncelle
    ───────────────────────────────────── */
    update: async (req, res) => {
        try {
            const { id } = req.params;
            const { title, description, deadline, school_ids } = req.body;
            const requiresFile    = req.body.requires_file    ? 1 : 0;
            const isFileMandatory = req.body.is_file_mandatory ? 1 : 0;
            const allowedFileTypes = req.body.allowed_file_types || '';
            const maxFileCount     = req.body.max_file_count || 1;

            const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
            if (!task) return res.redirect('/admin/tasks?status=not_found');

            // Yeni dosya varsa eskiyi sil
            let filePath = task.file_path;
            if (req.file) {
                if (task.file_path) deleteFile('tasks', task.file_path);
                filePath = req.file.filename;
            }

            // Görevi güncelle
            db.prepare(`
                UPDATE tasks
                SET title = ?, description = ?, deadline = ?, file_path = ?,
                    requires_file = ?, is_file_mandatory = ?,
                    allowed_file_types = ?, max_file_count = ?
                WHERE id = ?
            `).run(title, description, deadline, filePath,
                   requiresFile, isFileMandatory, allowedFileTypes, maxFileCount, id);

            // Kaldırılacak okullar
            const remove_school_ids = req.body.remove_school_ids;
            if (remove_school_ids) {
                const removeArr = Array.isArray(remove_school_ids) ? remove_school_ids : [remove_school_ids];
                const deleteStmt = db.prepare(
                    'DELETE FROM task_assignments WHERE task_id = ? AND user_id = ?'
                );
                removeArr.forEach(schoolId => deleteStmt.run(id, schoolId));
            }

            // Yeni okul atamaları
            if (school_ids) {
                const schoolIdsArray = Array.isArray(school_ids) ? school_ids : [school_ids];
                const current = db.prepare(
                    'SELECT user_id FROM task_assignments WHERE task_id = ?'
                ).all(id);
                const currentIds = current.map(a => a.user_id.toString());
                const toAdd = schoolIdsArray.filter(sid => !currentIds.includes(sid.toString()));

                const insertStmt = db.prepare(
                    'INSERT INTO task_assignments (task_id, user_id, status) VALUES (?, ?, ?)'
                );
                for (const schoolId of toAdd) {
                    insertStmt.run(id, schoolId, 'pending');
                    await sendPushNotification(schoolId, {
                        title: '📋 Yeni Bir Görev Atandı',
                        body:  `Daha önceden oluşturulmuş "${title}" başlıklı görev hesabınıza tanımlanmıştır.`,
                        url:   '/okul/dashboard',
                        tag:   'task-assign-' + id + '-' + schoolId
                    });
                }
            }

            // Form alanları
            const fieldIds      = req.body.field_ids      || [];
            const fieldTypes    = req.body.field_types    || [];
            const fieldLabels   = req.body.field_labels   || [];
            const fieldOptions  = req.body.field_options  || [];
            const fieldRequired = req.body.field_required || [];

            if (fieldTypes && fieldLabels) {
                const idsArr      = Array.isArray(fieldIds)      ? fieldIds      : [fieldIds];
                const typesArr    = Array.isArray(fieldTypes)    ? fieldTypes    : [fieldTypes];
                const labelsArr   = Array.isArray(fieldLabels)   ? fieldLabels   : [fieldLabels];
                const optionsArr  = Array.isArray(fieldOptions)  ? fieldOptions  : [fieldOptions];
                const requiredArr = Array.isArray(fieldRequired) ? fieldRequired : [fieldRequired];

                // Silinecek alanları bul
                const currentFields = db.prepare(
                    'SELECT id FROM task_fields WHERE task_id = ?'
                ).all(id);
                const currentFieldIds = currentFields.map(f => f.id.toString());
                const incomingIds     = idsArr.filter(fid => fid !== '').map(fid => fid.toString());
                const toDelete        = currentFieldIds.filter(cid => !incomingIds.includes(cid));

                if (toDelete.length > 0) {
                    const deleteFieldStmt = db.prepare('DELETE FROM task_fields WHERE id = ?');
                    toDelete.forEach(fid => deleteFieldStmt.run(fid));
                }

                const insertStmt = db.prepare(`
                    INSERT INTO task_fields
                        (task_id, field_type, field_label, field_options, is_required, field_order)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);
                const updateStmt = db.prepare(`
                    UPDATE task_fields
                    SET field_type = ?, field_label = ?, field_options = ?,
                        is_required = ?, field_order = ?
                    WHERE id = ?
                `);

                typesArr.forEach((type, i) => {
                    if (labelsArr[i] && labelsArr[i].trim()) {
                        const options    = optionsArr[i] || '';
                        const isRequired = requiredArr.includes(i.toString()) ? 1 : 0;
                        const fieldId    = idsArr[i];

                        if (fieldId) {
                            updateStmt.run(type, labelsArr[i], options, isRequired, i, fieldId);
                        } else {
                            insertStmt.run(id, type, labelsArr[i], options, isRequired, i);
                        }
                    }
                });
            } else {
                // Hiç alan gönderilmediyse tümünü sil
                db.prepare('DELETE FROM task_fields WHERE task_id = ?').run(id);
            }

            res.redirect(`/admin/tasks/${id}?status=updated`);
        } catch (error) {
            console.error('Görev güncelleme hatası:', error);
            res.redirect('/admin/tasks?status=error');
        }
    },

    /* ─────────────────────────────────────
       Görev Onayla (Approve)
    ───────────────────────────────────── */
    approveAssignment: async (req, res) => {
        try {
            const { taskId, assignmentId } = req.params;

            const assignment = db.prepare(
                'SELECT * FROM task_assignments WHERE id = ? AND task_id = ?'
            ).get(assignmentId, taskId);
            if (!assignment) return res.redirect(`/admin/tasks/${taskId}?error=not_found`);

            const now = new Date().toISOString();
            db.prepare(`
                UPDATE task_assignments
                SET status = 'completed', completed_at = ?, rejection_note = NULL
                WHERE id = ?
            `).run(now, assignmentId);

            const task = db.prepare('SELECT title FROM tasks WHERE id = ?').get(taskId);
            await sendPushNotification(assignment.user_id, {
                title: '✅ Göreviniz Onaylandı',
                body:  task
                    ? `"${task.title}" başlıklı göreviniz yönetici tarafından onaylandı.`
                    : 'Göreviniz onaylandı.',
                url:   `/okul/tasks/${assignmentId}`,
                tag:   'approved-' + assignmentId
            });

            res.redirect(`/admin/tasks/${taskId}?status=approved`);
        } catch (error) {
            console.error('Görev onaylama hatası:', error);
            res.redirect(`/admin/tasks/${req.params.taskId}?error=1`);
        }
    },

    /* ─────────────────────────────────────
       Görev İade Et (Reject)
    ───────────────────────────────────── */
    rejectAssignment: async (req, res) => {
        try {
            const { taskId, assignmentId } = req.params;
            const { rejection_note } = req.body;

            const assignment = db.prepare(
                'SELECT * FROM task_assignments WHERE id = ? AND task_id = ?'
            ).get(assignmentId, taskId);
            if (!assignment) return res.redirect(`/admin/tasks/${taskId}?error=not_found`);

            const note = rejection_note || 'Eksik veya hatalı gönderim.';
            db.prepare(`
                UPDATE task_assignments
                SET status = 'rejected', rejection_note = ?
                WHERE id = ?
            `).run(note, assignmentId);

            const task = db.prepare('SELECT title FROM tasks WHERE id = ?').get(taskId);
            await sendPushNotification(assignment.user_id, {
                title: '⚠️ Göreviniz İade Edildi',
                body:  task
                    ? `"${task.title}" başlıklı göreviniz iade edildi. Not: ${note}`
                    : 'Göreviniz iade edildi.',
                url:   `/okul/tasks/${assignmentId}`,
                tag:   'rejected-' + assignmentId
            });

            res.redirect(`/admin/tasks/${taskId}?status=rejected`);
        } catch (error) {
            console.error('Görev iade hatası:', error);
            res.redirect(`/admin/tasks/${req.params.taskId}?error=1`);
        }
    },

    /* ─────────────────────────────────────
       Admin Mesaj Gönder
    ───────────────────────────────────── */
    sendAdminMessage: async (req, res) => {
        try {
            const { assignmentId } = req.params;
            const { message, task_id } = req.body;
            const userId = req.session.user.id;

            if (!message || !message.trim()) {
                return res.redirect(`/admin/tasks/${task_id}?error=empty_message`);
            }

            db.prepare(
                'INSERT INTO task_messages (assignment_id, sender_id, message) VALUES (?, ?, ?)'
            ).run(assignmentId, userId, message.trim());

            // Push bildirimi – hedef okul
            const info = db.prepare(`
                SELECT ta.user_id, t.title AS task_title
                FROM task_assignments ta
                JOIN tasks t ON ta.task_id = t.id
                WHERE ta.id = ?
            `).get(assignmentId);

            if (info) {
                const subs = db.prepare(
                    'SELECT * FROM push_subscriptions WHERE user_id = ?'
                ).all(info.user_id);

                if (subs.length > 0) {
                    const preview = message.trim().length > 50
                        ? message.trim().substring(0, 50) + '...'
                        : message.trim();
                    try {
                        await sendPushNotification(info.user_id, {
                            title: `💬 Yeni Mesaj: ${info.task_title || 'Görev'}`,
                            body:  preview,
                            url:   `/okul/tasks/${assignmentId}`,
                            tag:   'message-' + assignmentId + '-' + Date.now()
                        });
                    } catch (pushErr) {
                        console.error('Push bildirim hatası:', pushErr);
                    }
                }
            }

            res.redirect(`/admin/tasks/${task_id}`);
        } catch (error) {
            console.error('Admin mesaj gönderme hatası:', error);
            res.redirect(req.headers.referer || '/admin/tasks');
        }
    },

    /* ─────────────────────────────────────
       Yanıt Dosyasını İndir
    ───────────────────────────────────── */
    downloadResponseFile: (req, res) => {
        try {
            const { assignmentId } = req.params;
            const assignment = db.prepare(`
                SELECT ta.response_file,
                       u.full_name  AS school_name,
                       t.title      AS task_title
                FROM task_assignments ta
                JOIN users u ON ta.user_id = u.id
                JOIN tasks t ON ta.task_id = t.id
                WHERE ta.id = ?
            `).get(assignmentId);

            if (!assignment || !assignment.response_file) {
                return res.status(404).send('Dosya bulunamadı.');
            }

            const path = require('path');
            const fs   = require('fs');
            const { sanitizeFilename } = require('../utils/upload');

            const filePath = path.join(
                __dirname, '..', 'public', 'uploads', 'responses',
                assignment.response_file
            );

            if (!fs.existsSync(filePath)) {
                return res.status(404).send('Dosya sunucuda bulunamadı.');
            }

            const ext          = path.extname(assignment.response_file);
            const downloadName = `${sanitizeFilename(assignment.school_name)}_${sanitizeFilename(assignment.task_title)}${ext}`;

            res.download(filePath, downloadName);
        } catch (error) {
            console.error('Dosya indirme hatası:', error);
            res.status(500).send('Dosya indirilirken bir hata oluştu.');
        }
    },

    /* ─────────────────────────────────────
       Toplu Görev Onaylama
    ───────────────────────────────────── */
    approveBulk: (req, res) => {
        try {
            const { taskId } = req.params;
            let { assignmentIds } = req.body;
            
            if (!assignmentIds) {
                return res.redirect(`/admin/tasks/${taskId}?error=1`);
            }
            
            // Eğer tek bir değer geldiyse diziye çevir
            if (!Array.isArray(assignmentIds)) {
                assignmentIds = [assignmentIds];
            }
            
            if (assignmentIds.length === 0) {
                return res.redirect(`/admin/tasks/${taskId}?error=1`);
            }
            
            const placeholders = assignmentIds.map(() => '?').join(',');
            
            // Sadece pending_approval durumundakileri onayla
            const db = require('../config/database');
            db.prepare(`
                UPDATE task_assignments 
                SET status = 'completed' 
                WHERE task_id = ? AND status = 'pending_approval' AND id IN (${placeholders})
            `).run(taskId, ...assignmentIds);
            
            // Bildirim gönder (Asenkron)
            const task = db.prepare('SELECT title FROM tasks WHERE id = ?').get(taskId);
            
            assignmentIds.forEach(id => {
                const ta = db.prepare('SELECT user_id FROM task_assignments WHERE id = ?').get(id);
                if(ta && task) {
                   const { sendPushNotification } = require('../utils/push');
                   sendPushNotification(ta.user_id, {
                        title: '✅ Görev Onaylandı',
                        body: `'${task.title}' görevi için gönderdiğiniz yanıt onaylandı.`,
                        url: `/okul/tasks/${taskId}`
                   }).catch(e => console.error('Push error:', e.message));
                }
            });

            res.redirect(`/admin/tasks/${taskId}?success=1`);
        } catch (error) {
            console.error('Toplu onay hatası:', error);
            res.redirect(`/admin/tasks/${req.params.taskId}?error=1`);
        }
    }
};

module.exports = taskController;

