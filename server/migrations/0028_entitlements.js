export function up(db) {
    db.exec(`ALTER TABLE licenses ADD COLUMN entitlements TEXT;`);
}

export default up;
