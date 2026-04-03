// Environment variables yükle
require('dotenv').config();

// Timezone'u Türkiye'ye ayarla
process.env.TZ = 'Europe/Istanbul';

const express = require('express');
const session = require('express-session');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const db = require('./config/database');
const { logger, requestLogger, errorLogger } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (production'da reverse proxy arkasında çalışırken)
app.set('trust proxy', 1);

// Güvenlik Middleware - Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://npmcdn.com", "https://*"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://*"],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "https://*"],
            imgSrc: ["'self'", "data:", "blob:", "https://*"],
            connectSrc: ["'self'", "https://*"],
            upgradeInsecureRequests: null,
        },
    },
    crossOriginEmbedderPolicy: false
}));

// Rate Limiting - Brute force koruması
const loginLimiter = rateLimit({
    windowMs: (process.env.LOGIN_LIMIT_WINDOW || 15) * 60 * 1000, // Varsayılan 15 dakika
    max: process.env.LOGIN_LIMIT_MAX || 5, // Varsayılan 5 deneme
    message: `Çok fazla giriş denemesi yaptınız. Lütfen ${process.env.LOGIN_LIMIT_WINDOW || 15} dakika sonra tekrar deneyin.`,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req, res) => req.method === 'GET' // Sadece form gönderimini (POST) sınırla, sayfayı yenileyenleri bloklama
});

const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 dakika
    max: 100, // Dakikada 100 istek
    message: 'Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.',
    standardHeaders: true,
    legacyHeaders: false
});

app.use(generalLimiter);

// View Engine - EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Service Worker dosyasını ASLA önbellekleme (push bildirimlerinin güncellenmesi için kritik)
app.get('/service-worker.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, 'public', 'service-worker.js'));
});

app.use(express.static(path.join(__dirname, 'public')));

// HTTP Request Logger
app.use(requestLogger);

// Session Ayarları (Güvenli — SQLite Store ile kalıcı)
const SQLiteStore = require('connect-sqlite3')(session);

app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: path.join(__dirname, 'database'),
        concurrentDB: true
    }),
    secret: process.env.SESSION_SECRET || 'elbistan-ilce-mem-secret-key-2024-secure',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Production'da HTTPS zorunlu
        httpOnly: true, // XSS koruması
        maxAge: 24 * 60 * 60 * 1000, // 24 saat
        sameSite: 'lax' // CSRF koruması
    }
}));

// CSRF Koruması
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

// CSRF korumasını tüm POST isteklerine uygula
// Conditional CSRF Protection
const conditionalCsrf = (req, res, next) => {
    // Sadece /push route'u ve kendisi multer kullanan özel rotaları globalden atla
    // (Çünkü bu rotalarda uploadMulter çalıştıktan sonra kendi route tanımlarında csrfProtection yapılıyor)
    const isMultipartRoute = req.method === 'POST' && (
        (req.path === '/admin/tasks' || req.path.match(/^\/admin\/tasks\/[A-Za-z0-9_-]+\/update$/)) ||
        req.path.match(/^\/okul\/tasks\/[A-Za-z0-9_-]+\/response$/) ||
        req.path === '/admin/files'
    );

    if (req.path.startsWith('/push') || isMultipartRoute) {
        return next();
    }
    
    // Geçersiz content-type ile gönderilen potansiyel bypass'ları önle
    if (req.get('content-type')?.includes('multipart/form-data') && !isMultipartRoute) {
        return res.status(403).send('Bypass detected: Multipart not allowed on this route.');
    }

    csrfProtection(req, res, next);
};

app.use(conditionalCsrf);

// Middleware olarak dışa aktar (Route'larda kullanmak için)
app.set('csrfProtection', csrfProtection);

// Her istekte session ve CSRF bilgilerini view'lara aktar
app.use((req, res, next) => {
    res.locals.session = req.session;
    res.locals.user = req.session.user || null;
    res.locals.csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : '';
    res.locals.validationErrors = req.session.validationErrors || [];
    delete req.session.validationErrors; // Bir kez gösterdikten sonra sil
    next();
});

// Bildirim Middleware - Okunmamış mesaj sayısını hesaplar
const notificationMiddleware = require('./middleware/notifications');
app.use(notificationMiddleware);

// Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const schoolsRoutes = require('./routes/schools');
const tasksRoutes = require('./routes/tasks');
const schoolPanelRoutes = require('./routes/schoolPanel');

// Login rate limiter'ı sadece login POST'una uygula
app.use('/login', loginLimiter);

app.use('/', authRoutes);
app.use('/admin', adminRoutes);
app.use('/admin/schools', schoolsRoutes);
app.use('/admin/tasks', tasksRoutes);
app.use('/okul', schoolPanelRoutes);
app.use('/push', require('./routes/push'));

// Ana sayfa yönlendirmesi
app.get('/', (req, res) => {
    res.redirect('/login');
});

// 404 Sayfası
app.use((req, res) => {
    res.status(404).render('404', { title: 'Sayfa Bulunamadı' });
});

// Error Logger Middleware
app.use(errorLogger);

// Ozel CSRF hatasi (Route'lardan sonra cagrildigi icin duzgun calisir)
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        logger.warn(`CSRF token hatası: ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
        return res.status(403).render('404', {
            title: 'Güvenlik Hatası',
            message: 'Oturum süresi dolmuş veya geçersiz istek. Lütfen sayfayı yenileyerek tekrar deneyin.'
        });
    }
    next(err);
});

// Hata yakalama
app.use((err, req, res, next) => {
    logger.error('Sunucu hatası:', err);
    res.status(500).render('404', {
        title: 'Sunucu Hatası',
        message: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
    });
});

// Sunucuyu başlat
if (require.main === module) {
    app.listen(PORT, () => {
        logger.info(`Sunucu başlatıldı: http://localhost:${PORT}`);
        
        console.log(`
    ╔═══════════════════════════════════════════════════╗
    ║                                                   ║
    ║   🏫 Elbistan İlçe MEM Görev Takip Sistemi        ║
    ║   ─────────────────────────────────────           ║
    ║   Sunucu çalışıyor: http://localhost:${PORT}        ║
    ║   Admin Girişi: admin / admin123                  ║
    ║   Ortam: ${process.env.NODE_ENV || 'development'}                           ║
    ║                                                   ║
    ╚═══════════════════════════════════════════════════╝
        `);

        // Otomatik yedekleme sistemini başlat
        try {
            const backup = require('./utils/backup');
            backup.startAutoBackup(); // Her gece 03:00'da
            backup.initialBackup();   // Başlangıç yedeği al
            logger.info('Yedekleme sistemi başlatıldı');
        } catch (error) {
            logger.error('Yedekleme sistemi başlatılamadı:', error);
        }

        // Görev hatırlatma sistemini başlat
        try {
            const deadlineReminder = require('./utils/deadlineReminder');
            deadlineReminder.startDeadlineReminders();
        } catch (error) {
            logger.error('Görev hatırlatma sistemi başlatılamadı:', error);
        }
    });
}

module.exports = app;
