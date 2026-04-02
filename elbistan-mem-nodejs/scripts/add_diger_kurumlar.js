const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'database', 'elbistan_mem.db'));

// Eklenecek kurumlar
// Şifre = kurum kodunun ilk rakamı eksik hali
// Özel Yurtlar → has_pension = 1
const schools = [
    // Rehabilitasyon Merkezleri
    { code: '99955964', name: 'ÖZEL ELBİSTAN DESTEK ÖZEL EĞİTİM VE REHABİLİTASYON MERKEZİ', type: 'rehabilitasyon', pension: 0, canteen: 0 },
    { code: '99923789', name: 'ÖZEL GELİŞEN SEMBOL ÖZEL EĞİTİM VE REHABİLİTASYON MERKEZİ', type: 'rehabilitasyon', pension: 0, canteen: 0 },
    { code: '99974514', name: 'ÖZEL YENİ HAYAT ÖZEL EĞİTİM VE REHABİLİTASYON MERKEZİ', type: 'rehabilitasyon', pension: 0, canteen: 0 },

    // Motorlu Taşıt Sürücüleri Kursları
    { code: '99944681', name: 'ÖZEL CANLAR MOTORLU TAŞIT SÜRÜCÜLERİ KURSU', type: 'surucu_kursu', pension: 0, canteen: 0 },
    { code: '99956897', name: 'ÖZEL DENİZ MOTORLU TAŞIT SÜRÜCÜLERİ KURSU', type: 'surucu_kursu', pension: 0, canteen: 0 },
    { code: '99940582', name: 'ÖZEL ELBİSTAN FEZA MOTORLU TAŞIT SÜRÜCÜLERİ KURSU', type: 'surucu_kursu', pension: 0, canteen: 0 },
    { code: '99940369', name: 'ÖZEL ELBİSTAN MODERİN FEN MOTORLU TAŞIT SÜRÜCÜLERİ KURSU', type: 'surucu_kursu', pension: 0, canteen: 0 },
    { code: '99942518', name: 'ÖZEL ELBİSTAN MOTORLU TAŞIT SÜRÜCÜLERİ KURSU', type: 'surucu_kursu', pension: 0, canteen: 0 },
    { code: '99947746', name: 'ÖZEL ELBİSTAN UĞURLU MOTORLU TAŞIT SÜRÜCÜLERİ KURSU', type: 'surucu_kursu', pension: 0, canteen: 0 },
    { code: '99968797', name: 'ÖZEL GÜÇLÜ ŞARDAĞI MOTORLU TAŞIT SÜRÜCÜLERİ KURSU', type: 'surucu_kursu', pension: 0, canteen: 0 },
    { code: '99942797', name: 'ÖZEL LİDER VİZYON MOTORLU TAŞIT SÜRÜCÜLERİ KURSU', type: 'surucu_kursu', pension: 0, canteen: 0 },
    { code: '99951133', name: 'ÖZEL ÖZEN ÖZ ŞAHİNLER MOTORLU TAŞIT SÜRÜCÜLERİ KURSU', type: 'surucu_kursu', pension: 0, canteen: 0 },

    // Muhtelif Kurslar
    { code: '99998610', name: 'ÖZEL ALFA1 KİŞİSEL GELİŞİM KURSU', type: 'kurs', pension: 0, canteen: 0 },
    { code: '99993126', name: 'ÖZEL ELBİSTAN AMERİKAN KÜLTÜR YABANCI DİL KURSU', type: 'kurs', pension: 0, canteen: 0 },
    { code: '99976022', name: 'ÖZEL ELBİSTAN ULAŞTIRMA HİZMETLERİ MESLEKİ EĞİTİM VE GELİŞTİRME KURSU', type: 'kurs', pension: 0, canteen: 0 },

    // Özel Öğretim Kursları
    { code: '99916510', name: 'ÖZEL ELBİSTAN BAŞARI ÖZEL ÖĞRETİM KURSU', type: 'kurs', pension: 0, canteen: 0 },
    { code: '99925015', name: 'ÖZEL ELBİSTAN BEYAZ KALEM ÖZEL ÖĞRETİM KURSU', type: 'kurs', pension: 0, canteen: 0 },
    { code: '99992438', name: 'ÖZEL ELBİSTAN DÖRT İŞLEM ÖZEL ÖĞRETİM KURSU', type: 'kurs', pension: 0, canteen: 0 },
    { code: '99972333', name: 'ÖZEL ELBİSTAN FİNAL ÖZEL ÖĞRETİM KURSU', type: 'kurs', pension: 0, canteen: 0 },
    { code: '99918487', name: 'ÖZEL ELBİSTAN KARİYERİM ÖZEL ÖĞRETİM KURSU', type: 'kurs', pension: 0, canteen: 0 },
    { code: '99927091', name: 'ÖZEL ELBİSTAN KÜLTÜR ÖZEL ÖĞRETİM KURSU', type: 'kurs', pension: 0, canteen: 0 },
    { code: '99925435', name: 'ÖZEL ELBİSTAN PİRAMİT AKADEMİ FEN BİLİMLERİ ÖZEL ÖĞRETİM KURSU', type: 'kurs', pension: 0, canteen: 0 },
    { code: '99916747', name: 'ÖZEL ELBİSTAN PRATİK HAFIZA ÖZEL ÖĞRETİM KURSU', type: 'kurs', pension: 0, canteen: 0 },

    // Özel Yurtlar (pansiyon = 1)
    { code: '99966819', name: 'ÖZEL FATİH ORTAOKUL ERKEK ÖĞRENCİ YURDU', type: 'yurt', pension: 1, canteen: 0 },
    { code: '99991318', name: 'ÖZEL GÜNEŞLİ ORTAÖĞRETİM ERKEK ÖĞRENCİ YURDU', type: 'yurt', pension: 1, canteen: 0 },
    { code: '99992032', name: 'ÖZEL ORHANGAZİ ORTAOKUL ERKEK ÖĞRENCİ YURDU', type: 'yurt', pension: 1, canteen: 0 },
    { code: '99997672', name: 'ÖZEL PINARBAŞI ORTAOKUL KIZ ÖĞRENCİ YURDU', type: 'yurt', pension: 1, canteen: 0 },

    // Sosyal Etkinlik Merkezi
    { code: '99939392', name: 'ÖZEL NOVA AKADEMİ SOSYAL ETKİNLİK VE GELİŞİM MERKEZİ', type: 'diger', pension: 0, canteen: 0 },
];

