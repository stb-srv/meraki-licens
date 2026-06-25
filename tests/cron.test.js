import db from '../server/db.js';
import { jest } from '@jest/globals';
import * as mailerModule from '../server/mailer/index.js';

describe('runOverdueInvoiceCron dunning logic', () => {
    let runOverdueInvoiceCron;

    beforeAll(async () => {
        const mod = await import('../server/cron.js');
        runOverdueInvoiceCron = mod.runOverdueInvoiceCron;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(mailerModule, 'sendTemplateMail').mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('promotes invoice to dunning level 1 when 1 day overdue', async () => {
        const queryCalls = [];
        jest.spyOn(db, 'query').mockImplementation((sql, params) => {
            queryCalls.push({ sql, params });
            if (sql.includes('FROM invoices i')) {
                return [
                    [
                        {
                            id: 'inv1',
                            invoice_number: 'INV-2024-0001',
                            customer_id: 'cust1',
                            amount_gross: 29.0,
                            due_date: '2024-01-01',
                            dunning_level: 0,
                            days_overdue: 1,
                            email: 'test@example.com',
                            customer_name: 'Test Kunde',
                        },
                    ],
                ];
            }
            return [{ affectedRows: 1, insertId: 0 }];
        });
        jest.spyOn(db, 'runTransaction').mockImplementation((fn) => fn());

        await runOverdueInvoiceCron();

        const dunningUpdate = queryCalls.find(
            (c) => c.sql.includes('UPDATE invoices') && c.sql.includes('dunning_level')
        );
        expect(dunningUpdate).toBeDefined();
        expect(dunningUpdate.params[0]).toBe(1);
    });

    test('promotes to level 2 when 7+ days overdue', async () => {
        const queryCalls = [];
        jest.spyOn(db, 'query').mockImplementation((sql, params) => {
            queryCalls.push({ sql, params });
            if (sql.includes('FROM invoices i')) {
                return [
                    [
                        {
                            id: 'inv2',
                            invoice_number: 'INV-2024-0002',
                            customer_id: 'cust1',
                            amount_gross: 59.0,
                            due_date: '2024-01-01',
                            dunning_level: 1,
                            days_overdue: 8,
                            email: 'test@example.com',
                            customer_name: 'Test Kunde',
                        },
                    ],
                ];
            }
            return [{ affectedRows: 1, insertId: 0 }];
        });
        jest.spyOn(db, 'runTransaction').mockImplementation((fn) => fn());

        await runOverdueInvoiceCron();

        const dunningUpdate = queryCalls.find(
            (c) => c.sql.includes('UPDATE invoices') && c.sql.includes('dunning_level')
        );
        expect(dunningUpdate).toBeDefined();
        expect(dunningUpdate.params[0]).toBe(2);
    });

    test('suspends license at dunning level 4 (30+ days overdue)', async () => {
        const queryCalls = [];
        jest.spyOn(db, 'query').mockImplementation((sql, params) => {
            queryCalls.push({ sql, params });
            if (sql.includes('FROM invoices i')) {
                return [
                    [
                        {
                            id: 'inv3',
                            invoice_number: 'INV-2024-0003',
                            customer_id: 'cust99',
                            amount_gross: 199.0,
                            due_date: '2024-01-01',
                            dunning_level: 3,
                            days_overdue: 31,
                            email: 'overdue@example.com',
                            customer_name: 'Overdue Kunde',
                        },
                    ],
                ];
            }
            return [{ affectedRows: 1, insertId: 0 }];
        });
        jest.spyOn(db, 'runTransaction').mockImplementation((fn) => fn());

        await runOverdueInvoiceCron();

        const suspend = queryCalls.find(
            (c) => c.sql.includes('UPDATE licenses') && c.sql.includes('suspended')
        );
        expect(suspend).toBeDefined();
        expect(suspend.params[0]).toBe('cust99');
    });

    test('skips invoice already at target dunning level (idempotent)', async () => {
        const queryCalls = [];
        jest.spyOn(db, 'query').mockImplementation((sql, params) => {
            queryCalls.push({ sql, params });
            if (sql.includes('FROM invoices i')) {
                return [
                    [
                        {
                            id: 'inv4',
                            invoice_number: 'INV-2024-0004',
                            customer_id: 'cust2',
                            amount_gross: 29.0,
                            due_date: '2024-01-01',
                            dunning_level: 1,
                            days_overdue: 3,
                            email: 'test@example.com',
                            customer_name: 'Test',
                        },
                    ],
                ];
            }
            return [{ affectedRows: 0, insertId: 0 }];
        });
        jest.spyOn(db, 'runTransaction').mockImplementation((fn) => fn());

        await runOverdueInvoiceCron();

        const dunningUpdate = queryCalls.find(
            (c) => c.sql.includes('UPDATE invoices') && c.sql.includes('dunning_level')
        );
        expect(dunningUpdate).toBeUndefined();
    });

    test('handles empty overdue list without error', async () => {
        jest.spyOn(db, 'query').mockImplementation((sql) => {
            if (sql.includes('FROM invoices i')) return [[]];
            return [{ affectedRows: 0 }];
        });
        jest.spyOn(db, 'runTransaction').mockImplementation((fn) => fn());

        await expect(runOverdueInvoiceCron()).resolves.not.toThrow();
    });
});

describe('runExpiryCron configurable intervals', () => {
    let runExpiryCron;

    beforeAll(async () => {
        const mod = await import('../server/cron.js');
        runExpiryCron = mod.runExpiryCron;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(mailerModule, 'sendTemplateMail').mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('reads warn intervals from invoice_settings', async () => {
        const queryCalls = [];
        jest.spyOn(db, 'query').mockImplementation((sql) => {
            queryCalls.push(sql);
            if (sql.includes('expiry_warn_days_1')) {
                return [[{ expiry_warn_days_1: 14, expiry_warn_days_2: 3 }]];
            }
            return [[]];
        });

        await runExpiryCron();

        const settingsQuery = queryCalls.find((s) => s.includes('expiry_warn_days_1'));
        expect(settingsQuery).toBeDefined();
    });

    test('falls back to defaults when settings row is missing', async () => {
        jest.spyOn(db, 'query').mockImplementation((sql) => {
            if (sql.includes('expiry_warn_days_1')) return [[]];
            return [[]];
        });

        await expect(runExpiryCron()).resolves.not.toThrow();
    });

    test('marks licenses as expired when past expiry date', async () => {
        const queryCalls = [];
        jest.spyOn(db, 'query').mockImplementation((sql, params) => {
            queryCalls.push({ sql, params });
            if (sql.includes('expiry_warn_days_1'))
                return [[{ expiry_warn_days_1: 30, expiry_warn_days_2: 7 }]];
            if (sql.includes("SET status = 'expired'")) return [{ affectedRows: 2 }];
            return [[]];
        });

        await runExpiryCron();

        const expireUpdate = queryCalls.find((c) => c.sql.includes("SET status = 'expired'"));
        expect(expireUpdate).toBeDefined();
    });
});
