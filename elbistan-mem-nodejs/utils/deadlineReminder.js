const cron = require('node-cron');
const db = require('../config/database');
const { sendPushNotification } = require('./push');
const { logger } = require('./logger');

/**
 * Görev Son Teslim Tarihi Hatırlatma Sistemi
 * 
 * - Her gün sabah 08:00 ve 20:00'da çalışır
 * - Bugün son teslim tarihi olan görevler için bildirim gönderir
 * - Yarın son teslim tarihi olan görevler için ön uyarı gönderir
 * - Tamamlanmamış görevler için hatırlatma yapar
 * - Aynı görev için aynı gün içinde tekrar bildirim göndermez
 */

// Bugünün tarihini YYYY-MM-DD formatında al (Türkiye saatine göre)
function getTodayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Yarının tarihini al
function getTomorrowDate() {
    const now = new Date();
    now.setDate(now.getDate() + 1);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Hatırlatma logları tablosunu oluştur (tekrar bildirim göndermemek için)
function initReminderTable() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS deadline_reminders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            reminder_type TEXT NOT NULL,
            reminder_date TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(task_id, user_id, reminder_type, reminder_date)
        )
    `);
}

// Bildirim daha önce gönderilmiş mi kontrol et
function isReminderSent(taskId, userId, reminderType, date) {
    const existing = db.prepare(
        'SELECT id FROM deadline_reminders WHERE task_id = ? AND user_id = ? AND reminder_type = ? AND reminder_date = ?'
    ).get(taskId, userId, reminderType, date);
    return !!existing;
}

// Bildirimi gönderildi olarak işaretle
function markReminderSent(taskId, userId, reminderType, date) {
    try {
        db.prepare(
            'INSERT OR IGNORE INTO deadline_reminders (task_id, user_id, reminder_type, reminder_date) VALUES (?, ?, ?, ?)'
        ).run(taskId, userId, reminderType, date);
    } catch (e) {
        // UNIQUE constraint hatası - zaten kaydedilmiş
    }
}

// Eski hatırlatma kayıtlarını temizle (7 günden eski)
function cleanOldReminders() {
    try {
        db.prepare(
            "DELETE FROM deadline_reminders WHERE reminder_date < date('now', '-7 days')"
        ).run();
    } catch (e) {
        // Sessizce devam et
    }
}

/**
 * Ana hatırlatma fonksiyonu - Tüm görevleri kontrol eder
 */
async function checkDeadlineReminders() {
    const today = getTodayDate();
    const tomorrow = getTomorrowDate();

    console.log(`[REMINDER] ⏰ Deadline hatırlatma kontrolü başladı: ${new Date().toLocaleString('tr-TR')}`);
    console.log(`[REMINDER] 📅 Bugün: ${today}, Yarın: ${tomorrow}`);

    try {
        // 1. BUGÜN son teslim tarihi olan görevler
        const todayTasks = db.prepare(`
            SELECT t.id, t.title, t.deadline,
                   ta.id as assignment_id, ta.user_id, ta.status
            FROM tasks t
            JOIN task_assignments ta ON t.id = ta.task_id
            WHERE DATE(t.deadline) = ?
            AND ta.status NOT IN ('completed')
            ORDER BY t.id
        `).all(today);

        console.log(`[REMINDER] 🔴 Bugün teslim tarihi olan tamamlanmamış görev ataması: ${todayTasks.length}`);

        for (const task of todayTasks) {
            if (!isReminderSent(task.id, task.user_id, 'today', today)) {
                await sendPushNotification(task.user_id, {
                    title: '⏰ Son Teslim Tarihi BUGÜN!',
                    body: `"${task.title}" görevinin son teslim tarihi BUGÜN. Lütfen en kısa sürede tamamlayın.`,
                    url: `/okul/tasks/${task.assignment_id}`,
                    tag: 'deadline-today-' + task.id
                });
                markReminderSent(task.id, task.user_id, 'today', today);
                console.log(`[REMINDER] 📤 BUGÜN bildirimi gönderildi: userId=${task.user_id}, görev="${task.title}"`);
            }
        }

        // 2. YARIN son teslim tarihi olan görevler (ön uyarı)
        const tomorrowTasks = db.prepare(`
            SELECT t.id, t.title, t.deadline,
                   ta.id as assignment_id, ta.user_id, ta.status
            FROM tasks t
            JOIN task_assignments ta ON t.id = ta.task_id
            WHERE DATE(t.deadline) = ?
            AND ta.status NOT IN ('completed')
            ORDER BY t.id
        `).all(tomorrow);

        console.log(`[REMINDER] 🟡 Yarın teslim tarihi olan tamamlanmamış görev ataması: ${tomorrowTasks.length}`);

        for (const task of tomorrowTasks) {
            if (!isReminderSent(task.id, task.user_id, 'tomorrow', today)) {
                await sendPushNotification(task.user_id, {
                    title: '📋 Görev Hatırlatma - Yarın Son Gün',
                    body: `"${task.title}" görevinin son teslim tarihi YARIN. Tamamlamayı unutmayın.`,
                    url: `/okul/tasks/${task.assignment_id}`,
                    tag: 'deadline-tomorrow-' + task.id
                });
                markReminderSent(task.id, task.user_id, 'tomorrow', today);
                console.log(`[REMINDER] 📤 YARIN bildirimi gönderildi: userId=${task.user_id}, görev="${task.title}"`);
            }
        }

        // 3. SÜRESİ GEÇMİŞ görevler (bugünden önceki deadline'lar)
        const overdueTasks = db.prepare(`
            SELECT t.id, t.title, t.deadline,
                   ta.id as assignment_id, ta.user_id, ta.status
            FROM tasks t
            JOIN task_assignments ta ON t.id = ta.task_id
            WHERE DATE(t.deadline) < ?
            AND ta.status NOT IN ('completed')
            ORDER BY t.id
        `).all(today);

        console.log(`[REMINDER] 🔴 Süresi geçmiş tamamlanmamış görev ataması: ${overdueTasks.length}`);

        for (const task of overdueTasks) {
            if (!isReminderSent(task.id, task.user_id, 'overdue', today)) {
                await sendPushNotification(task.user_id, {
                    title: '🚨 Görev Süresi Geçti!',
                    body: `"${task.title}" görevinin süresi geçmiş! Lütfen acilen tamamlayın.`,
                    url: `/okul/tasks/${task.assignment_id}`,
                    tag: 'deadline-overdue-' + task.id
                });
                markReminderSent(task.id, task.user_id, 'overdue', today);
                console.log(`[REMINDER] 📤 SÜRESİ GEÇMİŞ bildirimi gönderildi: userId=${task.user_id}, görev="${task.title}"`);
            }
        }

        // Eski reminder kayıtlarını temizle
        cleanOldReminders();

        console.log(`[REMINDER] ✅ Deadline hatırlatma kontrolü tamamlandı.`);
        logger.info(`Deadline hatırlatma kontrolü tamamlandı. Bugün: ${todayTasks.length}, Yarın: ${tomorrowTasks.length}, Gecikmiş: ${overdueTasks.length}`);

    } catch (error) {
        console.error('[REMINDER] ❌ Deadline hatırlatma hatası:', error);
        logger.error('Deadline hatırlatma hatası:', error);
    }
}

/**
 * Zamanlayıcıyı başlat
 * - Her gün saat 08:00'da çalışır (sabah hatırlatma)
 * - Her gün saat 20:00'da çalışır (akşam hatırlatma)
 */
function startDeadlineReminders() {
    // Tabloyu oluştur
    initReminderTable();

    // Her gün sabah 08:00
    cron.schedule('0 8 * * *', () => {
        console.log('[REMINDER] 🌅 Sabah hatırlatma kontrolü tetiklendi.');
        checkDeadlineReminders();
    }, {
        timezone: 'Europe/Istanbul'
    });

    // Her gün akşam 20:00
    cron.schedule('0 20 * * *', () => {
        console.log('[REMINDER] 🌙 Akşam hatırlatma kontrolü tetiklendi.');
        checkDeadlineReminders();
    }, {
        timezone: 'Europe/Istanbul'
    });

    console.log('[REMINDER] ✅ Deadline hatırlatma sistemi başlatıldı (08:00 ve 20:00)');
    logger.info('Deadline hatırlatma sistemi başlatıldı (08:00 ve 20:00)');
}

module.exports = { startDeadlineReminders, checkDeadlineReminders };
