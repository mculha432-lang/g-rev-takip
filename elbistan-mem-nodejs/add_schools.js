const Database = require('better-sqlite3');
const path = require('path');

// Veritabanı bağlantısı
const db = new Database(path.join(__dirname, 'database', 'elbistan_mem.db'));

// Anaokulları
const anaokulları = ['763090', '974708', '963637', '763919', '752553', '974619', '766706', '768787', '99993165'];

// İlkokullar
const ilkokullar = [
    '732190', '732213', '732245', '732191', '732195', '732199', '732202', '732203', '732184', '763934',
    '732249', '732113', '732209', '732320', '735524', '732324', '732337', '735526', '732344', '732348',
    '732351', '732356', '735527', '732358', '732361', '732363', '735529', '733075', '733077', '735531',
    '733079', '733081', '733083', '746112', '733087', '732186', '733089', '733091', '733093', '733096',
    '732524', '760528', '733098', '733100', '776826', '99982583', '99911965'
];

// Ortaokullar
const ortaokullar = [
    '732353', '732357', '732362', '732365', '765549', '733088', '747761', '733076', '733078', '733080',
    '733082', '733084', '733085', '733090', '765550', '733092', '733094', '767508', '733097', '732527',
    '760527', '733099', '733101', '776827', '99987185', '99982584', '99952675'
];

// Liseler
const liseler = [
    '963235', '766011', '184851', '184875', '218407', '760908', '758130', '973801', '184838', '750996',
    '765851', '184863', '746987', '762822', '966841', '769127', '99987685', '99987184', '99948856',
    '99987177', '99975291', '99991277'
];

// Diğer Kurumlar
const digerKurumlar = ['763277', '184887', '336225', '774655', '773484', '958573', '971311'];

console.log('📋 Okul türleri güncelleniyor...\n');

// Anaokulları güncelle
anaokulları.forEach(kod => {
    db.prepare('UPDATE users SET school_type = ? WHERE username = ?').run('anaokulu', kod);
});
console.log(`✅ ${anaokulları.length} Anaokulu güncellendi.`);

// İlkokullar güncelle
ilkokullar.forEach(kod => {
    db.prepare('UPDATE users SET school_type = ? WHERE username = ?').run('ilkokul', kod);
});
console.log(`✅ ${ilkokullar.length} İlkokul güncellendi.`);

// Ortaokullar güncelle
ortaokullar.forEach(kod => {
    db.prepare('UPDATE users SET school_type = ? WHERE username = ?').run('ortaokul', kod);
});
console.log(`✅ ${ortaokullar.length} Ortaokul güncellendi.`);

// Liseler güncelle
liseler.forEach(kod => {
    db.prepare('UPDATE users SET school_type = ? WHERE username = ?').run('lise', kod);
});
console.log(`✅ ${liseler.length} Lise güncellendi.`);

// Diğer kurumlar güncelle
digerKurumlar.forEach(kod => {
    db.prepare('UPDATE users SET school_type = ? WHERE username = ?').run('diger', kod);
});
console.log(`✅ ${digerKurumlar.length} Diğer kurum güncellendi.`);

console.log('\n────────────────────────────────');
console.log('🎉 Tüm okul türleri başarıyla güncellendi!');
console.log('────────────────────────────────');

// Özet göster
const ozet = db.prepare(`
    SELECT school_type, COUNT(*) as sayi 
    FROM users 
    WHERE role = 'school' 
    GROUP BY school_type
`).all();

console.log('\n📊 Kurum Dağılımı:');
ozet.forEach(row => {
    const tip = row.school_type || 'belirsiz';
    console.log(`   ${tip}: ${row.sayi} kurum`);
});

db.close();
