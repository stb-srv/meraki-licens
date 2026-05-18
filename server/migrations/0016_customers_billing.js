/**
 * Migration 0016 – Customers Billing Extensions
 * Adds billing address, tax ID, country, and currency columns to customers table.
 */

export async function up(db) {
    console.log('⏫ Migration 0016: Adding billing columns to customers table...');

    // Check if billing_address exists
    const [[{ n: hasBillingAddress }]] = await db.query(`
        SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'billing_address'
    `);
    if (!hasBillingAddress) {
        await db.query(`ALTER TABLE customers ADD COLUMN billing_address TEXT DEFAULT NULL`);
        console.log('  ✅ Column customers.billing_address added.');
    } else {
        console.log('  ⏭  Column customers.billing_address already exists.');
    }

    // Check if tax_id exists
    const [[{ n: hasTaxId }]] = await db.query(`
        SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'tax_id'
    `);
    if (!hasTaxId) {
        await db.query(`ALTER TABLE customers ADD COLUMN tax_id VARCHAR(64) DEFAULT NULL`);
        console.log('  ✅ Column customers.tax_id added.');
    } else {
        console.log('  ⏭  Column customers.tax_id already exists.');
    }

    // Check if country exists
    const [[{ n: hasCountry }]] = await db.query(`
        SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'country'
    `);
    if (!hasCountry) {
        await db.query(`ALTER TABLE customers ADD COLUMN country VARCHAR(64) DEFAULT NULL`);
        console.log('  ✅ Column customers.country added.');
    } else {
        console.log('  ⏭  Column customers.country already exists.');
    }

    // Check if currency exists
    const [[{ n: hasCurrency }]] = await db.query(`
        SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'currency'
    `);
    if (!hasCurrency) {
        await db.query(`ALTER TABLE customers ADD COLUMN currency VARCHAR(8) DEFAULT 'EUR'`);
        console.log('  ✅ Column customers.currency added.');
    } else {
        console.log('  ⏭  Column customers.currency already exists.');
    }

    console.log('✅ Migration 0016 up completed.');
}

export async function down(db) {
    console.log('⏬ Migration 0016: Reverting billing columns from customers table...');

    // Check and drop billing_address
    const [[{ n: hasBillingAddress }]] = await db.query(`
        SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'billing_address'
    `);
    if (hasBillingAddress) {
        await db.query(`ALTER TABLE customers DROP COLUMN billing_address`);
        console.log('  ✅ Column customers.billing_address dropped.');
    }

    // Check and drop tax_id
    const [[{ n: hasTaxId }]] = await db.query(`
        SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'tax_id'
    `);
    if (hasTaxId) {
        await db.query(`ALTER TABLE customers DROP COLUMN tax_id`);
        console.log('  ✅ Column customers.tax_id dropped.');
    }

    // Check and drop country
    const [[{ n: hasCountry }]] = await db.query(`
        SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'country'
    `);
    if (hasCountry) {
        await db.query(`ALTER TABLE customers DROP COLUMN country`);
        console.log('  ✅ Column customers.country dropped.');
    }

    // Check and drop currency
    const [[{ n: hasCurrency }]] = await db.query(`
        SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'currency'
    `);
    if (hasCurrency) {
        await db.query(`ALTER TABLE customers DROP COLUMN currency`);
        console.log('  ✅ Column customers.currency dropped.');
    }

    console.log('✅ Migration 0016 down completed.');
}

export default up;
