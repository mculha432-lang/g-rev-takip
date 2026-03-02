const db = require('./config/database');

console.log('🔄 Görev durumları simüle ediliyor...');

// Tüm atamaları al
const assignments = db.prepare('SELECT id FROM task_assignments').all();

// Listeyi karıştır (Fisher-Yates Shuffle)
for (let i = assignments.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [assignments[i], assignments[j]] = [assignments[j], assignments[i]];
}

const total = assignments.length;
const completedCount = Math.floor(total * 0.5); // %50
const readCount = Math.floor(total * 0.25);      // %25
const unreadCount = total - completedCount - readCount; // Kalanlar

console.log(`📊 Toplam Atama: ${total}`);
console.log(`✅ Tamamlanacak (%50): ${completedCount}`);
console.log(`👁️ Okundu Yapılacak (%25): ${readCount}`);
console.log(`🌑 Bakılmamış Kalacak (%25): ${unreadCount}`);

// Prepared Statements
const updateCompleted = db.prepare(`
    UPDATE task_assignments 
    SET status = 'completed', 
        is_read = 1, 
        read_at = datetime('now', '-' || abs(random() % 5) || ' days'),
        completed_at = datetime('now', '-' || abs(random() % 2) || ' days'),
        response_note = 'Görev tarafımızca tamamlanmıştır, gereğini arz ederim.'
    WHERE id = ?
`);

const updateRead = db.prepare(`
    UPDATE task_assignments 
    SET status = 'pending', 
        is_read = 1, 
        read_at = datetime('now', '-' || abs(random() % 3) || ' days'),
        completed_at = NULL,
        response_note = NULL
    WHERE id = ?
`);

const updateUnread = db.prepare(`
    UPDATE task_assignments 
    SET status = 'pending', 
        is_read = 0, 
        read_at = NULL, 
        completed_at = NULL,
        response_note = NULL
    WHERE id = ?
`);

// Gruplara ayır
const completedGroup = assignments.slice(0, completedCount);
const readGroup = assignments.slice(completedCount, completedCount + readCount);
const unreadGroup = assignments.slice(completedCount + readCount);

// Transaction ile güvenli güncelleme
const updateTransaction = db.transaction(() => {
    let count = 0;

    // 1. Tamamlananları güncelle
    completedGroup.forEach(a => {
        updateCompleted.run(a.id);
        count++;
    });

    // 2. Okunanları güncelle
    readGroup.forEach(a => {
        updateRead.run(a.id);
        count++;
    });

    // 3. Bakılmayanları güncelle (Reset)
    unreadGroup.forEach(a => {
        updateUnread.run(a.id);
        count++;
    });

    return count;
});

try {
    const affected = updateTransaction();
    console.log(`\n✅ İşlem başarıyla tamamlandı! ${affected} kayıt güncellendi.`);
} catch (error) {
    console.error('\n❌ Bir hata oluştu:', error);
}
