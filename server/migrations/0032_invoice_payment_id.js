export function up(db) {
    db.exec(`ALTER TABLE invoices ADD COLUMN payment_id TEXT;`);
}

export default up;
