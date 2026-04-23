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

// Schema versiyon kontrolü
function getSchemaVersion() {
    try {
        db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL DEFAULT 0)`);
        const row = db.prepare('SELECT version FROM schema_version').get();
        if (!row) {
            db.prepare('INSERT INTO schema_version (version) VALUES (0)').run();
            return 0;
        }
        return row.version;
    } catch (e) { return 0; }
}

function setSchemaVersion(v) {
    db.prepare('UPDATE schema_version SET version = ?').run(v);
    console.log(`✓ Schema versiyonu güncellendi: v${v}`);
}

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
            is_file_mandatory INTEGER DEFAULT 1,
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

    // Çoklu dosya desteği için yeni tablo (okul yanıt dosyaları)
    db.exec(`
        CREATE TABLE IF NOT EXISTS task_assignment_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assignment_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            original_name TEXT,
            file_size INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assignment_id) REFERENCES task_assignments(id) ON DELETE CASCADE
        )
    `);

    // YENİ: Görev ekli dosyaları tablosu (yönetici tarafından yüklenen çoklu dosyalar)
    db.exec(`
        CREATE TABLE IF NOT EXISTS task_attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            original_name TEXT,
            file_size INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )
    `);

    // ─── Schema Migration'ları (versiyon kontrolü ile) ───
    const schemaVersion = getSchemaVersion();

    if (schemaVersion < 1) {
        // v1: tasks tablosuna ek sütunlar + users is_manager + rejection_note
        const migrations = [
            `ALTER TABLE tasks ADD COLUMN is_file_mandatory INTEGER DEFAULT 1`,
            `ALTER TABLE tasks ADD COLUMN allowed_file_types TEXT`,
            `ALTER TABLE tasks ADD COLUMN max_file_count INTEGER DEFAULT 1`,
            `ALTER TABLE task_assignments ADD COLUMN rejection_note TEXT`,
            `ALTER TABLE users ADD COLUMN is_manager INTEGER DEFAULT 0`
        ];
        migrations.forEach(sql => { try { db.exec(sql); } catch (e) { /* sütun zaten var */ } });
        setSchemaVersion(1);
    }

    if (schemaVersion < 2) {
        // v2: task_attachments tablosu (yönetici çoklu ek dosya desteği)
        // Tablo zaten CREATE IF NOT EXISTS ile oluşturuluyor, sadece versiyon güncellenir.
        setSchemaVersion(2);
    }

    if (schemaVersion < 3) {
        // v3: tasks tablosuna created_by kolonu (şef rolü için)
        const migrations = [
            `ALTER TABLE tasks ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL`
        ];
        migrations.forEach(sql => { try { db.exec(sql); } catch (e) { /* sütun zaten var */ } });
        
        // KRİTİK DÜZELTME: Eski (sahipsiz) görevleri Admin'e ata
        try {
            db.prepare(`
                UPDATE tasks 
                SET created_by = (SELECT id FROM users WHERE role = 'admin' LIMIT 1) 
                WHERE created_by IS NULL
            `).run();
            console.log("✓ Eski görevler Admin hesabına bağlandı.");
        } catch (e) { console.error("Görev eşitleme hatası:", e); }
        
        setSchemaVersion(3);
    }

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

    // Anlık Bildirim (Push) Abonelikleri Tablosu
    db.exec(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            endpoint TEXT UNIQUE NOT NULL,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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