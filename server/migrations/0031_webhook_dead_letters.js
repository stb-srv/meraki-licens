export function up(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS webhook_dead_letters (
            id          TEXT NOT NULL PRIMARY KEY,
            webhook_url TEXT NOT NULL,
            event       TEXT NOT NULL,
            payload     TEXT NOT NULL,
            error       TEXT,
            attempt_count INTEGER DEFAULT 3,
            failed_at   TEXT DEFAULT (datetime('now')),
            retried_at  TEXT,
            resolved    INTEGER DEFAULT 0
        );
    `);
}

export default up;
