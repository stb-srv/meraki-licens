export function up(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS deletion_requests (
            id           TEXT NOT NULL PRIMARY KEY,
            customer_id  TEXT NOT NULL,
            status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processed')),
            reason       TEXT,
            requested_at TEXT DEFAULT (datetime('now')),
            processed_at TEXT,
            processed_by TEXT,
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
        );
    `);
}

export default up;
