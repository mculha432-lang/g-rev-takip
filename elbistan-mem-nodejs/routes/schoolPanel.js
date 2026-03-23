const express = require('express');
const router = express.Router();
const schoolPanelController = require('../controllers/schoolPanelController');
const { isSchool } = require('../middleware/auth');

// Tüm okul paneli rotaları için school auth kontrolü
router.use(isSchool);

// Okul Paneli Dashboard
router.get('/dashboard', schoolPanelController.dashboard);

// Görev Detay
router.get('/tasks/:id', schoolPanelController.taskDetail);

// Görev Yanıt Gönder
router.post('/tasks/:id/response', schoolPanelController.uploadMulter, schoolPanelController.uploadResponse);

// Mesaj Gönder
router.post('/tasks/:id/message', schoolPanelController.sendMessage);



module.exports = router;
