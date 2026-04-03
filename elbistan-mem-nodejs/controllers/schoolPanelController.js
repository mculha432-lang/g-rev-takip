const db = require('../config/database');
const { uploads } = require('../utils/upload');
const { sendPushNotification } = require('../utils/push');
const { isDeadlinePassed, canSubmitResponse } = require('../utils/deadline');

const schoolPanelController = {
    uploadMulter: uploads.response.array('response_files', 20),

    // Okul Dashboard
    dashboard: (req, res) => {
        try {
            const userId = req.session.user.id;

            // Okula atanan görevler - Özel sıralama ile
            const myTasks = db.prepare(`
                SELECT ta.id as assignment_id, t.id as task_id, t.title, t.deadline, ta.status, ta.is_read
                FROM task_assignments ta 
                JOIN tasks t ON ta.task_id = t.id 
                WHERE ta.user_id = ? 
                ORDER BY 
                    CASE 
                        WHEN ta.status = 'pending' AND ta.is_read = 0 THEN 1
                        WHEN ta.status = 'pending' AND ta.is_read = 1 THEN 2
                        WHEN ta.status = 'rejected' THEN 3
                        WHEN ta.status = 'in_progress' THEN 4
                        WHEN ta.status = 'completed' THEN 5
                        ELSE 6
                    END,
                    ta.id DESC
            `).all(userId);

            // İstatistikler
            let totalTasks = 0;
            let completedTasks = 0;
            let pendingTasks = 0;
            let inProgressTasks = 0;

            const now = new Date();

            myTasks.forEach(task => {
                let isExpired = false;
                if (task.deadline && task.status !== 'completed' && task.status !== 'rejected') {
                    const dDate = new Date(task.deadline);
                    if (task.deadline.length <= 10) dDate.setHours(23, 59, 59, 999);
                    if (now > dDate) isExpired = true;
                }

                if (task.status === 'completed') {
                    completedTasks++;
                    totalTasks++;
                } else if (!isExpired) {
                    // Sadece süresi dolmamış aktif görevleri sayılara ekle
                    totalTasks++;
                    if (task.status === 'in_progress') inProgressTasks++;
                        else pendingTasks++;
                }
            });

            // Son duyuru
            const announcement = db.prepare("SELECT * FROM announcements ORDER BY id DESC LIMIT 1").get();

            // Sistem dosyaları
            const systemFiles = db.prepare("SELECT * FROM system_files ORDER BY id DESC").all();

            // Takvim için görev tarihleri
            const calendarEvents = {};
            myTasks.forEach(task => {
                if (task.deadline) {
                    const date = task.deadline.split(' ')[0];
                    if (!calendarEvents[date]) {
                        calendarEvents[date] = [];
                    }
                    calendarEvents[date].push(task.title);
                }
            });

            res.render('okul/dashboard', {
                title: 'Okul Paneli',
                activePage: 'dashboard',
                myTasks,
                totalTasks,
                completedTasks,
                pendingTasks,
                inProgressTasks,
                announcement,
                systemFiles,
                calendarEvents: JSON.stringify(calendarEvents)
            });
        } catch (error) {
            console.error('Okul dashboard hatası:', error);
            res.status(500).send('Bir hata oluştu');
        }
    },

    // Görev Detay
    taskDetail: (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.session.user.id;

            // Atamayı bul
            let assignment = db.prepare(`
                SELECT ta.*, t.id as task_id, t.title, t.description, t.deadline, t.file_path as task_file, t.requires_file, t.is_file_mandatory, t.max_file_count
                FROM task_assignments ta 
                JOIN tasks t ON ta.task_id = t.id 
                WHERE ta.id = ? AND ta.user_id = ?
            `).get(id, userId);

            // ... (keep the same checking logic) ...

            // Atama ID değil, task ID mi gelmiş kontrol et
            if (!assignment) {
                const taskCheck = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
                if (taskCheck) {
                    let existingAssignment = db.prepare(
                        'SELECT * FROM task_assignments WHERE task_id = ? AND user_id = ?'
                    ).get(id, userId);

                    if (!existingAssignment) {
                        const result = db.prepare(
                            "INSERT INTO task_assignments (task_id, user_id, status) VALUES (?, ?, 'pending')"
                        ).run(id, userId);
                        return res.redirect(`/okul/tasks/${result.lastInsertRowid}`);
                    } else {
                        return res.redirect(`/okul/tasks/${existingAssignment.id}`);
                    }
                }
            }

            if (!assignment) {
                return res.status(404).send('Görev bulunamadı');
            }

            // Atanan tüm dosyaları getir
            const assignmentFiles = db.prepare('SELECT * FROM task_assignment_files WHERE assignment_id = ?').all(id);
            assignment.files = assignmentFiles;

            // Okundu olarak işaretle
            if (!assignment.is_read) {
                db.prepare('UPDATE task_assignments SET is_read = 1 WHERE id = ?').run(id);
            }

            // Form alanlarını getir
            const taskFields = db.prepare(
                'SELECT * FROM task_fields WHERE task_id = ? ORDER BY field_order ASC'
            ).all(assignment.task_id);

            // Mevcut cevapları getir
            const existingResponses = db.prepare(
                'SELECT * FROM task_field_responses WHERE assignment_id = ?'
            ).all(id);

            // Cevapları field_id ile eşleştir
            const responsesMap = {};
            existingResponses.forEach(r => {
                responsesMap[r.field_id] = r.response_value;
            });

            // Mesajları getir
            const messages = db.prepare(`
                SELECT tm.*, u.full_name, u.role 
                FROM task_messages tm 
                JOIN users u ON tm.sender_id = u.id 
                WHERE tm.assignment_id = ? 
                ORDER BY tm.created_at ASC
            `).all(id);

            // Yöneticiden gelen mesajları okundu olarak işaretle
            db.prepare(`
                UPDATE task_messages 
                SET is_read = 1 
                WHERE assignment_id = ?
                AND sender_id != ?
                AND is_read = 0
            `).run(id, userId);

            // Göreve ait tüm ek dosyaları getir
            const taskAttachments = db.prepare(
                'SELECT * FROM task_attachments WHERE task_id = ? ORDER BY created_at ASC'
            ).all(assignment.task_id);

            res.render('okul/task_detail', {
                title: 'Görev Detayı',
                activePage: 'tasks',
                task: assignment,
                taskAttachments,
                taskFields,
                responsesMap,
                messages,
                isDeadlinePassed: deadlinePassed,
                currentUserId: userId,
                success: req.query.success,
                error: req.query.error
            });
        } catch (error) {
            console.error('Görev detay hatası:', error);
            res.status(500).send('Bir hata oluştu');
        }
    },

    // Mesaj Gönder
    sendMessage: async (req, res) => {
        try {
            const { id } = req.params; // assignment_id
            const { message } = req.body;
            const userId = req.session.user.id;

            if (!message || !message.trim()) {
                return res.redirect(`/okul/tasks/${id}?error=empty_message`);
            }

            // Atamanın bu okula ait olup olmadığını kontrol et
            const assignment = db.prepare('SELECT id FROM task_assignments WHERE id = ? AND user_id = ?').get(id, userId);
            if (!assignment) {
                return res.status(403).send('Yetkisiz işlem');
            }

            db.prepare('INSERT INTO task_messages (assignment_id, sender_id, message) VALUES (?, ?, ?)').run(id, userId, message.trim());

            // Tüm yöneticilere (admin ve manager) mesaj bildirimi gönder
            const senderName = req.session.user.full_name || 'Bir Okul';
            const admins = db.prepare("SELECT id FROM users WHERE role = 'admin' OR is_manager = 1").all();
            for (const admin of admins) {
                await sendPushNotification(admin.id, {
                    title: '💬 Yeni Mesaj: ' + senderName,
                    body: message.trim().length > 50 ? message.trim().substring(0, 50) + '...' : message.trim(),
                    url: `/admin/tasks/${req.params.id || id}`,
                    tag: 'school-msg-' + id + '-' + admin.id
                });
            }

            res.redirect(`/okul/tasks/${id}?success=message_sent#messages`);
        } catch (error) {
            console.error('Mesaj gönderme hatası:', error);
            res.redirect(`/okul/tasks/${req.params.id}?error=1`);
        }
    },

    // Yanıt Gönder
    uploadResponse: async (req, res) => {
        try {
            const { id } = req.params;
            const { response_note, status } = req.body;
            const userId = req.session.user.id;

            // Mevcut atamayı kontrol et
            const assignment = db.prepare(
                'SELECT ta.*, t.requires_file, t.is_file_mandatory, t.id as task_id FROM task_assignments ta JOIN tasks t ON ta.task_id = t.id WHERE ta.id = ? AND ta.user_id = ?'
            ).get(id, userId);

            if (!assignment) {
                return res.status(404).send('Görev bulunamadı');
            }

            // Süre doldu mu kontrol et?
            if (!canSubmitResponse(assignment.deadline, assignment.status)) {
                return res.redirect(`/okul/tasks/${id}?error=deadline_passed`);
            }

            // Eğer görev zaten onay bekliyor veya tamamlanmış ise düzenlemeye izin verme
            if (['pending_approval', 'completed'].includes(assignment.status)) {
                return res.redirect(`/okul/tasks/${id}?error=already_submitted`);
            }

            // Çoklu dosya desteği
            const files = req.files || [];
            const maxFiles = assignment.max_file_count || 1;

            if (files.length > maxFiles) {
                return res.redirect(`/okul/tasks/${id}?error=too_many_files`);
            }

            // Eğer yeni dosyalar geldiyse, mevcut dosyaları silebiliriz (veya üzerine ekleyebiliriz)
            // Kullanıcı kolaylığı açısından "yeni yükleme eskilerini siler" mantığı daha güvenli.
            if (files.length > 0) {
                // Eski dosyaları DB'den ve diskten sil (opsiyonel ama temizlik iyidir)
                const oldFiles = db.prepare('SELECT file_path FROM task_assignment_files WHERE assignment_id = ?').all(id);
                const { deleteFile } = require('../utils/upload');
                oldFiles.forEach(f => deleteFile('responses', f.file_path));
                
                db.prepare('DELETE FROM task_assignment_files WHERE assignment_id = ?').run(id);

                // Yeni dosyaları ekle
                const insertFileStmt = db.prepare(
                    'INSERT INTO task_assignment_files (assignment_id, file_path, original_name, file_size) VALUES (?, ?, ?, ?)'
                );
                
                files.forEach(file => {
                    insertFileStmt.run(id, file.filename, file.originalname, file.size);
                });

                // Geriye dönük uyumluluk için response_file sütununa ilk dosyanın adını yaz
                db.prepare('UPDATE task_assignments SET response_file = ? WHERE id = ?').run(files[0].filename, id);
            }

            // Dosya kontrolü için güncel filePath (en az bir dosya var mı?)
            const currentFilesCount = db.prepare('SELECT COUNT(*) as count FROM task_assignment_files WHERE assignment_id = ?').get(id).count;
            const hasFiles = currentFilesCount > 0;

            // Zorunlu dosya kontrolü
            const validStatus = ['in_progress', 'completed'].includes(status) ? status : 'in_progress';

            // Onay mekanizması: Okul "completed" gönderirse, durumu "pending_approval" yap
            let finalStatus = validStatus;
            if (validStatus === 'completed') {
                finalStatus = 'pending_approval';
            }

            if (finalStatus === 'pending_approval' && assignment.requires_file && assignment.is_file_mandatory && !hasFiles) {
                return res.redirect(`/okul/tasks/${id}?error=missing_file`);
            }

            // Güncelle
            db.prepare(
                'UPDATE task_assignments SET status = ?, response_note = ? WHERE id = ?'
            ).run(finalStatus, response_note, id);

            // Form alanı cevaplarını kaydet
            const taskFields = db.prepare('SELECT id FROM task_fields WHERE task_id = ?').all(assignment.task_id);

            taskFields.forEach(field => {
                const fieldValue = req.body[`field_${field.id}`];
                if (fieldValue !== undefined) {
                    // Checkbox için array'i virgülle birleştir
                    const responseValue = Array.isArray(fieldValue) ? fieldValue.join(', ') : fieldValue;

                    // Mevcut cevap var mı kontrol et
                    const existingResponse = db.prepare(
                        'SELECT id FROM task_field_responses WHERE assignment_id = ? AND field_id = ?'
                    ).get(id, field.id);

                    if (existingResponse) {
                        // Güncelle
                        db.prepare(
                            'UPDATE task_field_responses SET response_value = ? WHERE id = ?'
                        ).run(responseValue, existingResponse.id);
                    } else {
                        // Yeni ekle
                        db.prepare(
                            'INSERT INTO task_field_responses (assignment_id, field_id, response_value) VALUES (?, ?, ?)'
                        ).run(id, field.id, responseValue);
                    }
                }
            });

            // Eğer görev onay bekliyor durumuna geçtiyse yöneticilere bildirim gönder
            if (finalStatus === 'pending_approval') {
                const schoolName = req.session.user.full_name || 'Bir Okul';
                const admins = db.prepare("SELECT id FROM users WHERE role = 'admin' OR is_manager = 1").all();
                for (const admin of admins) {
                    await sendPushNotification(admin.id, {
                        title: '✅ Görev Onaya Gönderildi',
                        body: `${schoolName} bir görevi tamamlayıp onayınıza sundu.`,
                        url: `/admin/tasks/${assignment.task_id}`,
                        tag: 'approval-' + assignment.task_id + '-' + id
                    });
                }
            }

            res.redirect(`/okul/tasks/${id}?success=updated`);
        } catch (error) {
            console.error('Yanıt gönderme hatası:', error);
            res.redirect(`/okul/tasks/${req.params.id}?error=1`);
        }
    }
};

module.exports = schoolPanelController;
