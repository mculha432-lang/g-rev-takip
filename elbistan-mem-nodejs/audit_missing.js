const db = require('better-sqlite3')('database/elbistan_mem.db');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Load mapping from seed script
const content = fs.readFileSync(path.join(__dirname, 'scripts', 'seed_all_schools.js'), 'utf8');
const regex = /\[\s*['\"](\d+[-\d]*)['\"]\s*,\s*['\"](\d+)['\"]\]/g;
const map = {};
let m;
while ((m = regex.exec(content)) !== null) {
  map[m[1]] = m[2];
}

const schools = db.prepare("SELECT id, username, password FROM users WHERE role = 'school'").all();
let missing = [];
let mismatch = [];
schools.forEach(s => {
  const dets = map[s.username];
  if (!dets) {
    missing.push(s.username);
  } else if (!bcrypt.compareSync(dets, s.password)) {
    mismatch.push({username: s.username, expected: dets});
  }
});
console.log('Missing mapping count:', missing.length);
if (missing.length) console.log('Missing usernames:', missing.slice(0,20));
console.log('Password mismatch count:', mismatch.length);
if (mismatch.length) console.log('First mismatches:', mismatch.slice(0,10));
