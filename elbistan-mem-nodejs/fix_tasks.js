const Database = require('better-sqlite3');
const path = require('path');

console.log('\n=== GOREV KURTARMA SCRIPTI ===\n');

// 1. Ana veritabani kontrol
const mainDbPath = path.join(__dirname, 'database', 'elbistan_mem.db');
const mainDb = new Database(mainDbPath);
const mainTasks = mainDb.prepare('SELECT COUNT(*) as c FROM tasks').get().c;
const mainAssign = mainDb.prepare('SELECT COUNT(*) as c FROM task_assignments').get().c;
const mainUsers = mainDb.prepare('SELECT COUNT(*) as c FROM users').get().c;
console.log('ANA DB:', mainDbPath);
console.log('  Gorev:', mainTasks, '| Atama:', mainAssign, '| Kullanici:', mainUsers);

// 2. Eski veritabani kontrol (/tmp/old.db)
try {
    const oldDb = new Database('/tmp/old.db');
    const oldTasks = oldDb.prepare('SELECT COUNT(*) as c FROM tasks').get().c;
    const oldAssign = oldDb.prepare('SELECT COUNT(*) as c FROM task_assignments').get().c;
    const oldUsers = oldDb.prepare('SELECT COUNT(*) as c FROM users').get().c;
    console.log('\nESKI DB: /tmp/old.db');
    console.log('  Gorev:', oldTasks, '| Atama:', oldAssign, '| Kullanici:', oldUsers);

    // Eger eski DB'de gorev varsa, ana DB'ye kopyala
    if (oldTasks > 0 && mainTasks === 0) {
        console.log('\n*** ESKI DB DE GOREV BULUNDU! KURTARMA BASLIYOR ***');
        
        // Eski DB'deki tablolari oku
        const tasks = oldDb.prepare('SELECT * FROM tasks').all();
        const assignments = oldDb.prepare('SELECT * FROM task_assignments').all();
        
        let taskFields = [];
        try { taskFields = oldDb.prepare('SELECT * FROM task_fields').all(); } catch(e) {}
        
        let fieldResponses = [];
        try { fieldResponses = oldDb.prepare('SELECT * FROM field_responses').all(); } catch(e) {}
        
        let responseFiles = [];
        try { responseFiles = oldDb.prepare('SELECT * FROM response_files').all(); } catch(e) {}
        
        let taskAttachments = [];
        try { taskAttachments = oldDb.prepare('SELECT * FROM task_attachments').all(); } catch(e) {}

        // Ana DB'ye aktar
        const adminId = mainDb.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
        
        // Tasks
        tasks.forEach(t => {
            try {
                const cols = Object.keys(t);
                if (!cols.includes('created_by')) cols.push('created_by');
                const vals = cols.map(c => c === 'created_by' ? (t.created_by || (adminId ? adminId.id : null)) : t[c]);
                const placeholders = cols.map(() => '?').join(',');
                mainDb.prepare('INSERT OR IGNORE INTO tasks (' + cols.join(',') + ') VALUES (' + placeholders + ')').run(...vals);
            } catch(e) { console.log('  Task hata:', t.id, e.message); }
        });
        console.log('  ' + tasks.length + ' gorev aktarildi');

        // Assignments
        assignments.forEach(a => {
            try {
                const cols = Object.keys(a);
                const vals = cols.map(c => a[c]);
                const placeholders = cols.map(() => '?').join(',');
                mainDb.prepare('INSERT OR IGNORE INTO task_assignments (' + cols.join(',') + ') VALUES (' + placeholders + ')').run(...vals);
            } catch(e) {}
        });
        console.log('  ' + assignments.length + ' atama aktarildi');

        // Task Fields
        taskFields.forEach(f => {
            try {
                const cols = Object.keys(f);
                const vals = cols.map(c => f[c]);
                const placeholders = cols.map(() => '?').join(',');
                mainDb.prepare('INSERT OR IGNORE INTO task_fields (' + cols.join(',') + ') VALUES (' + placeholders + ')').run(...vals);
            } catch(e) {}
        });
        console.log('  ' + taskFields.length + ' form alani aktarildi');

        // Field Responses
        fieldResponses.forEach(r => {
            try {
                const cols = Object.keys(r);
                const vals = cols.map(c => r[c]);
                const placeholders = cols.map(() => '?').join(',');
                mainDb.prepare('INSERT OR IGNORE INTO field_responses (' + cols.join(',') + ') VALUES (' + placeholders + ')').run(...vals);
            } catch(e) {}
        });
        console.log('  ' + fieldResponses.length + ' form cevabi aktarildi');

        // Response Files
        responseFiles.forEach(f => {
            try {
                const cols = Object.keys(f);
                const vals = cols.map(c => f[c]);
                const placeholders = cols.map(() => '?').join(',');
                mainDb.prepare('INSERT OR IGNORE INTO response_files (' + cols.join(',') + ') VALUES (' + placeholders + ')').run(...vals);
            } catch(e) {}
        });
        console.log('  ' + responseFiles.length + ' dosya kaydı aktarildi');

        // Task Attachments
        taskAttachments.forEach(a => {
            try {
                const cols = Object.keys(a);
                const vals = cols.map(c => a[c]);
                const placeholders = cols.map(() => '?').join(',');
                mainDb.prepare('INSERT OR IGNORE INTO task_attachments (' + cols.join(',') + ') VALUES (' + placeholders + ')').run(...vals);
            } catch(e) {}
        });
        console.log('  ' + taskAttachments.length + ' ek dosya aktarildi');

        console.log('\n*** KURTARMA TAMAMLANDI! pm2 restart guncel-takip yap ***');
    } else if (oldTasks === 0) {
        console.log('\n  Eski DB de bos, gorev yok.');
    } else {
        console.log('\n  Ana DB de zaten gorev var, aktarma gerekmiyor.');
    }
    oldDb.close();
} catch(e) {
    console.log('\nEski DB (/tmp/old.db) bulunamadi veya acilamadi:', e.message);
}

// 3. Sahipsiz gorev duzeltme
const nullCount = mainDb.prepare('SELECT COUNT(*) as c FROM tasks WHERE created_by IS NULL').get().c;
if (nullCount > 0) {
    const admin = mainDb.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
    if (admin) {
        mainDb.prepare('UPDATE tasks SET created_by = ? WHERE created_by IS NULL').run(admin.id);
        console.log('\n' + nullCount + ' sahipsiz gorev Admin e baglandi.');
    }
}

// 4. Son durum
const finalTasks = mainDb.prepare('SELECT COUNT(*) as c FROM tasks').get().c;
const finalAssign = mainDb.prepare('SELECT COUNT(*) as c FROM task_assignments').get().c;
console.log('\n=== SON DURUM ===');
console.log('Gorev:', finalTasks, '| Atama:', finalAssign);
console.log('=================\n');

mainDb.close();
process.exit(0);
