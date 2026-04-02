const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Veritabanı dosya yolu
const dbPath = path.join(__dirname, '..', 'database', 'elbistan_mem.db');

// Veritabanı klasörünü oluştur
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Veritabanı bağlantısı
const db = new Database(dbPath);

// WAL modu için performans
db.pragma('journal_mode = WAL');

// Tabloları oluştur
function initDatabase() {
    // Kullanıcılar tablosu
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT,
            role TEXT DEFAULT 'school',
            school_type TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Görevler tablosu
    db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            deadline DATE,
            file_path TEXT,
            requires_file INTEGER DEFAULT 0,
            allowed_file_types TEXT,
            max_file_count INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Görev atamaları tablosu
    db.exec(`
        CREATE TABLE IF NOT EXISTS task_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            is_read INTEGER DEFAULT 0,
            response_note TEXT,
            response_file TEXT,
            rejection_note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Görev yanıt dosyaları tablosu (Çoklu dosya desteği için)
    db.exec(`
        CREATE TABLE IF NOT EXISTS task_assignment_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assignment_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            original_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assignment_id) REFERENCES task_assignments(id) ON DELETE CASCADE
        )
    `);

    // Mevcut tablolara yeni sütunları ekle (eğer yoksa)
    try {
        db.exec(`ALTER TABLE tasks ADD COLUMN allowed_file_types TEXT`);
    } catch (e) {}
    try {
        db.exec(`ALTER TABLE tasks ADD COLUMN max_file_count INTEGER DEFAULT 1`);
    } catch (e) {}
    try {
        db.exec(`ALTER TABLE task_assignments ADD COLUMN rejection_note TEXT`);
    } catch (e) {}

    // Duyurular tablosu
    db.exec(`
        CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Sistem dosyaları tablosu
    db.exec(`
        CREATE TABLE IF NOT EXISTS system_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            file_path TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Loglar tablosu
    db.exec(`
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    // Görev form alanları tablosu (Google Forms benzeri)
    db.exec(`
        CREATE TABLE IF NOT EXISTS task_fields (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            field_type TEXT NOT NULL,
            field_label TEXT NOT NULL,
            field_options TEXT,
            is_required INTEGER DEFAULT 0,
            field_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )
    `);

    // Görev alan cevapları tablosu
    db.exec(`
        CREATE TABLE IF NOT EXISTS task_field_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assignment_id INTEGER NOT NULL,
            field_id INTEGER NOT NULL,
            response_value TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assignment_id) REFERENCES task_assignments(id) ON DELETE CASCADE,
            FOREIGN KEY (field_id) REFERENCES task_fields(id) ON DELETE CASCADE
        )
    `);

    // Görev Mesajları Tablosu (Kurum İçi Mesajlaşma)
    db.exec(`
        CREATE TABLE IF NOT EXISTS task_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assignment_id INTEGER NOT NULL,
            sender_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assignment_id) REFERENCES task_assignments(id) ON DELETE CASCADE,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Varsayılan admin kullanıcısını ekle
    const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    if (!adminExists) {
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        db.prepare('INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)').run(
            'admin', hashedPassword, 'Sistem Yöneticisi', 'admin'
        );
        console.log('✓ Varsayılan admin kullanıcısı oluşturuldu (admin/admin123)');
    }

    console.log('✓ Veritabanı tabloları hazır');
}

// Veritabanını başlat
initDatabase();

module.exports = db;