const insertStmt = db.prepare(`
    INSERT INTO users (username, full_name, password, role, school_type, has_pension, has_canteen)
    VALUES (?, ?, ?, 'school', ?, ?, ?)
`);

let added = 0;
let skipped = 0;

schools.forEach(school => {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(school.code);
    if (existing) {
        console.log(`⏭️  ATLANILDI: ${school.code} - ${school.name} (zaten mevcut)`);
        skipped++;
        return;
    }

    // Şifre = kurum kodunun ilk rakamı eksik hali
    const password = school.code.substring(1);
    const hashedPassword = bcrypt.hashSync(password, 10);

    insertStmt.run(school.code, school.name, hashedPassword, school.type, school.pension, school.canteen);

    let extras = [];
    if (school.pension) extras.push('🏨 Pansiyon');
    console.log(`✅ EKLENDİ: ${school.code} - ${school.name} (Şifre: ${password}, Tür: ${school.type}${extras.length ? ', ' + extras.join(', ') : ''})`);
    added++;
});

console.log('\n========================================');
console.log(`Toplam: ${schools.length} kurum`);
console.log(`Eklenen: ${added}`);
console.log(`Atlanan: ${skipped}`);

// Tür bazlı dağılım
const typeStats = db.prepare(`
    SELECT school_type, COUNT(*) as count 
    FROM users WHERE role = 'school' 
    GROUP BY school_type 
    ORDER BY count DESC
`).all();

console.log('\n📊 Kurum Türü Dağılımı:');
typeStats.forEach(row => {
    console.log(`   ${row.school_type || 'belirsiz'}: ${row.count}`);
});

const totalSchools = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'school'").get();
console.log(`\nSistemdeki toplam kurum: ${totalSchools.count}`);
console.log('========================================');

db.close();
