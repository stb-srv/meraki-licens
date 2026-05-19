/**
 * Migration 0018 – Invoice Resend and Customer Billing Fields
 * Adds resent_count and resent_at to invoices table, and billing sub-fields to customers table.
 */

export async function up(db) {
    console.log('⏫ Migration 0018: Adding resend columns to invoices table...');

    // 1. Invoices table columns
    const [[{ n: hasResentCount }]] = await db.query(`
        SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'resent_count'
    `);
    if (!hasResentCount) {
        await db.query(`ALTER TABLE invoices ADD COLUMN resent_count INT DEFAULT 0`);
        console.log('  ✅ Column invoices.resent_count added.');
    } else {
        console.log('  ⏭  Column invoices.resent_count already exists.');
    }

    const [[{ n: hasResentAt }]] = await db.query(`
        SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'resent_at'
    `);
    if (!hasResentAt) {
        await db.query(`ALTER TABLE invoices ADD COLUMN resent_at DATETIME DEFAULT NULL`);
        console.log('  ✅ Column invoices.resent_at added.');
    } else {
        console.log('  ⏭  Column invoices.resent_at already exists.');
    }

    // 2. Customers table billing columns
    console.log('⏫ Migration 0018: Checking billing columns in customers table...');

    const columnsToEnsure = [
        { name: 'billing_street', type: 'VARCHAR(255) DEFAULT NULL' },
        { name: 'billing_city', type: 'VARCHAR(255) DEFAULT NULL' },
        { name: 'billing_zip', type: 'VARCHAR(32) DEFAULT NULL' },
        { name: 'billing_country', type: 'VARCHAR(64) DEFAULT \'DE\'' },
        { name: 'tax_id', type: 'VARCHAR(64) DEFAULT NULL' }
    ];

    for (const col of columnsToEnsure) {
        const [[{ n: colExists }]] = await db.query(`
            SELECT COUNT(*) AS n FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = ?
        `, [col.name]);

        if (!colExists) {
            await db.query(`ALTER TABLE customers ADD COLUMN ${col.name} ${col.type}`);
            console.log(`  ✅ Column customers.${col.name} added.`);
        } else {
            console.log(`  ⏭  Column customers.${col.name} already exists.`);
        }
    }

    console.log('✅ Migration 0018 up completed.');
}

export async function down(db) {
    console.log('⏬ Migration 0018: Reverting resend and billing columns...');

    // Drop invoices columns
    const [[{ n: hasResentCount }]] = await db.query(`
        SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'resent_count'
    `);
    if (hasResentCount) {
        await db.query(`ALTER TABLE invoices DROP COLUMN resent_count`);
        console.log('  ✅ Column invoices.resent_count dropped.');
    }

    const [[{ n: hasResentAt }]] = await db.query(`
        SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'resent_at'
    `);
    if (hasResentAt) {
        await db.query(`ALTER TABLE invoices DROP COLUMN resent_at`);
        console.log('  ✅ Column invoices.resent_at dropped.');
    }

    // Drop customers billing columns
    const columnsToDrop = ['billing_street', 'billing_city', 'billing_zip', 'billing_country'];
    for (const col of columnsToDrop) {
        const [[{ n: colExists }]] = await db.query(`
            SELECT COUNT(*) AS n FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = ?
        `, [col]);

        if (colExists) {
            await db.query(`ALTER TABLE customers DROP COLUMN ${col}`);
            console.log(`  ✅ Column customers.${col} dropped.`);
        }
    }

    console.log('✅ Migration 0018 down completed.');
}

export default up;
