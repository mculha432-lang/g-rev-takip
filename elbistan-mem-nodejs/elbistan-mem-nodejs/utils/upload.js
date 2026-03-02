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

// Benzersiz dosya adı oluştur
function generateFilename(file) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname);
    const safeName = file.originalname
        .replace(ext, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 50);
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
            cb(null, generateFilename(file));
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

module.exports = {
    uploads,
    deleteFile,
    ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE,
    ensureUploadDir
};
