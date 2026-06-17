export function up(db) {
    db.exec(`ALTER TABLE invoices ADD COLUMN discount_pct REAL NOT NULL DEFAULT 0;`);
}

export default up;
