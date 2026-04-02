const db = require('./config/database');
const schema = db.prepare("PRAGMA table_info(users)").all();
console.log(JSON.stringify(schema, null, 2));
