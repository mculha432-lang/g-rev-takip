const { body, param, query, validationResult } = require('express-validator');

// Validasyon hatalarını kontrol eden middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // AJAX istekleri için JSON yanıt
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(400).json({ errors: errors.array() });
        }
        // Normal istekler için flash mesaj ve yönlendirme
        req.session.validationErrors = errors.array();
        return res.redirect('back');
    }
    next();
};

// Yaygın validasyon kuralları
const rules = {
    // Kullanıcı adı validasyonu
    username: body('username')
        .trim()
        .notEmpty().withMessage('Kullanıcı adı gereklidir')
        .isLength({ min: 3, max: 50 }).withMessage('Kullanıcı adı 3-50 karakter olmalıdır')
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir'),

    // Şifre validasyonu
    password: body('password')
        .notEmpty().withMessage('Şifre gereklidir')
        .isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalıdır'),

    // Opsiyonel şifre (güncelleme için)
    passwordOptional: body('password')
        .optional({ checkFalsy: true })
        .isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalıdır'),

    // Tam isim validasyonu
    fullName: body('full_name')
        .trim()
        .notEmpty().withMessage('Kurum adı gereklidir')
        .isLength({ min: 2, max: 200 }).withMessage('Kurum adı 2-200 karakter olmalıdır'),

    // Görev başlığı
    taskTitle: body('title')
        .trim()
        .notEmpty().withMessage('Görev başlığı gereklidir')
        .isLength({ min: 3, max: 200 }).withMessage('Başlık 3-200 karakter olmalıdır'),

    // Görev açıklaması
    taskDescription: body('description')
        .optional()
        .trim()
        .isLength({ max: 5000 }).withMessage('Açıklama en fazla 5000 karakter olabilir'),

    // Tarih validasyonu
    deadline: body('deadline')
        .notEmpty().withMessage('Teslim tarihi gereklidir')
        .isISO8601().withMessage('Geçerli bir tarih formatı kullanın')
        .toDate(),

    // ID parametresi
    idParam: param('id')
        .isInt({ min: 1 }).withMessage('Geçersiz ID'),

    // Okul türü
    schoolType: body('school_type')
        .optional()
        .isIn(['anaokulu', 'ilkokul', 'ortaokul', 'lise', 'diger']).withMessage('Geçersiz okul türü'),

    // Duyuru başlığı
    announcementTitle: body('title')
        .trim()
        .notEmpty().withMessage('Duyuru başlığı gereklidir')
        .isLength({ min: 2, max: 200 }).withMessage('Başlık 2-200 karakter olmalıdır'),

    // Arama sorgusu
    searchQuery: query('search')
        .optional()
        .trim()
        .escape()
        .isLength({ max: 100 }).withMessage('Arama sorgusu çok uzun')
};

// Validasyon setleri
const validationSets = {
    // Login validasyonu
    login: [
        body('username').trim().notEmpty().withMessage('Kullanıcı adı gereklidir'),
        body('password').notEmpty().withMessage('Şifre gereklidir'),
        validate
    ],

    // Okul ekleme
    createSchool: [
        rules.username,
        rules.fullName,
        rules.password,
        rules.schoolType,
        validate
    ],

    // Okul güncelleme
    updateSchool: [
        rules.idParam,
        rules.username,
        rules.fullName,
        rules.passwordOptional,
        rules.schoolType,
        validate
    ],

    // Görev ekleme
    createTask: [
        rules.taskTitle,
        rules.taskDescription,
        rules.deadline,
        validate
    ],

    // Görev güncelleme
    updateTask: [
        rules.idParam,
        rules.taskTitle,
        rules.taskDescription,
        rules.deadline,
        validate
    ],

    // Duyuru ekleme
    createAnnouncement: [
        rules.announcementTitle,
        validate
    ],

    // Şifre değiştirme
    changePassword: [
        body('current_password').notEmpty().withMessage('Mevcut şifre gereklidir'),
        body('new_password')
            .notEmpty().withMessage('Yeni şifre gereklidir')
            .isLength({ min: 6 }).withMessage('Yeni şifre en az 6 karakter olmalıdır'),
        body('confirm_password')
            .notEmpty().withMessage('Şifre onayı gereklidir')
            .custom((value, { req }) => {
                if (value !== req.body.new_password) {
                    throw new Error('Şifreler eşleşmiyor');
                }
                return true;
            }),
        validate
    ],

    // ID parametresi validasyonu
    validateId: [
        rules.idParam,
        validate
    ]
};

module.exports = {
    validate,
    rules,
    ...validationSets
};
