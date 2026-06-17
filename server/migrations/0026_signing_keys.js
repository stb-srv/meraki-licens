export function up(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS signing_keys (
            kid         TEXT NOT NULL PRIMARY KEY,
            public_key  TEXT NOT NULL,
            private_key TEXT NOT NULL,
            status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
            created_at  TEXT DEFAULT (datetime('now'))
        );
    `);
}

export default up;
