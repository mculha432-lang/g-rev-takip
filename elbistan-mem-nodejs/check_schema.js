const db = require('better-sqlite3')('database/elbistan_mem.db');
console.log(db.prepare("PRAGMA table_info('users')").all());
