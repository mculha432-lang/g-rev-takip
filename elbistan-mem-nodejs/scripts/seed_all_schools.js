const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

// Veritabanı bağlantısı
const db = new Database(path.join(__dirname, '..', 'database', 'elbistan_mem.db'));

console.log('\n════════════════════════════════════════');
console.log('  KURUM TOPLU EKLEME SCRIPTİ');
console.log('════════════════════════════════════════\n');

// has_pension ve has_canteen sütunlarını ekle (yoksa)
try { db.exec('ALTER TABLE users ADD COLUMN has_pension INTEGER DEFAULT 0'); } catch(e) {}
try { db.exec('ALTER TABLE users ADD COLUMN has_canteen INTEGER DEFAULT 0'); } catch(e) {}

// Tüm kurumlar: [kurum_kodu, detsis_kodu, kurum_adı, kurum_türü, pansiyon]
const kurumlar = [
    // ═══ ANADOLU LİSELERİ ═══
    ['766011', '16363177', 'Borsa İstanbul Gazi Mustafa Kemal Anadolu Lisesi', 'lise', 0],
    ['218407', '38373655', 'Elbistan Anadolu Lisesi', 'lise', 0],
    ['973801', '82283657', 'Elbistan Dulkadiroğlu Anadolu Lisesi', 'lise', 0],
    ['762822', '73377413', 'İğde Anadolu Lisesi', 'lise', 0],
    ['750996', '16209269', 'Mükrimin Halil Anadolu Lisesi', 'lise', 1],  // PANSIYON
    ['769127', '32495580', 'Şehit Ali Tolga Öçal Anadolu Lisesi', 'lise', 0],

    // ═══ FEN LİSESİ ═══
    ['758130', '30047894', 'Elbistan Borsa İstanbul Fen Lisesi', 'lise', 1],  // PANSIYON

    // ═══ İMAM HATİP LİSESİ / ORTAOKULU ═══
    ['184875', '36241527', 'Elbistan Anadolu İmam Hatip Lisesi', 'lise', 1],  // PANSIYON
    ['184875-2', '36241527', 'Elbistan Anadolu İmam Hatip Ortaokulu', 'ortaokul', 0],
    ['760908', '99731638', 'Şehit Abdullah Tayyip Olçok Kız Anadolu İmam Hatip Lisesi', 'lise', 0],
    ['760908-2', '99731638', 'Şehit Abdullah Tayyip Olçok Kız Anadolu İmam Hatip Ortaokulu', 'ortaokul', 0],

    // ═══ DİĞER KURUMLAR ═══
    ['184887', '31026034', 'Elbistan Halk Eğitimi Merkezi', 'diger', 0],
    ['336225', '53693819', 'Elbistan Mesleki Eğitimi Merkezi', 'diger', 0],
    ['958573', '87845968', 'Elbistan Rehberlik ve Araştırma Merkezi', 'diger', 0],
    ['184899', '96596935', 'İlçe Milli Eğitim Müdürlüğü', 'diger', 0],
    ['752277', '79359421', 'Elbistan Bilim ve Sanat Merkezi', 'diger', 0],

    // ═══ ANAOKULLAR ═══
    ['974708', '20065680', 'Elbistan Anaokulu', 'anaokulu', 0],
    ['768706', '97021148', 'Güneşli Anaokulu', 'anaokulu', 0],
    ['768787', '67709943', 'İbrahim Nuh Paksu Kızılay Anaokulu', 'anaokulu', 0],
    ['974619', '92980119', 'Karaelbistan Şefkat Anaokulu', 'anaokulu', 0],
    ['752553', '89419255', 'Papatyam Anaokulu', 'anaokulu', 0],
    ['963637', '96496350', 'Sevgi Anaokulu', 'anaokulu', 0],
    ['763919', '91579031', 'Yeşilyurt Anaokulu', 'anaokulu', 0],
    ['763060', '22495638', '15 Temmuz Anaokulu', 'anaokulu', 0],

    // ═══ AKŞAM SANAT OKULU ═══
    ['971311', '72396716', 'Elbistan Öğretmenevi ve Akşam Sanat Okulu', 'diger', 0],

    // ═══ İLKOKULLAR ═══
    ['732190', '47488879', 'Afşin Elbistan Linyitleri İlkokulu', 'ilkokul', 0],
    ['732320', '17673695', 'Akbayır Şehit Yusuf Kaya İlkokulu', 'ilkokul', 0],
    ['735554', '52331673', 'Akören Şehit Hüseyin Emre Kul İlkokulu', 'ilkokul', 0],
    ['732324', '95163314', 'Alembey Hasan Hüseyin Köseoğlu İlkokulu', 'ilkokul', 0],
    ['732337', '54231508', 'Ambarcık İlkokulu', 'ilkokul', 0],
    ['735525', '96673948', 'Balıkçı İlkokulu', 'ilkokul', 0],
    ['732213', '13874077', 'Battal Gazi İlkokulu', 'ilkokul', 0],
    ['732344', '56440702', 'Büyükyapalak Şehit Mahmut Çifci İlkokulu', 'ilkokul', 0],
    ['732348', '88768613', 'Çalış İlkokulu', 'ilkokul', 0],
    ['732351', '88686141', 'Çatova İlkokulu', 'ilkokul', 0],
    ['732356', '56034755', 'Çiçek İlkokulu', 'ilkokul', 0],
    ['735527', '40103363', 'Dağdere Malatça İlkokulu', 'ilkokul', 0],
    ['732358', '43516018', 'Demirclik İlkokulu', 'ilkokul', 0],
    ['732361', '62607143', 'Doğan Sitesi İlkokulu', 'ilkokul', 0],
    ['732363', '10821918', 'Doğanköy Şehit Uğur Kartal İlkokulu', 'ilkokul', 0],
    ['732245', '23773796', 'Ertuğrulgazi İlkokulu', 'ilkokul', 0],
    ['735529', '34354764', 'Evcihüyük Şekerbank İlkokulu', 'ilkokul', 0],
    ['732191', '25937791', 'Fatih İlkokulu', 'ilkokul', 0],
    ['732195', '29170163', 'Gazipaşa İlkokulu', 'ilkokul', 0],
    ['733075', '43405012', 'Geçit Şehit Mevlüt Yalçınkaya İlkokulu', 'ilkokul', 0],
    ['733077', '18735127', 'Güçük İlkokulu', 'ilkokul', 0],
    ['735531', '82270624', 'Gündere İlkokulu', 'ilkokul', 0],
    ['733079', '30680465', 'Güvercinlik İlkokulu', 'ilkokul', 0],
    ['732199', '12497421', 'Hoca Ahmet Yesevi İlkokulu', 'ilkokul', 0],
    ['733081', '69496144', 'İzgin Şehit Ahmet Ece İlkokulu', 'ilkokul', 0],
    ['732202', '29072169', 'İstiklal İlkokulu', 'ilkokul', 0],
    ['733083', '51593597', 'Kalealtı Köyü Haluk Gökalp Kılınç İlkokulu', 'ilkokul', 0],
    ['746112', '13238780', 'Kara Elbistan Osman Gazi İlkokulu', 'ilkokul', 0],
    ['733087', '72390270', 'Karaelbistan Cumhuriyet İlkokulu', 'ilkokul', 0],
    ['732186', '92721782', 'Karaelbistan Şehit Mevlüt Yıldız İlkokulu', 'ilkokul', 0],
    ['733089', '70139189', 'Karahasanuşağı İlkokulu', 'ilkokul', 0],
    ['733091', '29342007', 'Karahüyük İlkokulu', 'ilkokul', 0],
    ['733093', '91690699', 'Karamağra İlkokulu', 'ilkokul', 0],
    ['732203', '37429052', 'Mehmet Akif Ersoy İlkokulu', 'ilkokul', 0],
    ['760528', '80255628', 'Selçuklu İlkokulu', 'ilkokul', 0],
    ['775497', '64325207', 'Sevdilli Bektaş Özbek İlkokulu', 'ilkokul', 0],
    ['732184', '10544106', 'Şehit İsrafil Kargı İlkokulu', 'ilkokul', 0],
    ['763934', '44777309', 'Şehit Kemal Özdoğan İlkokulu', 'ilkokul', 0],
    ['733096', '45835969', 'Sh.Er.Ali Beyaz İlkokulu', 'ilkokul', 0],
    ['732524', '47481291', 'Taşburun İlkokulu', 'ilkokul', 0],
    ['776826', '80075738', 'Taşburun TOKİ İlkokulu', 'ilkokul', 0],
    ['732249', '44316762', 'Tepebaşı İlkokulu', 'ilkokul', 0],
    ['732113', '62681581', 'Toki Şehit Jandarma Er Levent Kuşoğlu İlkokulu', 'ilkokul', 0],
    ['733098', '75514878', 'Türkören Hasan Erdoğan İlkokulu', 'ilkokul', 0],
    ['733100', '99845697', 'Yapraklı İlkokulu', 'ilkokul', 0],
    ['732209', '35852524', 'Yunus Emre İlkokulu', 'ilkokul', 0],

    // ═══ ORTAOKULLAR ═══
    ['732321', '81976129', 'Akbayır Şehit Yusuf Kaya Ortaokulu', 'ortaokul', 0],
    ['732326', '99832189', 'Alembey Hasan Hüseyin Köseoğlu Ortaokulu', 'ortaokul', 0],
    ['732339', '89063540', 'Ali Tekinsoy Ortaokulu', 'ortaokul', 0],
    ['732343', '15489004', 'Ambarcık Ortaokulu', 'ortaokul', 0],
    ['732347', '14211441', 'Büyükyapalak Şehit Mahmut Çifci Ortaokulu', 'ortaokul', 0],
    ['732222', '84483275', 'Cumhuriyet Ortaokulu', 'ortaokul', 0],
    ['732353', '92140073', 'Çatova Ortaokulu', 'ortaokul', 0],
    ['732357', '48423994', 'Çiçek Ortaokulu', 'ortaokul', 0],
    ['732362', '76428511', 'Doğan Sitesi Ortaokulu', 'ortaokul', 0],
    ['732365', '17691719', 'Doğanköy Şehit Uğur Kartal Ortaokulu', 'ortaokul', 0],
    ['733088', '95696754', 'Elbistan Abdurrahim Karakoç Ortaokulu', 'ortaokul', 0],
    ['732228', '15359784', 'Elbistan Ortaokulu', 'ortaokul', 0],
    ['732231', '81438100', 'Esentepe Ortaokulu', 'ortaokul', 0],
    ['732247', '27135536', 'Gazi Mustafa Kemal Ortaokulu', 'ortaokul', 0],
    ['733076', '80772714', 'Geçit Şehit Mevlüt Yalçınkaya Ortaokulu', 'ortaokul', 0],
    ['733078', '96981919', 'Gücük Ortaokulu', 'ortaokul', 0],
    ['733080', '44013556', 'Güvercinlik Ortaokulu', 'ortaokul', 0],
    ['732253', '84693053', 'Hacı Bektaş Veli Ortaokulu', 'ortaokul', 0],
    ['733082', '50873422', 'İzgin Şehit Ahmet Ece Ortaokulu', 'ortaokul', 0],
    ['733084', '71955207', 'Kalealtı Köyü Haluk Gökalp Kılınç Ortaokulu', 'ortaokul', 0],
    ['733085', '88281348', 'Kara Elbistan Osman Gazi Ortaokulu', 'ortaokul', 0],
    ['733090', '96596890', 'Karahasanuşağı Ortaokulu', 'ortaokul', 0],
    ['733092', '41191303', 'Karahüyük Ortaokulu', 'ortaokul', 0],
    ['733094', '36384505', 'Karamağra Ortaokulu', 'ortaokul', 0],
    ['732239', '19296796', 'Kümbet Ortaokulu', 'ortaokul', 0],
    ['760527', '53370351', 'Selçuklu Ortaokulu', 'ortaokul', 0],
    ['767508', '93281134', 'Şehit Hüseyin Emre Kul Ortaokulu', 'ortaokul', 0],
    ['767966', '47777789', 'Şehit Kamil Topal Ortaokulu', 'ortaokul', 0],
    ['732243', '88106955', 'Şeker Ortaokulu', 'ortaokul', 0],
    ['732188', '21675262', 'Sh. Tğm. Harun Kılıç Ortaokulu', 'ortaokul', 0],
    ['733097', '84125878', 'Sh.Er.Ali Beyaz Ortaokulu', 'ortaokul', 0],
    ['732527', '84662407', 'Taşburun Ortaokulu', 'ortaokul', 0],
    ['776827', '53176957', 'Taşburun TOKİ Ortaokulu', 'ortaokul', 0],
    ['733099', '91034789', 'Türkören Hasan Erdoğan Ortaokulu', 'ortaokul', 0],
    ['733101', '81893162', 'Yapraklı Ortaokulu', 'ortaokul', 0],

    // ═══ ÖZEL EĞİTİM ═══
    ['773829', '44103751', 'Elbistan Özel Eğitim Anaokulu', 'diger', 0],
    ['774655', '38529868', 'Elbistan Özel Eğitim Uygulama Okulu I. Kademe', 'diger', 0],
    ['774660', '55920125', 'Elbistan Özel Eğitim Uygulama Okulu II. Kademe', 'diger', 0],
    ['773484', '64423524', 'Şehit Mehmet Şahin Özel Eğitim Meslek Okulu', 'diger', 0],
    ['773484-2', '49625413', 'Elbistan Özel Eğitim Uygulama Okulu III. Kademe', 'diger', 0],

    // ═══ YATILI BÖLGE ORTAOKULU ═══
    ['747761', '22998142', 'Elbistan Şehit Er Cuma Potuk Yatılı Bölge Ortaokulu', 'ortaokul', 1],  // PANSIYON

    // ═══ MESLEKİ VE TEKNİK ANADOLU LİSELERİ ═══
    ['963235', '19599050', 'Akşemsettin Mesleki ve Teknik Anadolu Lisesi', 'lise', 1],  // PANSIYON
    ['184838', '93388109', 'Elbistan Mesleki ve Teknik Anadolu Lisesi', 'lise', 1],  // PANSIYON
    ['966841', '22352858', 'Karaelbistan Mesleki ve Teknik Anadolu Lisesi', 'lise', 1],  // PANSIYON
    ['765851', '77598290', 'Şehit Naci Soydan Mesleki ve Teknik Anadolu Lisesi', 'lise', 1],  // PANSIYON
    ['184963', '17054697', 'Yavuz Selim Ticaret Mesleki ve Teknik Anadolu Lisesi', 'lise', 0],

    // ═══ ÇOK PROGRAMLI ANADOLU LİSESİ ═══
    ['184851', '39461999', 'Çok Programlı Anadolu Lisesi', 'lise', 0],
];

