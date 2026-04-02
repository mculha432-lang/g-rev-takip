const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'database', 'elbistan_mem.db'));

// Eklenecek özel kurumlar
// Kullanıcı adı = kurum kodu
// Şifre = kurum kodunun ilk rakamı eksik hali
const schools = [
    { code: '99993165', name: 'ÖZEL GÜNER ANAOKULU', type: 'anaokulu' },
    { code: '99982583', name: 'ÖZEL ELBİSTAN BAHÇEŞEHİR KOLEJİ İLKOKULU', type: 'ilkokul' },
    { code: '99911965', name: 'ÖZEL ELBİSTAN YILDIZ İLKOKULU', type: 'ilkokul' },
    { code: '99982584', name: 'ÖZEL ELBİSTAN BAHÇEŞEHİR KOLEJİ ORTAOKULU', type: 'ortaokul' },
    { code: '99987185', name: 'ÖZEL ELBİSTAN FİNAL AKADEMİ ORTAOKULU', type: 'ortaokul' },
    { code: '99952675', name: 'ÖZEL ELBİSTAN YILDIZ ORTAOKULU', type: 'ortaokul' },
    { code: '99982585', name: 'ÖZEL ELBİSTAN BAHÇEŞEHİR KOLEJİ ANADOLU LİSESİ', type: 'lise' },
    { code: '99987184', name: 'ÖZEL ELBİSTAN FİNAL AKADEMİ ANADOLU LİSESİ', type: 'lise' },
    { code: '99987685', name: 'ÖZEL ELBİSTAN BAHÇEŞEHİR KOLEJİ FEN LİSESİ', type: 'lise' },
    { code: '99987177', name: 'ÖZEL ELBİSTAN FİNAL AKADEMİ FEN LİSESİ', type: 'lise' },
    { code: '99975291', name: 'ÖZEL ELBİSTAN YILDIZ KOLEJİ FEN LİSESİ', type: 'lise' },
    { code: '99991277', name: 'ÖZEL ELBİSTAN BİLİM TEKNİK VE İNOVASYON MESLEKİ VE TEKNİK ANADOLU LİSESİ', type: 'lise' },
];

const insertStmt = db.prepare(`
    INSERT INTO users (username, full_name, password, role, school_type, has_pension, has_canteen)
    VALUES (?, ?, ?, 'school', ?, 0, 0)
`);

let added = 0;
let skipped = 0;

schools.forEach(school => {
    // Zaten var mı kontrol et
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(school.code);
    if (existing) {
        console.log(`⏭️  ATLANILDI: ${school.code} - ${school.name} (zaten mevcut)`);
        skipped++;
        return;
    }

    // Şifre = kurum kodunun ilk rakamı eksik hali
    const password = school.code.substring(1); // İlk karakteri atla
    const hashedPassword = bcrypt.hashSync(password, 10);

    insertStmt.run(school.code, school.name, hashedPassword, school.type);
    console.log(`✅ EKLENDİ: ${school.code} - ${school.name} (Şifre: ${password}, Tür: ${school.type})`);
    added++;
});

console.log('\n========================================');
console.log(`Toplam: ${schools.length} kurum`);
console.log(`Eklenen: ${added}`);
console.log(`Atlanan: ${skipped}`);

// Toplam okul sayısı
const totalSchools = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'school'").get();
console.log(`Sistemdeki toplam kurum: ${totalSchools.count}`);
console.log('========================================');

db.close();
