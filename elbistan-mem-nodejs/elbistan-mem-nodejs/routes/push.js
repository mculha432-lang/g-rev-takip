const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');
const { publicVapidKey } = require('../utils/push');

// Public VAPID key'i frontend'e ver (gizliliğe gerek yok)
router.get('/vapidPublicKey', isAuthenticated, (req, res) => {
    res.json({ publicKey: publicVapidKey });
});

// Yeni abonelik oluştur
router.post('/subscribe', isAuthenticated, (req, res) => {
    try {
        const userId = req.session.user.id;
        const subscription = req.body;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ error: 'Geçersiz abonelik verisi.' });
        }

        const endpoint = subscription.endpoint;
        const p256dh = subscription.keys ? subscription.keys.p256dh : '';
        const auth = subscription.keys ? subscription.keys.auth : '';

        // Zaten aynı abonelik var mı kontrol et?
        const existing = db.prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?').get(endpoint);
        
        if (!existing) {
            // Ekle
            db.prepare('INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)').run(userId, endpoint, p256dh, auth);
            res.status(201).json({ success: true, message: 'Abonelik eklendi.' });
        } else {
            // Varsa kimin üzerineyse güncelle/bırak
            db.prepare('UPDATE push_subscriptions SET user_id = ? WHERE endpoint = ?').run(userId, endpoint);
            res.status(200).json({ success: true, message: 'Abonelik güncellendi.' });
        }
    } catch (error) {
        console.error('Subscribe route error:', error);
        res.status(500).json({ error: 'Sunucu hatası oluştu.' });
    }
});

module.exports = router;
