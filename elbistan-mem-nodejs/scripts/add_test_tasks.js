// Test görevleri ekleme scripti
const db = require('./config/database');

// Görev ekleme fonksiyonu
function addTask(title, description, deadline, requiresFile, schoolTypes) {
    // Görevi ekle
    const result = db.prepare(`
        INSERT INTO tasks (title, description, deadline, requires_file, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
    `).run(title, description, deadline, requiresFile ? 1 : 0);

    const taskId = result.lastInsertRowid;

    // Belirtilen türdeki okulları bul
    let schools;
    if (schoolTypes === 'all') {
        schools = db.prepare("SELECT id FROM users WHERE role = 'school'").all();
    } else {
        const placeholders = schoolTypes.map(() => '?').join(',');
        schools = db.prepare(`SELECT id FROM users WHERE role = 'school' AND school_type IN (${placeholders})`).all(...schoolTypes);
    }

    // Atamaları ekle
    const insertAssignment = db.prepare('INSERT INTO task_assignments (task_id, user_id, status) VALUES (?, ?, ?)');
    schools.forEach(school => {
        insertAssignment.run(taskId, school.id, 'pending');
    });

    console.log(`✓ "${title}" - ${schools.length} okula atandı`);
    return taskId;
}

// Gelecek tarihler
const deadline1 = '2026-01-25';
const deadline2 = '2026-01-28';
const deadline3 = '2026-01-31';
const deadline4 = '2026-02-05';
const deadline5 = '2026-02-10';

console.log('\n📋 Test görevleri ekleniyor...\n');

// 1. TÜM OKULLAR
addTask(
    '2025-2026 Öğrenci Sayısı Bildirimi',
    'Tüm okulların güncel öğrenci sayılarını bildirmesi gerekmektedir.',
    deadline1,
    true,
    'all'
);

// 2. SADECE LİSELER
addTask(
    'YKS Hazırlık Programı Raporu',
    'Liselerin YKS hazırlık programları ve öğrenci katılım oranları hakkında rapor.',
    deadline2,
    true,
    ['lise']
);

// 3. SADECE ORTAOKULLAR
addTask(
    'LGS Deneme Sınavı Sonuçları',
    'Ortaokulların LGS deneme sınavı sonuçlarını ve analizlerini göndermesi.',
    deadline2,
    true,
    ['ortaokul']
);

// 4. SADECE İLKOKULLAR
addTask(
    'Okuma Bayramı Etkinlik Raporu',
    'İlkokulların okuma bayramı etkinlik fotoğrafları ve katılım bilgileri.',
    deadline3,
    true,
    ['ilkokul']
);

// 5. SADECE ANAOKULLAR
addTask(
    'Oyun Temelli Eğitim Değerlendirmesi',
    'Anaokullarındaki oyun temelli eğitim uygulamalarının değerlendirilmesi.',
    deadline3,
    false,
    ['anaokulu']
);

// 6. SADECE DİĞER KURUMLAR
addTask(
    'Kurum Faaliyet Raporu',
    'Diğer eğitim kurumlarının aylık faaliyet raporları.',
    deadline4,
    true,
    ['diger']
);

// 7. LİSE + ORTAOKUL (Ortaöğretim)
addTask(
    'Sportif Faaliyet Anketi',
    'Ortaokul ve liselerdeki sportif faaliyet katılım anketi.',
    deadline4,
    false,
    ['ortaokul', 'lise']
);

// 8. İLKOKUL + ANAOKULU (Okul Öncesi ve İlk Kademe)
addTask(
    'Veliler Günü Organizasyonu',
    'İlkokul ve anaokullarındaki veliler günü etkinlik planları.',
    deadline5,
    false,
    ['ilkokul', 'anaokulu']
);

// 9. İLKOKUL + ORTAOKUL (Temel Eğitim)
addTask(
    'Değerler Eğitimi Uygulamaları',
    'İlkokul ve ortaokullarda yürütülen değerler eğitimi çalışmaları.',
    deadline5,
    true,
    ['ilkokul', 'ortaokul']
);

// 10. LİSE + DİĞER
addTask(
    'Mesleki Gelişim Seminerleri',
    'Lise ve diğer kurumlardaki mesleki gelişim seminer katılım bilgileri.',
    deadline5,
    false,
    ['lise', 'diger']
);

console.log('\n✅ Tüm test görevleri başarıyla eklendi!\n');

// İstatistikleri göster
const totalTasks = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
const totalAssignments = db.prepare('SELECT COUNT(*) as count FROM task_assignments').get().count;
console.log(`📊 Toplam: ${totalTasks} görev, ${totalAssignments} atama\n`);

process.exit(0);
