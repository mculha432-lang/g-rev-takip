const db = require('../config/database');
const { uploads, deleteFile } = require('../utils/upload');

const adminController = {
    uploadMulter: uploads.system.single('file'),

    // Dashboard
    dashboard: (req, res) => {
        try {
            // İstatistikler - Kartlar için
            const allTasksRows = db.prepare("SELECT id, deadline FROM tasks").all();
            const now = new Date();
            
            let activeTaskIds = [];
            let expiredTaskIds = [];
            
            allTasksRows.forEach(t => {
                let isExpired = false;
                if (t.deadline) {
                    const dDate = new Date(t.deadline);
                    if (t.deadline.length <= 10) dDate.setHours(23, 59, 59, 999);
                    if (now > dDate) isExpired = true;
                }
                if (!isExpired) {
                    activeTaskIds.push(t.id);
                } else {
                    expiredTaskIds.push(t.id);
                }
            });

            const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role != 'admin'").get().count;
            const totalTasks = activeTaskIds.length;

            // Atamalar ve Başarı Oranı
            let totalAssignments = 0;
            let completedTasks = 0;
            let successRate = 0;
            let pendingTasks = 0;

            try {
                // Sadece süresi dolmamış aktif görevlerin atamalarını al (Bekleyenleri hesaplamak için)
                let activeAssignmentsCount = 0;
                let activeCompletedCount = 0;
                
                if (activeTaskIds.length > 0) {
                    const placeholders = activeTaskIds.map(() => '?').join(',');
                    activeAssignmentsCount = db.prepare(`SELECT COUNT(*) as count FROM task_assignments WHERE task_id IN (${placeholders})`).get(...activeTaskIds).count;
                    activeCompletedCount = db.prepare(`SELECT COUNT(*) as count FROM task_assignments WHERE status = 'completed' AND task_id IN (${placeholders})`).get(...activeTaskIds).count;
                }
                
                // Başarı oranı hesaplaması için TÜM görevler (Geçmiş ve aktif)
                totalAssignments = db.prepare("SELECT COUNT(*) as count FROM task_assignments").get().count;
                completedTasks = db.prepare("SELECT COUNT(*) as count FROM task_assignments WHERE status = 'completed'").get().count;
                successRate = totalAssignments > 0 ? Math.round((completedTasks / totalAssignments) * 100) : 0;
                
                // Bekleyen görevler sadece aktif görevler üzerinden hesaplanmalı
                pendingTasks = activeAssignmentsCount - activeCompletedCount;
            } catch (e) { console.error("Grafik veri hatası:", e); }

            // --- DETAYLI GRAFİK VERİLERİ ---

            // 1. Okul Türüne Göre Tamamlanma Oranları
            // Her tür için toplam ve tamamlanan görev sayısını al
            const schoolStats = db.prepare(`
                SELECT u.school_type, 
                       COUNT(ta.id) as total,
                       SUM(CASE WHEN ta.status = 'completed' THEN 1 ELSE 0 END) as completed
                FROM task_assignments ta
                JOIN users u ON ta.user_id = u.id
                WHERE u.school_type IS NOT NULL
                GROUP BY u.school_type
            `).all();

            // 2. Genel Görev Durumu Dağılımı
            const statusStats = db.prepare(`
                SELECT status, COUNT(*) as count 
                FROM task_assignments 
                GROUP BY status
            `).all();

            // 3. En Başarılı 5 Okul (En çok görev tamamlayan)
            const topSchools = db.prepare(`
                SELECT u.full_name as school_name, 
                       COUNT(ta.id) as completed_count,
                       (SELECT COUNT(*) FROM task_assignments WHERE user_id = u.id) as total_assigned
                FROM task_assignments ta
                JOIN users u ON ta.user_id = u.id
                WHERE ta.status = 'completed'
                GROUP BY u.id
                ORDER BY completed_count DESC
                LIMIT 5
            `).all();

            // Verileri frontend formatına hazırla
            const schoolTypeLabels = schoolStats.map(s => s.school_type || 'Diğer');
            const schoolTypeRates = schoolStats.map(s => s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0);

            const statusLabels = {
                'pending': 'Bekleyen',
                'in_progress': 'Devam Eden',
                'completed': 'Tamamlanan',
                'rejected': 'Reddedilen'
            };
            const statusChartData = {
                labels: statusStats.map(s => statusLabels[s.status] || s.status),
                counts: statusStats.map(s => s.count)
            };


            // Duyurular
            const announcements = db.prepare("SELECT * FROM announcements ORDER BY id DESC").all();

            // Sistem dosyaları
            const systemFiles = db.prepare("SELECT * FROM system_files ORDER BY id DESC").all();

            // Takvim için görev tarihleri
            const tasks = db.prepare("SELECT title, deadline FROM tasks ORDER BY deadline ASC").all();
            const calendarEvents = {};
            tasks.forEach(task => {
                if (task.deadline) {
                    const date = task.deadline.split(' ')[0]; // YYYY-MM-DD formatı
                    if (!calendarEvents[date]) {
                        calendarEvents[date] = [];
                    }
                    calendarEvents[date].push(task.title);
                }
            });

            res.render('admin/dashboard', {
                title: 'Genel Bakış',
                activePage: 'dashboard',
                totalUsers,
                totalTasks,
                totalAssignments,
                completedTasks,
                pendingTasks,
                successRate,
                announcements,
                systemFiles,
                calendarEvents: JSON.stringify(calendarEvents),
                // Yeni istatistik verileri
                chartData: {
                    schoolTypes: { labels: schoolTypeLabels, data: schoolTypeRates },
                    statusDist: statusChartData,
                    topSchools: topSchools
                }
            });

        } catch (error) {
            console.error('Dashboard hatası:', error);
            res.status(500).send('Bir hata oluştu');
        }
    },

    // Duyuru Ekle
    addAnnouncement: (req, res) => {
        try {
            const { title, content } = req.body;
            db.prepare('INSERT INTO announcements (title, content) VALUES (?, ?)').run(
                title, content || 'Detaylar için panele bakınız.'
            );
            res.redirect('/admin/dashboard?success=announcement_added');
        } catch (error) {
            console.error('Duyuru ekleme hatası:', error);
            res.redirect('/admin/dashboard?error=1');
        }
    },

    // Duyuru Sil
    deleteAnnouncement: (req, res) => {
        try {
            const { id } = req.params;
            db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
            res.redirect('/admin/dashboard');
        } catch (error) {
            console.error('Duyuru silme hatası:', error);
            res.redirect('/admin/dashboard?error=1');
        }
    },

    // Dosya Listesi Sayfası
    files: (req, res) => {
        try {
            const files = db.prepare("SELECT * FROM system_files ORDER BY id DESC").all();
            res.render('admin/files', {
                title: 'Dosya Yönetimi',
                activePage: 'files',
                files
            });
        } catch (error) {
            console.error('Dosya listesi hatası:', error);
            res.status(500).send('Bir hata oluştu');
        }
    },

    // Dosya Yükle
    uploadSystemFile: (req, res) => {
        try {
            const { title } = req.body;
            const fileName = req.file ? req.file.filename : null;

            if (fileName) {
                db.prepare('INSERT INTO system_files (title, file_path) VALUES (?, ?)').run(
                    title, fileName
                );
            }
            res.redirect('/admin/files?success=file_uploaded');
        } catch (error) {
            console.error('Dosya yükleme hatası:', error);
            res.redirect('/admin/dashboard?error=1');
        }
    },

    // Dosya Sil
    deleteSystemFile: (req, res) => {
        try {
            const { id } = req.params;

            // Önce dosya yolunu al
            const file = db.prepare('SELECT file_path FROM system_files WHERE id = ?').get(id);

            if (file && file.file_path) {
                deleteFile('system', file.file_path);
            }

            db.prepare('DELETE FROM system_files WHERE id = ?').run(id);
            res.redirect('/admin/files?success=file_deleted');
        } catch (error) {
            console.error('Dosya silme hatası:', error);
            res.redirect('/admin/dashboard?error=1');
        }
    },

    // Profil Sayfası
    profile: (req, res) => {
        try {
            const userId = req.session.user.id;
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

            // Giriş logları
            const logs = db.prepare(`
                SELECT * FROM logs 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT 10
            `).all(userId);

            res.render('admin/profile', {
                title: 'Profil',
                activePage: 'profile',
                user,
                logs,
                status: req.query.status || null
            });
        } catch (error) {
            console.error('Profil hatası:', error);
            res.redirect('/admin/dashboard?error=1');
        }
    },

    // Şifre Değiştir
    changePassword: (req, res) => {
        try {
            const userId = req.session.user.id;
            const { current_password, new_password, confirm_password } = req.body;

            // Mevcut kullanıcıyı al
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

            if (!user) {
                return res.redirect('/admin/profile?status=error');
            }

            // Mevcut şifre kontrolü
            const bcrypt = require('bcryptjs');
            let passwordValid = false;

            if (user.password.startsWith('$2')) {
                passwordValid = bcrypt.compareSync(current_password, user.password);
            } else {
                passwordValid = (current_password === user.password);
            }

            if (!passwordValid) {
                return res.redirect('/admin/profile?status=wrong_password');
            }

            // Yeni şifre eşleşme kontrolü
            if (new_password !== confirm_password) {
                return res.redirect('/admin/profile?status=mismatch');
            }

            // Şifre uzunluk kontrolü
            if (new_password.length < 6) {
                return res.redirect('/admin/profile?status=too_short');
            }

            // Şifreyi güncelle
            const hashedPassword = bcrypt.hashSync(new_password, 10);
            db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, userId);

            res.redirect('/admin/profile?status=password_changed');
        } catch (error) {
            console.error('Şifre değiştirme hatası:', error);
            res.redirect('/admin/profile?status=error');
        }
    },

    // Profil Güncelle
    updateProfile: (req, res) => {
        try {
            const userId = req.session.user.id;
            const { full_name, username } = req.body;

            if (!full_name || !username) {
                return res.redirect('/admin/profile?status=fields_required');
            }

            if (username.length < 3) {
                return res.redirect('/admin/profile?status=username_short');
            }

            // Kullanıcı adı benzersizlik kontrolü
            const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, userId);
            if (existing) {
                return res.redirect('/admin/profile?status=username_taken');
            }

            db.prepare('UPDATE users SET full_name = ?, username = ? WHERE id = ?').run(full_name, username, userId);

            // Session'ı güncelle
            req.session.user.full_name = full_name;
            req.session.user.username = username;

            res.redirect('/admin/profile?status=profile_updated');
        } catch (error) {
            console.error('Profil güncelleme hatası:', error);
            res.redirect('/admin/profile?status=error');
        }
    }
};

module.exports = adminController;
