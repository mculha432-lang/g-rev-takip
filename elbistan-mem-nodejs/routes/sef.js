const express = require('express');
const router = express.Router();
const sefController = require('../controllers/sefController');
const { isSef } = require('../middleware/auth');
const { virusScanner } = require('../utils/upload');

const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

// Tüm şef rotaları için şef auth kontrolü
router.use(isSef);
router.use(csrfProtection);

// Dashboard
router.get('/dashboard', sefController.dashboard);

// Profil
router.get('/profile', sefController.profile);
router.post('/profile/password', sefController.changePassword);

// Görev Listesi + Yeni Görev Oluştur
router.get('/tasks', sefController.taskList);
router.post('/tasks', sefController.uploadMulter, virusScanner, sefController.store);

// Görev Detay
router.get('/tasks/:id', sefController.detail);

// Rapor İndir
router.get('/tasks/:id/report/excel', sefController.downloadReport);

// Mesaj Gönder
router.post('/tasks/assignments/:assignmentId/message', sefController.sendMessage);

module.exports = router;
