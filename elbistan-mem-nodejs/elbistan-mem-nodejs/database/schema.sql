-- Elbistan İlçe MEM Görev Takip Sistemi - SQLite Şeması

-- Kullanıcılar (Admin ve Okullar)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'school',
    school_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Görevler
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    deadline DATE,
    file_path TEXT,
    requires_file INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Görev Atamaları (Okul-Görev İlişkisi)
CREATE TABLE IF NOT EXISTS task_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    is_read INTEGER DEFAULT 0,
    response_note TEXT,
    response_file TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Duyurular
CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sistem Dosyaları
CREATE TABLE IF NOT EXISTS system_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Giriş Logları
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Varsayılan Admin Kullanıcısı (Şifre: admin123)
INSERT OR IGNORE INTO users (username, password, full_name, role) 
VALUES ('admin', '$2a$10$rQZ8K8Y8Y8Y8Y8Y8Y8Y8YOeQZ8K8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8', 'Sistem Yöneticisi', 'admin');
