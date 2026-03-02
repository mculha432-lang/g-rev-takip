const express = require('express');
const router = express.Router();
const schoolController = require('../controllers/schoolController');
const { isAdmin } = require('../middleware/auth');

// Tüm okul yönetimi rotaları için admin auth kontrolü
router.use(isAdmin);

// Okul Listesi
router.get('/', schoolController.index);

// Okul Ekle
router.post('/', schoolController.store);

// Okul Düzenle - Form Getir
router.get('/:id/edit', schoolController.edit);

// Okul Güncelle
router.post('/:id/update', schoolController.update);

// Okul Sil
router.post('/:id/delete', schoolController.delete);

// Kurum Yöneticisi Yap / Kaldır
router.post('/:id/toggle-manager', schoolController.toggleManager);

module.exports = router;
