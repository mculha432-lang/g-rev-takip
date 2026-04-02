const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { isAdminOrManager } = require('../middleware/auth');

const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

// Tüm görev yönetimi rotaları için admin veya kurum yöneticisi auth kontrolü
router.use(isAdminOrManager);

/* ─────────────────────────────────────────────────────────────
   ÖNEMLİ: Statik rotalar dinamik /:id rotalarından ÖNCE gelmeli.
   Aksi hâlde Express  /assignments/...  kısmını id=assignments
   olarak eşleştirir ve 500 Internal Server Error üretir.
───────────────────────────────────────────────────────────── */

// ── Görev Listesi ────────────────────────────────────────────
router.get('/', taskController.index);

// ── Görev Ekle ───────────────────────────────────────────────
// Önce dosya yükle (uploadMulter), sonra CSRF kontrolü
router.post('/', taskController.uploadMulter, csrfProtection, taskController.store);

// ── Statik alt rotalar (/:id rotasından ÖNCE tanımla) ────────
// Görev yanıt dosyası indir
router.get('/assignments/:assignmentId/download', taskController.downloadResponseFile);

// Admin mesaj gönder
router.post('/assignments/:assignmentId/message', taskController.sendAdminMessage);

// ── Dinamik /:id rotaları ────────────────────────────────────
// Görev Detay (Admin görünümü)
router.get('/:id', taskController.detail);

// Görev Düzenle – Form getir
router.get('/:id/edit', taskController.edit);

// Görev Güncelle – Önce dosya yükle, sonra CSRF
router.post('/:id/update', taskController.uploadMulter, csrfProtection, taskController.update);

// Görev Sil
router.post('/:id/delete', taskController.delete);

// Görev İade Et (Reject)
router.post('/:taskId/assignments/:assignmentId/reject', taskController.rejectAssignment);

// Görev Onayla (Approve)
router.post('/:taskId/assignments/:assignmentId/approve', taskController.approveAssignment);

// Toplu Görev Onayla
router.post('/:taskId/approve-bulk', taskController.approveBulk);

module.exports = router;
