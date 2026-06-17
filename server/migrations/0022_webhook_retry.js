export function up(db) {
    db.exec(`
        ALTER TABLE webhook_logs ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE webhook_logs ADD COLUMN next_retry_at TEXT;
    `);
}
export default up;
