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
        const subscriptions = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
        if (!subscriptions || subscriptions.length === 0) {
            logger.info(`Push: Kullanıcı ${userId} için aktif abonelik bulunamadı.`);
            return;
        }

        const payload = JSON.stringify({
            title: payloadData.title || 'E-GTS Bildirim',
            body: payloadData.body || '',
            icon: payloadData.icon || '/icons/icon-192.png',
            url: payloadData.url || '/',
            tag: payloadData.tag || 'egts-' + Date.now(), // Her bildirim benzersiz tag alır
            timestamp: Date.now()
        });

        // Push gönderim seçenekleri
        const pushOptions = {
            TTL: 86400,       // 24 saat (saniye) - cihaz offline olsa bile 24 saat bekler
            urgency: 'high',  // Yüksek öncelik - Android Doze modunda bile teslim edilir
            topic: payloadData.tag || 'egts-notification' // Aynı topic'li bildirimler güncellenir
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
                await webpush.sendNotification(pushSubscription, payload, pushOptions);
                logger.info(`Push bildirim gönderildi (User: ${userId}, Endpoint: ${sub.endpoint.substring(0, 50)}...)`);
            } catch (err) {
                // Eğer abonelik iptal edilmişse (410 Gone) veritabanından sil
                if (err.statusCode === 410 || err.statusCode === 404) {
                    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
                    logger.info(`Süresi dolmuş push aboneliği silindi (User: ${userId})`);
                } else {
                    logger.error(`Push bildirim hatası (User: ${userId}):`, err.message || err);
                }
            }
        }
    } catch (error) {
        logger.error(`sendPushNotification genel hata:`, error);
    }
}

module.exports = { sendPushNotification, publicVapidKey };

