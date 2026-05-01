const express = require('express');
const router = express.Router();
const sefController = require('../controllers/sefController');
const { isSef } = require('../middleware/auth');
const { virusScanner } = require('../utils/upload');

const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

// Tüm şef rotaları için şef auth kontrolü
router.use(isSef);

// GET rotalarına CSRF uygula (token oluşturma için)
router.use((req, res, next) => {
    if (req.method === 'GET') {
        return csrfProtection(req, res, next);
    }
    next();
});

// Dashboard
router.get('/dashboard', sefController.dashboard);

// Profil
router.get('/profile', sefController.profile);
router.post('/profile/password', csrfProtection, sefController.changePassword);

// Görev Listesi + Yeni Görev Oluştur
router.get('/tasks', sefController.taskList);
router.post('/tasks', sefController.uploadMulter, virusScanner, csrfProtection, sefController.store);

/* ── Statik alt rotalar (/:id rotasından ÖNCE tanımla) ── */
// Yanıt Dosyası İndir
router.get('/tasks/assignments/:assignmentId/download', sefController.downloadResponseFile);

// Mesaj Gönder (admin seviyesi - form POST)
router.post('/tasks/assignments/:assignmentId/message', csrfProtection, sefController.sendAdminMessage);

/* ── Dinamik /:id rotaları ── */
// Görev Detay
router.get('/tasks/:id', sefController.detail);

// Rapor İndir
router.get('/tasks/:id/report/excel', sefController.downloadReport);

// Görev Onayla
router.post('/tasks/:taskId/assignments/:assignmentId/approve', csrfProtection, sefController.approveAssignment);

// Görev İade Et (Reject)
router.post('/tasks/:taskId/assignments/:assignmentId/reject', csrfProtection, sefController.rejectAssignment);

// Toplu Onay
router.post('/tasks/:taskId/approve-bulk', csrfProtection, sefController.approveBulk);

module.exports = router;
