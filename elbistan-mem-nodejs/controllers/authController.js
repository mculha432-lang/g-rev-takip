const db = require('../config/database');
const bcrypt = require('bcryptjs');

const authController = {
    // Giriş Sayfası
    loginPage: (req, res) => {
        // Zaten giriş yapmışsa yönlendir
        if (req.session.user) {
            if (req.session.user.role === 'admin') {
                return res.redirect('/admin/dashboard');
            } else {
                return res.redirect('/okul/dashboard');
            }
        }
        res.render('login', {
            title: 'Giriş',
            error: null
        });
    },

    // Giriş İşlemi
    login: (req, res) => {
        const { username, password } = req.body;

        try {
            // Kullanıcıyı veritabanında ara
            const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

            if (!user) {
                return res.render('login', {
                    title: 'Giriş',
                    error: 'Hatalı Kurum Kodu veya Şifre!'
                });
            }

            // Şifre kontrolü (bcrypt hash veya düz şifre)
            let passwordValid = false;

            // Önce bcrypt ile dene
            if (user.password.startsWith('$2')) {
                passwordValid = bcrypt.compareSync(password, user.password);
            } else {
                // Düz şifre kontrolü (eski veriler için)
                passwordValid = (password === user.password);
            }

            if (!passwordValid) {
                return res.render('login', {
                    title: 'Giriş',
                    error: 'Hatalı Kurum Kodu veya Şifre!'
                });
            }

            // Session'a kullanıcı bilgilerini kaydet
            req.session.user = {
                id: user.id,
                username: user.username,
                full_name: user.full_name || user.username,
                role: user.role,
                school_type: user.school_type,
                is_manager: user.is_manager || 0
            };

            // Log kaydı ekle
            try {
                const ip = req.ip || req.connection.remoteAddress;
                db.prepare('INSERT INTO logs (user_id, action, ip_address) VALUES (?, ?, ?)').run(
                    user.id, 'Giriş Yaptı', ip
                );
            } catch (e) {
                console.log('Log kaydı eklenemedi:', e.message);
            }

            // Role göre yönlendir
            if (user.role === 'admin') {
                res.redirect('/admin/dashboard');
            } else if (user.is_manager === 1) {
                // Kurum yöneticileri admin paneline erişir
                res.redirect('/admin/dashboard');
            } else {
                res.redirect('/okul/dashboard');
            }

        } catch (error) {
            console.error('Giriş hatası:', error);
            res.render('login', {
                title: 'Giriş',
                error: 'Bir hata oluştu. Lütfen tekrar deneyin.'
            });
        }
    },

    // Çıkış İşlemi
    logout: (req, res) => {
        // Çıkış log kaydı
        try {
            if (req.session && req.session.user) {
                const ip = req.ip || req.connection.remoteAddress;
                db.prepare('INSERT INTO logs (user_id, action, ip_address) VALUES (?, ?, ?)').run(
                    req.session.user.id, 'Çıkış Yaptı', ip
                );
            }
        } catch (e) {
            console.log('Çıkış log kaydı eklenemedi:', e.message);
        }

        req.session.destroy((err) => {
            if (err) {
                console.error('Oturum kapatma hatası:', err);
            }
            res.redirect('/login');
        });
    }
};

module.exports = authController;
