const webpush = require('web-push');
const db = require('../config/database');
const { logger } = require('./logger');

// VAPID keys generated earlier
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || 'BFKNTfLov7pCKoBPOI6hsIH-WC3y6cHzN5lrCqW23q-ERzppflZSsOMyBlV3LQ5LmB6TFwjiEsdAX3zCI0vTHNE';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || 'lEqo4HUaoMUlIxDNOe9yU9kGvsmX_mo48VsTnR0KWTU';

webpush.setVapidDetails(
    'mailto:test@elbmemgts.com.tr',
    publicVapidKey,
    privateVapidKey
);

/**
 * Belirli bir kullanıcıya "Web Push Notification" gönderir.
 * @param {number} userId - Alıcının kullanıcı ID'si
 * @param {object} payloadData - Bildirim içeriği ({ title, body, url, icon, tag })
 */
async function sendPushNotification(userId, payloadData) {
    try {
        console.log(`[PUSH] ▶ Push gönderimi başlatılıyor: userId=${userId}, title="${payloadData.title}"`);

        const subscriptions = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
        if (!subscriptions || subscriptions.length === 0) {
            console.warn(`[PUSH] ⚠️ userId=${userId} için push aboneliği bulunamadı! Bildirim GÖNDERİLEMEDİ.`);
            logger.info(`Push: Kullanıcı ${userId} için aktif abonelik bulunamadı.`);
            return;
        }

        console.log(`[PUSH] 📋 ${subscriptions.length} adet push aboneliği bulundu.`);

        const payload = JSON.stringify({
            title: payloadData.title || 'E-GTS Bildirim',
            body: payloadData.body || '',
            icon: payloadData.icon || '/icons/icon-192.png',
            url: payloadData.url || '/',
            tag: payloadData.tag || 'egts-' + Date.now(),
            timestamp: Date.now()
        });

        // Push gönderim seçenekleri
        const pushOptions = {
            TTL: 86400,       // 24 saat (saniye)
            urgency: 'high',  // Yüksek öncelik
        };

        for (const sub of subscriptions) {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };

            try {
                const result = await webpush.sendNotification(pushSubscription, payload, pushOptions);
                console.log(`[PUSH] ✅ Push GÖNDERİLDİ! userId=${userId}, statusCode=${result.statusCode}`);
                logger.info(`Push bildirim gönderildi (User: ${userId})`);
            } catch (err) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
                    console.warn(`[PUSH] 🗑️ Süresi dolmuş abonelik silindi (userId=${userId}, status=${err.statusCode})`);
                    logger.info(`Süresi dolmuş push aboneliği silindi (User: ${userId})`);
                } else {
                    console.error(`[PUSH] ❌ Push HATASI! userId=${userId}, status=${err.statusCode}, mesaj=${err.message}`);
                    console.error(`[PUSH] ❌ Detay:`, err.body || err);
                    logger.error(`Push bildirim hatası (User: ${userId}):`, err.message || err);
                }
            }
        }
    } catch (error) {
        console.error(`[PUSH] ❌ GENEL HATA:`, error);
        logger.error(`sendPushNotification genel hata:`, error);
    }
}

module.exports = { sendPushNotification, publicVapidKey };
