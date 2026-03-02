const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdmin, isAdminOrManager } = require('../middleware/auth');
const backup = require('../utils/backup');
const reports = require('../utils/reports');

// Tüm admin rotaları için admin veya kurum yöneticisi auth kontrolü
router.use(isAdminOrManager);

// Dashboard
router.get('/dashboard', adminController.dashboard);

// Profil ve Şifre Değiştirme
router.get('/profile', adminController.profile);
router.post('/profile/password', adminController.changePassword);
router.post('/profile/update', adminController.updateProfile);

// Duyurular - Sadece admin
router.post('/announcements', isAdmin, adminController.addAnnouncement);
router.post('/announcements/:id/delete', isAdmin, adminController.deleteAnnouncement);

// Dosyalar
router.get('/files', adminController.files);
router.post('/files', isAdmin, adminController.uploadMulter, adminController.uploadSystemFile);
router.post('/files/:id/delete', isAdmin, adminController.deleteSystemFile);

// ==================== YEDEKLEME ====================
// Sadece admin
router.get('/backups', isAdmin, (req, res) => {
    const backups = backup.listBackups();
    res.render('admin/backups', {
        title: 'Yedekleme',
        activePage: 'backups',
        backups,
        status: req.query.status || null
    });
});

router.post('/backups/create', isAdmin, (req, res) => {
    const result = backup.backupDatabase();
    if (result.success) {
        res.redirect('/admin/backups?status=created');
    } else {
        res.redirect('/admin/backups?status=error');
    }
});

router.post('/backups/:name/restore', isAdmin, (req, res) => {
    const result = backup.restoreBackup(req.params.name);
    if (result.success) {
        res.redirect('/admin/backups?status=restored');
    } else {
        res.redirect('/admin/backups?status=error');
    }
});

// ==================== RAPORLAMA ====================
const db = require('../config/database');

router.get('/reports', (req, res) => {
    // Görevleri listele
    const tasks = db.prepare('SELECT id, title FROM tasks ORDER BY id DESC').all();

    res.render('admin/reports', {
        title: 'Raporlar',
        activePage: 'reports',
        tasks,
        status: req.query.status || null
    });
});

router.get('/reports/task-summary/excel', async (req, res) => {
    try {
        const result = await reports.generateTaskSummaryExcel();
        res.download(result.filePath, result.fileName);
    } catch (error) {
        console.error('Rapor hatası:', error);
        res.redirect('/admin/reports?status=error');
    }
});

router.get('/reports/task-summary/pdf', async (req, res) => {
    try {
        const result = await reports.generateTaskSummaryPDF();
        res.download(result.filePath, result.fileName);
    } catch (error) {
        console.error('Rapor hatası:', error);
        res.redirect('/admin/reports?status=error');
    }
});

router.get('/reports/school-performance/excel', async (req, res) => {
    try {
        const result = await reports.generateSchoolPerformanceExcel();
        res.download(result.filePath, result.fileName);
    } catch (error) {
        console.error('Rapor hatası:', error);
        res.redirect('/admin/reports?status=error');
    }
});

// Tek görev detay raporu (form cevapları dahil)
router.get('/reports/task-detail/:id/excel', async (req, res) => {
    try {
        const result = await reports.generateTaskDetailExcel(req.params.id);
        if (result) {
            res.download(result.filePath, result.fileName);
        } else {
            res.redirect('/admin/reports?status=not_found');
        }
    } catch (error) {
        console.error('Rapor hatası:', error);
        res.redirect('/admin/reports?status=error');
    }
});

// Eski route da çalışsın (backward compatibility)
router.get('/reports/task/:id/excel', async (req, res) => {
    try {
        const result = await reports.generateTaskDetailExcel(req.params.id);
        if (result) {
            res.download(result.filePath, result.fileName);
        } else {
            res.redirect('/admin/reports?status=not_found');
        }
    } catch (error) {
        console.error('Rapor hatası:', error);
        res.redirect('/admin/reports?status=error');
    }
});

// Okul Giriş-Çıkış Raporu
router.get('/reports/login-activity/excel', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const result = await reports.generateLoginActivityExcel(start_date || null, end_date || null);
        res.download(result.filePath, result.fileName);
    } catch (error) {
        console.error('Giriş-Çıkış raporu hatası:', error);
        res.redirect('/admin/reports?status=error');
    }
});

module.exports = router;
