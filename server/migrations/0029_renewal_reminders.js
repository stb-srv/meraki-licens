export function up(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS renewal_reminders (
            license_key TEXT NOT NULL,
            days_before INTEGER NOT NULL,
            sent_at     TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (license_key, days_before)
        );
    `);
}

export default up;
