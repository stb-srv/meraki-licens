export function up(db) {
    db.exec(`
        ALTER TABLE invoice_settings ADD COLUMN expiry_warn_days_3 INTEGER NOT NULL DEFAULT 7;
        ALTER TABLE invoice_settings ADD COLUMN expiry_warn_days_4 INTEGER NOT NULL DEFAULT 1;
    `);
}

export default up;
