const db = require('./config/database');
const types = db.prepare("SELECT DISTINCT school_type FROM users WHERE role='school'").all();
console.log(JSON.stringify(types, null, 2));
