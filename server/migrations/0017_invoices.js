/**
 * Migration 0017 – Invoices Schema Creation
 * Creates the invoices table with all required fields, indexes, and foreign key relations.
 */

export async function up(db) {
    console.log('⏫ Migration 0017: Creating invoices table...');

    await db.query(`
        CREATE TABLE IF NOT EXISTS invoices (
            id              CHAR(36) NOT NULL PRIMARY KEY,
            invoice_number  VARCHAR(32) NOT NULL UNIQUE,
            customer_id     CHAR(36) NOT NULL,
            license_key     VARCHAR(64) DEFAULT NULL,
            status          ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled') DEFAULT 'draft',
            type            ENUM('invoice', 'credit_note', 'reminder') DEFAULT 'invoice',
            amount_net      DECIMAL(10,2) NOT NULL,
            amount_tax      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            amount_gross    DECIMAL(10,2) NOT NULL,
            tax_rate        DECIMAL(5,2) NOT NULL DEFAULT 19.00,
            currency        VARCHAR(8) NOT NULL DEFAULT 'EUR',
            due_date        DATE DEFAULT NULL,
            paid_at         DATETIME DEFAULT NULL,
            sent_at         DATETIME DEFAULT NULL,
            notes           TEXT DEFAULT NULL,
            pdf_path        VARCHAR(512) DEFAULT NULL,
            created_by      VARCHAR(64) DEFAULT 'system',
            created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at      DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
            
            INDEX idx_customer_id (customer_id),
            INDEX idx_license_key (license_key),
            INDEX idx_status (status),
            INDEX idx_type (type),
            
            CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) 
                REFERENCES customers(id) ON DELETE RESTRICT,
            CONSTRAINT fk_invoices_license FOREIGN KEY (license_key) 
                REFERENCES licenses(license_key) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('  ✅ Table invoices successfully created.');
    console.log('✅ Migration 0017 up completed.');
}

export async function down(db) {
    console.log('⏬ Migration 0017: Dropping invoices table...');

    await db.query(`DROP TABLE IF EXISTS invoices`);

    console.log('  ✅ Table invoices dropped.');
    console.log('✅ Migration 0017 down completed.');
}

export default up;
