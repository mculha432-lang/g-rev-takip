const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'database', 'elbistan_mem.db');
const db = new Database(dbPath);

try {
    const subs = db.prepare('SELECT COUNT(*) as count FROM push_subscriptions').get();
    console.log('Total push subscriptions:', subs.count);
    if (subs.count > 0) {
        const sample = db.prepare('SELECT * FROM push_subscriptions LIMIT 1').get();
        console.log('Sample subscription:', JSON.stringify(sample, null, 2));
    }
} catch (err) {
    console.error('Error checking subscriptions:', err);
}
