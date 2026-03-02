const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { isAdminOrManager } = require('../middleware/auth');

const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

// Tüm görev yönetimi rotaları için admin veya kurum yöneticisi auth kontrolü
router.use(isAdminOrManager);

// Görev Listesi
router.get('/', taskController.index);

// Görev Ekle - Önce dosya yükle (uploadMulter), sonra CSRF kontrolü yap
router.post('/', taskController.uploadMulter, csrfProtection, taskController.store);

// Görev Detay (Admin görünümü)
router.get('/:id', taskController.detail);

// Görev Düzenle - Form Getir
router.get('/:id/edit', taskController.edit);

// Görev Güncelle - Önce dosya yükle, sonra CSRF
router.post('/:id/update', taskController.uploadMulter, csrfProtection, taskController.update);

// Görev Sil (POST olarak değiştirildi - güvenlik için)
router.post('/:id/delete', taskController.delete);

// Görev İade Et (Reject)
router.post('/:taskId/assignments/:assignmentId/reject', taskController.rejectAssignment);

// Görev Onayla (Approve)
router.post('/:taskId/assignments/:assignmentId/approve', taskController.approveAssignment);

// Admin Mesaj Gönder
router.post('/assignments/:assignmentId/message', taskController.sendAdminMessage);

module.exports = router;
