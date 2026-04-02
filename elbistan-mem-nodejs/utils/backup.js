const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const AdmZip = require('adm-zip');

// Yedekleme dizini
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const DB_PATH = path.join(__dirname, '..', 'database', 'elbistan_mem.db');
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');

// Kaç yedek tutulacak (varsayılan: 7 gün)
const MAX_BACKUPS = 7;

// Yedekleme dizinini oluştur
function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
}

// Veritabanı ve Dosyaları yedekle (ZIP)
function backupDatabase() {
    try {
        ensureBackupDir();

        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupFileName = `backup_${timestamp}.zip`;
        const backupPath = path.join(BACKUP_DIR, backupFileName);

        const zip = new AdmZip();

        // 1. Veritabanını ekle
        if (fs.existsSync(DB_PATH)) {
            zip.addLocalFile(DB_PATH);
        } else {
            console.warn('⚠️ Uyarı: Yedeklenecek veritabanı bulunamadı.');
        }

        // 2. Yüklenen dosyaları ekle
        if (fs.existsSync(UPLOADS_DIR)) {
            zip.addLocalFolder(UPLOADS_DIR, 'uploads');
        } else {
            console.warn('⚠️ Uyarı: Uploads klasörü bulunamadı, boş geçiliyor.');
        }

        // 3. Dosyayı kaydet
        zip.writeZip(backupPath);

        console.log(`✓ Sistem yedeklendi (DB + Dosyalar): ${backupFileName}`);

        // Eski yedekleri temizle
        cleanOldBackups();

        return {
            success: true,
            file: backupFileName,
            path: backupPath,
            timestamp: now
        };
    } catch (error) {
        console.error('Yedekleme hatası:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Eski yedekleri temizle
function cleanOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('backup_') && f.endsWith('.zip'))
            .map(f => ({
                name: f,
                path: path.join(BACKUP_DIR, f),
                time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // En yeniden eskiye sırala

        // MAX_BACKUPS'tan fazlasını sil
        if (files.length > MAX_BACKUPS) {
            const toDelete = files.slice(MAX_BACKUPS);
            toDelete.forEach(file => {
                fs.unlinkSync(file.path);
                console.log(`✓ Eski yedek silindi: ${file.name}`);
            });
        }
    } catch (error) {
        console.error('Eski yedek temizleme hatası:', error);
    }
}

// Tüm yedekleri listele
function listBackups() {
    try {
        ensureBackupDir();

        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('backup_') && (f.endsWith('.zip') || f.endsWith('.db'))) // Eski .db'leri de göster
            .map(f => {
                const stats = fs.statSync(path.join(BACKUP_DIR, f));
                return {
                    name: f,
                    size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                    date: stats.mtime
                };
            })
            .sort((a, b) => b.date - a.date);

        return files;
    } catch (error) {
        console.error('Yedek listeleme hatası:', error);
        return [];
    }
}

// Yedeği geri yükle
function restoreBackup(backupFileName) {
    try {
        // Path traversal koruması - sadece güvenli dosya adlarına izin ver
        const safeName = path.basename(backupFileName);
        if (!/^(backup_[\w\-]+\.(zip|db)|pre_restore_\d+\.db)$/.test(safeName)) {
            return { success: false, error: 'Geçersiz yedek dosya adı' };
        }

        const backupPath = path.join(BACKUP_DIR, safeName);

        if (!fs.existsSync(backupPath)) {
            return { success: false, error: 'Yedek dosyası bulunamadı' };
        }

        // Önce mevcut veritabanını güvenlik amacıyla yedekle
        const preRestoreBackup = `pre_restore_${Date.now()}.db`;
        fs.copyFileSync(DB_PATH, path.join(BACKUP_DIR, preRestoreBackup));

        if (backupFileName.endsWith('.zip')) {
            // ZIP'ten sadece veritabanını çıkar ve geri yükle
            const zip = new AdmZip(backupPath);
            zip.extractEntryTo("elbistan_mem.db", path.dirname(DB_PATH), false, true);
            console.log(`✓ Veritabanı ZIP içinden geri yüklendi: ${backupFileName}`);
            console.log(`ℹ️ Not: Dosyalar manuel olarak geri yüklenmelidir (ZIP içindeki 'uploads' klasörü).`);
        } else {
            // Eski .db formatı desteği
            fs.copyFileSync(backupPath, DB_PATH);
            console.log(`✓ Veritabanı (.db) geri yüklendi: ${backupFileName}`);
        }

        return {
            success: true,
            restoredFrom: backupFileName,
            preRestoreBackup: preRestoreBackup,
            message: backupFileName.endsWith('.zip') ? 'Veritabanı başarıyla yüklendi. Dosyalar ZIP içinden manuel alınmalıdır.' : 'Başarıyla yüklendi.'
        };
    } catch (error) {
        console.error('Geri yükleme hatası:', error);
        return { success: false, error: error.message };
    }
}

// Otomatik yedekleme zamanlayıcısını başlat
function startAutoBackup(schedule = '0 3 * * *') {
    // Varsayılan: Her gece saat 03:00'da
    cron.schedule(schedule, () => {
        console.log('\n📦 Otomatik yedekleme başlatılıyor...');
        backupDatabase();
    });

    console.log('✓ Otomatik yedekleme aktif (Her gece 03:00)');
}

// Sunucu başladığında ilk yedeği al
function initialBackup() {
    console.log('📦 Başlangıç yedeği alınıyor...');
    return backupDatabase();
}

module.exports = {
    backupDatabase,
    listBackups,
    restoreBackup,
    startAutoBackup,
    initialBackup,
    cleanOldBackups,
    BACKUP_DIR,
    MAX_BACKUPS
};

