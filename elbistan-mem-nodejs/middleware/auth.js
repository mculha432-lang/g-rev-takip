// Oturum kontrolü - Giriş yapılmış mı?
function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    res.redirect('/login');
}

// Sadece admin kullanıcılar için
function isAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    res.redirect('/login');
}

// Admin VEYA Kurum Yöneticisi (is_manager) için
function isAdminOrManager(req, res, next) {
    if (req.session && req.session.user) {
        if (req.session.user.role === 'admin' || req.session.user.is_manager === 1) {
            return next();
        }
    }
    res.redirect('/login');
}

// Sadece Şef kullanıcılar için
function isSef(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'sef') {
        return next();
    }
    res.redirect('/login');
}

// Admin VEYA Şef için
function isAdminOrSef(req, res, next) {
    if (req.session && req.session.user) {
        if (req.session.user.role === 'admin' || req.session.user.role === 'sef') {
            return next();
        }
    }
    res.redirect('/login');
}

// Sadece okul kullanıcılar için
function isSchool(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'school') {
        // Kurum yöneticisi değilse normal okul paneline git
        if (!req.session.user.is_manager) {
            return next();
        }
        // Kurum yöneticisi ise admin paneline yönlendir
        return res.redirect('/admin/dashboard');
    }
    res.redirect('/login');
}

module.exports = {
    isAuthenticated,
    isAdmin,
    isAdminOrManager,
    isSef,
    isAdminOrSef,
    isSchool
};
