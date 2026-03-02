const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Giriş Sayfası
router.get('/login', authController.loginPage);
router.post('/login', authController.login);

// Çıkış
router.get('/logout', authController.logout);

module.exports = router;
