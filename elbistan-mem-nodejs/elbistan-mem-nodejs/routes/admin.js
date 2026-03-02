const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdmin } = require('../middleware/auth');
const backup = require('../utils/backup');
const reports = require('../utils/reports');

// Tüm admin rotaları için auth kontrolü
router.use(isAdmin);

// Dashboard
router.get('/dashboard', adminController.dashboard);

// Profil ve Şifre Değiştirme
router.get('/profile', adminController.profile);
router.post('/profile/password', adminController.changePassword);

// Duyurular
router.post('/announcements', adminController.addAnnouncement);
router.post('/announcements/:id/delete', adminController.deleteAnnouncement);

// Dosyalar
router.get('/files', adminController.files);
router.post('/files', adminController.uploadMulter, adminController.uploadSystemFile);
router.post('/files/:id/delete', adminController.deleteSystemFile);

// ==================== YEDEKLEME ====================
router.get('/backups', (req, res) => {
    const backups = backup.listBackups();
    res.render('admin/backups', {
        title: 'Yedekleme',
        activePage: 'backups',
        backups,
        status: req.query.status || null
    });
});

router.post('/backups/create', (req, res) => {
    const result = backup.backupDatabase();
    if (result.success) {
        res.redirect('/admin/backups?status=created');
    } else {
        res.redirect('/admin/backups?status=error');
    }
});

router.post('/backups/:name/restore', (req, res) => {
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

module.exports = router;
