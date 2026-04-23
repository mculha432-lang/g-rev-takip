/**
 * GÖREV KURTARMA & DÜZELTME SCRIPTİ
 * Bu script eski görevlerin kaybolma sorununu çözer.
 * Sunucuda çalıştır: node fix_tasks.js
 */

const db = require('./config/database');

console.log('\n========================================');
console.log('  GÖREV KURTARMA SCRIPTİ BAŞLADI');
console.log('========================================\n');

// 1. Mevcut durumu kontrol et
const totalTasks = db.prepare("SELECT COUNT(*) as c FROM tasks").get().c;
const nullTasks = db.prepare("SELECT COUNT(*) as c FROM tasks WHERE created_by IS NULL").get().c;
const totalAssignments = db.prepare("SELECT COUNT(*) as c FROM task_assignments").get().c;
const totalUsers = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
const adminUser = db.prepare("SELECT id, username, full_name FROM users WHERE role = 'admin' LIMIT 1").get();

console.log('--- MEVCUT DURUM ---');
console.log('Toplam Görev (tasks tablosu):', totalTasks);
console.log('Sahipsiz Görev (created_by NULL):', nullTasks);
console.log('Toplam Atama (task_assignments):', totalAssignments);
console.log('Toplam Kullanıcı:', totalUsers);
console.log('Admin Kullanıcı:', adminUser ? `${adminUser.full_name} (ID: ${adminUser.id})` : 'YOK!');
console.log('');

// 2. Görevleri listele
const tasks = db.prepare("SELECT id, title, deadline, created_by FROM tasks ORDER BY id DESC").all();
if (tasks.length > 0) {
    console.log('--- GÖREV LİSTESİ ---');
    tasks.forEach(t => {
        const owner = t.created_by ? `Sahip ID: ${t.created_by}` : '⚠️ SAHİPSİZ';
        console.log(`  [${t.id}] ${t.title} | Son: ${t.deadline} | ${owner}`);
    });
    console.log('');
}

// 3. Düzeltme uygula
if (nullTasks > 0 && adminUser) {
    console.log('--- DÜZELTME UYGULANYOR ---');
    const result = db.prepare("UPDATE tasks SET created_by = ? WHERE created_by IS NULL").run(adminUser.id);
    console.log(`✅ ${result.changes} görev Admin'e (${adminUser.full_name}) bağlandı!`);
} else if (totalTasks === 0) {
    console.log('⚠️ VERİTABANINDA HİÇ GÖREV YOK!');
    console.log('Bu, veritabanı dosyasının git pull sırasında değişmiş olabileceğini gösterir.');
    console.log('');
    console.log('ÇÖZÜM: git stash ile saklanan eski veritabanını geri getirmeyi dene:');
    console.log('  git stash list');
    console.log('  git stash pop');
    console.log('');
    console.log('Veya yedekleme klasörünü kontrol et.');
} else {
    console.log('✅ Tüm görevler zaten bir kullanıcıya bağlı, düzeltme gerekmiyor.');
}

// 4. Schema versiyonunu kontrol et  
try {
    const sv = db.prepare("SELECT value FROM settings WHERE key = 'schema_version'").get();
    console.log('\nSchema Versiyonu:', sv ? sv.value : 'Bulunamadı');
} catch(e) {}

console.log('\n========================================');
console.log('  SCRIPT TAMAMLANDI');
console.log('========================================\n');

process.exit(0);
