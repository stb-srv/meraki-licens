export function up(db) {
    db.exec(`
        ALTER TABLE invoices ADD COLUMN dunning_level INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE invoice_settings ADD COLUMN expiry_warn_days_1 INTEGER NOT NULL DEFAULT 30;
        ALTER TABLE invoice_settings ADD COLUMN expiry_warn_days_2 INTEGER NOT NULL DEFAULT 7;
    `);
}
export default up;
