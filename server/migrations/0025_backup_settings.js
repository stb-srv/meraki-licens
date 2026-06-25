export function up(db) {
    db.exec(
        `ALTER TABLE invoice_settings ADD COLUMN backup_retention_days INTEGER NOT NULL DEFAULT 14;`
    );
}

export default up;
