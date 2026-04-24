const bcrypt = require('bcryptjs');
const db = require('better-sqlite3')('database/elbistan_mem.db');
const fs = require('fs');

const users = db.prepare('SELECT username, password, role FROM users').all();
const content = fs.readFileSync('scripts/seed_all_schools.js', 'utf8');
const regex = /\[\s*['"](\d+[-0-9]*)['"]\s*,\s*['"](\d+)['"]/g;

const map = {};
let match;
while ((match = regex.exec(content)) !== null) {
    map[match[1]] = match[2];
}

let ok = 0;
let fail = 0;

users.forEach(u => {
    if(u.role === 'admin' || u.role === 'sef') return;
    const detsis = map[u.username];
    if (detsis) {
        if (bcrypt.compareSync(detsis, u.password)) {
            ok++;
        } else {
            fail++;
            console.log('Fail:', u.username, 'expected detsis:', detsis);
        }
    }
});
console.log('OK:', ok, 'Fail:', fail);
