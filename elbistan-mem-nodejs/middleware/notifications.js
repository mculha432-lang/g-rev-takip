/**
 * Bildirim Middleware - Okunmamış mesaj sayısını hesaplar
 * Bu middleware, her sayfada bildirim sayısını göstermek için kullanılır.
 */

const db = require('../config/database');

const notificationMiddleware = (req, res, next) => {
    try {
        // Kullanıcı giriş yapmamışsa atla
        if (!req.session || !req.session.user) {
            res.locals.unreadMessageCount = 0;
            res.locals.unreadMessages = [];
            return next();
        }

        const user = req.session.user;
        const userId = user.id;
        const userRole = user.role;

        const isManager = user.is_manager === 1;

        if (userRole === 'admin' || isManager) {
            // Admin için: Okullardan gelen okunmamış mesajlar
            // Okul mesajları = sender_id admin olmayan mesajlar
            const adminId = userId;

            // Okullardan gelen okunmamış mesaj sayısı
            const unreadCount = db.prepare(`
                SELECT COUNT(*) as count 
                FROM task_messages tm
                JOIN users u ON tm.sender_id = u.id
                WHERE u.role != 'admin' 
                AND tm.is_read = 0
            `).get().count;

            // Son 5 okunmamış mesaj detayları
            const unreadMessages = db.prepare(`
                SELECT 
                    tm.id,
                    tm.message,
                    tm.created_at,
                    tm.assignment_id,
                    u.full_name as sender_name,
                    t.id as task_id,
                    t.title as task_title
                FROM task_messages tm
                JOIN users u ON tm.sender_id = u.id
                JOIN task_assignments ta ON tm.assignment_id = ta.id
                JOIN tasks t ON ta.task_id = t.id
                WHERE u.role != 'admin' 
                AND tm.is_read = 0
                ORDER BY tm.created_at DESC
                LIMIT 5
            `).all();

            res.locals.unreadMessageCount = unreadCount;
            res.locals.unreadMessages = unreadMessages;

        } else if (userRole === 'school') {
            // Okul için: Yöneticiden gelen okunmamış mesajlar
            // Sadece bu okula atanan görevlerdeki admin mesajlarını say

            const unreadCount = db.prepare(`
                SELECT COUNT(*) as count 
                FROM task_messages tm
                JOIN task_assignments ta ON tm.assignment_id = ta.id
                JOIN users u ON tm.sender_id = u.id
                WHERE ta.user_id = ? 
                AND u.role = 'admin'
                AND tm.is_read = 0
            `).get(userId).count;

            // Son 5 okunmamış mesaj detayları
            const unreadMessages = db.prepare(`
                SELECT 
                    tm.id,
                    tm.message,
                    tm.created_at,
                    tm.assignment_id,
                    u.full_name as sender_name,
                    t.id as task_id,
                    t.title as task_title
                FROM task_messages tm
                JOIN task_assignments ta ON tm.assignment_id = ta.id
                JOIN users u ON tm.sender_id = u.id
                JOIN tasks t ON ta.task_id = t.id
                WHERE ta.user_id = ? 
                AND u.role = 'admin'
                AND tm.is_read = 0
                ORDER BY tm.created_at DESC
                LIMIT 5
            `).all(userId);

            res.locals.unreadMessageCount = unreadCount;
            res.locals.unreadMessages = unreadMessages;

        } else {
            res.locals.unreadMessageCount = 0;
            res.locals.unreadMessages = [];
        }

    } catch (error) {
        console.error('Bildirim middleware hatası:', error);
        res.locals.unreadMessageCount = 0;
        res.locals.unreadMessages = [];
    }

    next();
};

module.exports = notificationMiddleware;