// Ekleme işlemi
const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO users (username, full_name, password, role, school_type, has_pension, has_canteen)
    VALUES (?, ?, ?, 'school', ?, ?, 0)
`);

const updateStmt = db.prepare(`
    UPDATE users SET full_name = ?, school_type = ?, has_pension = ? WHERE username = ?
`);

let eklenen = 0;
let guncellenen = 0;
let hatali = 0;

const transaction = db.transaction(() => {
    kurumlar.forEach(([kurumKodu, detsisKodu, kurumAdi, kurumTuru, pansiyon]) => {
        try {
            // Şifreyi hashle
            const hashedPassword = bcrypt.hashSync(detsisKodu, 10);
            
            // Önce var mı kontrol et
            const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(kurumKodu);
            
            if (existing) {
                // Güncelle
                updateStmt.run(kurumAdi, kurumTuru, pansiyon, kurumKodu);
                guncellenen++;
            } else {
                // Ekle
                insertStmt.run(kurumKodu, kurumAdi, hashedPassword, kurumTuru, pansiyon);
                eklenen++;
            }
        } catch(e) {
            console.error(`  ❌ Hata: ${kurumKodu} - ${kurumAdi}: ${e.message}`);
            hatali++;
        }
    });
});

transaction();

console.log('════════════════════════════════════════');
console.log(`  ✅ Yeni eklenen: ${eklenen} kurum`);
console.log(`  🔄 Güncellenen: ${guncellenen} kurum`);
if (hatali > 0) console.log(`  ❌ Hatalı: ${hatali} kurum`);
console.log(`  📊 Toplam işlenen: ${kurumlar.length} kurum`);
console.log('════════════════════════════════════════');

// Pansiyon özeti
const pansiyonlu = kurumlar.filter(k => k[4] === 1);
console.log(`\n🏠 Pansiyonlu Okullar (${pansiyonlu.length}):`);
pansiyonlu.forEach(([kod, , ad]) => {
    console.log(`   • ${ad} (${kod})`);
});

// Tür bazında özet
const ozet = db.prepare(`
    SELECT school_type, COUNT(*) as sayi 
    FROM users 
    WHERE role = 'school' 
    GROUP BY school_type
    ORDER BY sayi DESC
`).all();

console.log('\n📊 Kurum Türü Dağılımı:');
ozet.forEach(row => {
    const tip = row.school_type || 'belirsiz';
    console.log(`   ${tip}: ${row.sayi} kurum`);
});

const toplam = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'school'").get().c;
console.log(`\n🎯 Toplam Kurum: ${toplam}`);
console.log('════════════════════════════════════════\n');

db.close();
