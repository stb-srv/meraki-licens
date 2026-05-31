export function up(db) {
    // Bankname-Feld hinzufügen
    try { db.exec(`ALTER TABLE invoice_settings ADD COLUMN company_bank_name TEXT`); } catch {}

    // Standard-Datensatz anlegen falls noch keiner existiert
    db.exec(`
        INSERT OR IGNORE INTO invoice_settings (
            id, company_name, company_address, invoice_prefix, next_number
        ) VALUES (
            1,
            'Mein Unternehmen',
            'Musterstraße 1\n12345 Musterstadt\nDeutschland',
            'INV',
            1
        );
    `);
}

export default up;
