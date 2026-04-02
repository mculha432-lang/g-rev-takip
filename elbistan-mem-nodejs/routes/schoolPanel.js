const express = require('express');
const router = express.Router();
const schoolPanelController = require('../controllers/schoolPanelController');
const { isSchool } = require('../middleware/auth');
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

// Tüm okul paneli rotaları için school auth kontrolü
router.use(isSchool);

// Okul Paneli Dashboard
router.get('/dashboard', schoolPanelController.dashboard);

// Görev Detay
router.get('/tasks/:id', schoolPanelController.taskDetail);

// Görev Yanıt Gönder
router.post('/tasks/:id/response', schoolPanelController.uploadMulter, csrfProtection, schoolPanelController.uploadResponse);

// Mesaj Gönder
router.post('/tasks/:id/message', schoolPanelController.sendMessage);



module.exports = router;

