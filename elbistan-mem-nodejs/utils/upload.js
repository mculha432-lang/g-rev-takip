const multer = require('multer');
const path = require('path');
const fs = require('fs');

// İzin verilen dosya türleri
const ALLOWED_EXTENSIONS = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
    '.zip', '.rar', '.7z', '.tar', '.gz',
    '.txt', '.csv', '.json', '.xml',
    '.mp4', '.mov', '.avi', '.mp3', '.wav',
    '.py', '.js', '.css', '.html', '.php', '.sql'
];

// Maksimum dosya boyutu (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Upload dizinini oluştur
function ensureUploadDir(subDir) {
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads', subDir);
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    return uploadDir;
}

// Dosya filtresi
function fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`Bu dosya türü desteklenmiyor: ${ext}`), false);
    }
}

// Türkçe karakterleri temizle ve dosya adı için güvenli hale getir
function sanitizeFilename(text) {
    if (!text) return '';
    const chars = {
        'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I',
        'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U'
    };
    return text.toString()
        .replace(/[çÇğĞıİöÖşŞüÜ]/g, match => chars[match] || match)
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 100);
}

// Benzersiz dosya adı oluştur
function generateFilename(file, req, subDir) {
    const ext = path.extname(file.originalname);
    
    // Okul yanıtı ise özel isimlendirme: Okul-Gorev.ext
    if (subDir === 'responses' && req && req.params.id) {
        try {
            const db = require('../config/database');
            const assignmentId = req.params.id;
            const schoolName = req.session.user ? req.session.user.full_name : 'okul';
            
            let taskTitle = 'gorev';
            const task = db.prepare(`
                SELECT t.title 
                FROM task_assignments ta 
                JOIN tasks t ON ta.task_id = t.id 
                WHERE ta.id = ?
            `).get(assignmentId);
            
            if (task && task.title) {
                taskTitle = task.title;
            }
            
            const cleanSchool = sanitizeFilename(schoolName);
            const cleanTask = sanitizeFilename(taskTitle);
            
            // Aynı isimli dosyaların çakışmaması için kısa bir zaman damgası ekleyebiliriz
            // Ancak kullanıcı tam olarak "okul ismi ve görev ismi" dediği için sadece onları kullanıyoruz.
            // Eğer aynı okul aynı göreve tekrar dosya yüklerse üzerine yazılmış olacak.
            return `${cleanSchool}_${cleanTask}${ext}`;
        } catch (error) {
            console.error('Dosya adı oluşturma hatası:', error);
        }
    }

    // Varsayılan benzersiz dosya adı (tasks, system vb. için)
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const safeName = sanitizeFilename(file.originalname.replace(ext, ''));
    return `${timestamp}_${random}_${safeName}${ext}`;
}

// Multer storage factory
function createStorage(subDir) {
    return multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadDir = ensureUploadDir(subDir);
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            cb(null, generateFilename(file, req, subDir));
        }
    });
}

// Farklı alanlar için upload middleware'leri
const uploads = {
    // Görev dosyaları
    task: multer({
        storage: createStorage('tasks'),
        limits: { fileSize: MAX_FILE_SIZE },
        fileFilter: fileFilter
    }),

    // Okul yanıt dosyaları
    response: multer({
        storage: createStorage('responses'),
        limits: { fileSize: MAX_FILE_SIZE },
        fileFilter: fileFilter
    }),

    // Sistem dosyaları
    system: multer({
        storage: createStorage('system'),
        limits: { fileSize: MAX_FILE_SIZE },
        fileFilter: fileFilter
    })
};

// Dosya silme yardımcı fonksiyonu
function deleteFile(subDir, filename) {
    if (!filename) return false;

    const filePath = path.join(__dirname, '..', 'public', 'uploads', subDir, filename);
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
    } catch (error) {
        console.error('Dosya silme hatası:', error);
    }
    return false;
}

// Node-Clam Entegrasyonu
const NodeClam = require('clamscan');
let clamscan = null;

try {
    // ClamAV ayarlarını başlat (Sunucuda clamd çalışıyor olmalı)
    new NodeClam().init({
        removeInfected: true, // Virüslü dosyayı hemen sil
        clamdscan: {
            host: '127.0.0.1',
            port: 3310,
            timeout: 60000,
            active: true
        },
        preference: 'clamdscan'
    }).then(instance => {
        clamscan = instance;
        console.log('✅ ClamAV virüs tarama soketi aktif.');
    }).catch(err => {
        console.warn('⚠️ ClamAV başlatılamadı, virüs taraması bypass edilecek', err.message);
    });
} catch (error) {
    console.warn('⚠️ ClamAV modülü başlatılamadı:', error);
}

// Virüs tarama middleware'i
async function virusScanner(req, res, next) {
    // Eğer clamscan henüz hazır değilse işlemlere devam et (Geliştirme ortamında kesintiye uğramaması için)
    if (!clamscan) return next();

    const filesToScan = [];
    if (req.file) filesToScan.push(req.file);
    if (req.files) {
        if (Array.isArray(req.files)) {
            filesToScan.push(...req.files);
        } else {
            Object.values(req.files).forEach(fileArray => {
                filesToScan.push(...fileArray);
            });
        }
    }

    if (filesToScan.length === 0) return next();

    try {
        for (const file of filesToScan) {
            const { isInfected, viruses } = await clamscan.isInfected(file.path);
            if (isInfected) {
                console.error(`🚨 VİRÜS TESPİT EDİLDİ! Dosya: ${file.originalname}, Tehdit: ${viruses.join(', ')}`);
                // Virüslü dosya `removeInfected: true` parametresiyle zaten silinmiş olacaktır
                return res.status(400).send(`Güvenlik Uyarısı: Yüklemeye çalıştığınız dosyada zararlı yazılım (${viruses.join(', ')}) tespit edildi ve işlem iptal edildi.`);
            }
        }
        next();
    } catch (err) {
        console.error('ClamAV tarama hatası:', err);
        // Hata durumunda güvenli tarafta kalmak için yüklemeyi durdurabiliriz
        next(); // Şimdilik geliştirme evresinde hata olursa bloklamıyoruz
    }
}

module.exports = {
    uploads,
    deleteFile,
    sanitizeFilename,
    ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE,
    ensureUploadDir,
    virusScanner
};
