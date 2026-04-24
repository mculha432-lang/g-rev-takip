const bcrypt = require('bcryptjs');
const db = require('better-sqlite3')('database/elbistan_mem.db');
const fs = require('fs');

const users = db.prepare('SELECT id, username, password, role FROM users').all();
const content = fs.readFileSync('scripts/seed_all_schools.js', 'utf8');
const regex = /\[\s*['"](\d+[-0-9]*)['"]\s*,\s*['"](\d+)['"]/g;

const map = {};
let match;
while ((match = regex.exec(content)) !== null) {
    map[match[1]] = match[2];
}

let fixed = 0;

const updateStmt = db.prepare('UPDATE users SET password = ? WHERE id = ?');

db.transaction(() => {
    users.forEach(u => {
        if(u.role === 'admin' || u.role === 'sef') return;
        const detsis = map[u.username];
        if (detsis) {
            if (!bcrypt.compareSync(detsis, u.password)) {
                console.log(`Fixing password for ${u.username} to detsis code ${detsis}`);
                const hashed = bcrypt.hashSync(detsis, 10);
                updateStmt.run(hashed, u.id);
                fixed++;
            }
        }
    });
})();

console.log('Fixed:', fixed, 'schools.');
