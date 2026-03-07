const db = require('better-sqlite3')('./database/elbistan_mem.db');
try {
  db.exec("ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'Orta'");
  console.log('success');
} catch(e) {
  console.log(e.message);
}
