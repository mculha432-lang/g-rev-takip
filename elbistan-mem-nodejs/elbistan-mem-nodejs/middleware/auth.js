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

// Sadece okul kullanıcılar için
function isSchool(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'school') {
        return next();
    }
    res.redirect('/login');
}

module.exports = {
    isAuthenticated,
    isAdmin,
    isSchool
};
