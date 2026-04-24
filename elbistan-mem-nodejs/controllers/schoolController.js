const db = require('../config/database');
const bcrypt = require('bcryptjs');

const schoolController = {
    // Okul Listesi
    index: (req, res) => {
        try {
            // Filtreleme parametrelerini al
            const { type, search, has_pension, has_canteen } = req.query;
            let sql = "SELECT * FROM users WHERE role = 'school'";
            let params = [];

            // Arama filtresi (sanitize edilmiş)
            if (search) {
                const sanitizedSearch = search.replace(/[<>"';\\]/g, '').trim().substring(0, 100);
                if (sanitizedSearch) {
                    sql += " AND (full_name LIKE ? OR username LIKE ?)";
                    params.push(`%${sanitizedSearch}%`, `%${sanitizedSearch}%`);
                }
            }

            // Tür filtresi
            if (type && type !== 'all') {
                sql += " AND school_type = ?";
                params.push(type);
            }

            // Pansiyon filtresi
            if (has_pension === '1') {
                sql += " AND has_pension = 1";
            }

            // Kantin filtresi
            if (has_canteen === '1') {
                sql += " AND has_canteen = 1";
            }

            sql += " ORDER BY id DESC";

            const schools = db.prepare(sql).all(...params);

            res.render('admin/schools', {
                title: 'Okul Yönetimi',
                activePage: 'schools',
                schools,
                status: req.query.status || null,
                editSchool: null,
                filters: req.query // Filtreleri view'a geri gönder
            });
        } catch (error) {
            console.error('Okul listesi hatası:', error);
            res.status(500).send('Bir hata oluştu');
        }
    },

    // Okul Ekle
    store: (req, res) => {
        try {
            const { username, full_name, password, school_type } = req.body;
            // Checkbox'lar "on" veya undefined gelir, bunu 1 veya 0'a çevir
            const has_pension = req.body.has_pension ? 1 : 0;
            const has_canteen = req.body.has_canteen ? 1 : 0;

            // Kullanıcı adı kontrolü
            const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
            if (existing) {
                return res.redirect('/admin/schools?status=exists');
            }

            // Şifreyi hashle
            const hashedPassword = bcrypt.hashSync(password, 10);

            db.prepare(`
                INSERT INTO users (username, full_name, password, role, school_type, has_pension, has_canteen) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(username, full_name, hashedPassword, 'school', school_type, has_pension, has_canteen);

            res.redirect('/admin/schools?status=success');
        } catch (error) {
            console.error('Okul ekleme hatası:', error);
            res.redirect('/admin/schools?status=error');
        }
    },

    // Okul Düzenle - Form
    edit: (req, res) => {
        try {
            const { id } = req.params;
            const school = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'school'").get(id);

            if (!school) {
                return res.redirect('/admin/schools?status=not_found');
            }

            // Düzenleme modunda listeyi yine getiriyoruz ki altta liste görünsün
            const schools = db.prepare("SELECT * FROM users WHERE role = 'school' ORDER BY id DESC").all();

            res.render('admin/schools', {
                title: 'Okul Yönetimi',
                activePage: 'schools',
                schools,
                status: null,
                editSchool: school,
                filters: {}
            });
        } catch (error) {
            console.error('Okul düzenleme hatası:', error);
            res.redirect('/admin/schools?status=error');
        }
    },

    // Okul Güncelle
    update: (req, res) => {
        try {
            const { id } = req.params;
            const { username, full_name, password, school_type } = req.body;
            const has_pension = req.body.has_pension ? 1 : 0;
            const has_canteen = req.body.has_canteen ? 1 : 0;

            // Mevcut okulu kontrol et
            const school = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'school'").get(id);
            if (!school) {
                return res.redirect('/admin/schools?status=not_found');
            }

            // Kullanıcı adı değiştiyse kontrol et
            if (username !== school.username) {
                const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, id);
                if (existing) {
                    return res.redirect('/admin/schools?status=exists');
                }
            }

            // Şifre değiştiyse
            if (password && password.trim() !== '') {
                const hashedPassword = bcrypt.hashSync(password, 10);
                db.prepare(`
                    UPDATE users 
                    SET username = ?, full_name = ?, password = ?, school_type = ?, has_pension = ?, has_canteen = ?
                    WHERE id = ? AND role = 'school'
                `).run(username, full_name, hashedPassword, school_type, has_pension, has_canteen, id);
            } else {
                db.prepare(`
                    UPDATE users 
                    SET username = ?, full_name = ?, school_type = ?, has_pension = ?, has_canteen = ?
                    WHERE id = ? AND role = 'school'
                `).run(username, full_name, school_type, has_pension, has_canteen, id);
            }

            res.redirect('/admin/schools?status=updated');
        } catch (error) {
            console.error('Okul güncelleme hatası:', error);
            res.redirect('/admin/schools?status=error');
        }
    },

    // Okul Sil
    delete: (req, res) => {
        try {
            const { id } = req.params;
            db.prepare("DELETE FROM users WHERE id = ? AND role = 'school'").run(id);
            res.redirect('/admin/schools?status=deleted');
        } catch (error) {
            console.error('Okul silme hatası:', error);
            res.redirect('/admin/schools?status=error');
        }
    },

    // Kurum Yöneticisi Yap / Kaldır
    toggleManager: (req, res) => {
        try {
            const { id } = req.params;
            const school = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'school'").get(id);

            if (!school) {
                return res.redirect('/admin/schools?status=not_found');
            }

            const newManagerStatus = school.is_manager === 1 ? 0 : 1;
            db.prepare('UPDATE users SET is_manager = ? WHERE id = ?').run(newManagerStatus, id);

            if (newManagerStatus === 1) {
                res.redirect('/admin/schools?status=manager_granted');
            } else {
                res.redirect('/admin/schools?status=manager_revoked');
            }
        } catch (error) {
            console.error('Yönetici yetkilendirme hatası:', error);
            res.redirect('/admin/schools?status=error');
        }
    },

    // Şifre Sıfırla (Kurum Kodunu şifre yapar)
    // Load detsis mapping once (cached)
    const _loadDetMap = (() => {
        const fs = require('fs');
        const path = require('path');
        const content = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'seed_all_schools.js'), 'utf8');
        const regex = /\[\s*['"](\d+[-\d]*)['"]\s*,\s*['"](\d+)['"]\]/g;
        const map = {};
        let match;
        while ((match = regex.exec(content)) !== null) {
            map[match[1]] = match[2];
        }
        return map;
    })();

    resetPassword: (req, res) => {
        try {
            const { id } = req.params;
            const school = db.prepare("SELECT username FROM users WHERE id = ? AND role = 'school'").get(id);

            if (!school) {
                return res.redirect('/admin/schools?status=not_found');
            }

            // Use detsis code if available, otherwise fallback to username
            const detsis = _loadDetMap[school.username] || school.username;
            const newPassword = bcrypt.hashSync(detsis, 10);
            db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newPassword, id);

            res.redirect('/admin/schools?status=password_reset');
        } catch (error) {
            console.error('Şifre sıfırlama hatası:', error);
            res.redirect('/admin/schools?status=error');
        }
    }
};

module.exports = schoolController;

