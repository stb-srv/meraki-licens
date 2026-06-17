import request from 'supertest';
import { app } from '../server.js';
import db from '../server/db.js';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';

const PORTAL_SECRET = 'portal-secure-test-secret';
// Inject secret for test
process.env.PORTAL_SECRET = PORTAL_SECRET;

describe('Customer Portal API', () => {
    let portalToken;

    beforeAll(() => {
        portalToken = jwt.sign({ customer_id: 'cust1', type: 'portal' }, PORTAL_SECRET);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('GET /api/portal/me should require login', async () => {
        const res = await request(app).get('/api/portal/me');
        expect(res.statusCode).toBe(401);
    });

    test('GET /api/portal/me should return customer data when logged in', async () => {
        const mockDb = jest.spyOn(db, 'query').mockImplementation((sql, params) => {
            if (sql.includes('FROM customer_sessions')) {
                return Promise.resolve([[{ id: 'sess1' }], []]);
            }
            if (sql.includes('FROM customers WHERE id = ?')) {
                return Promise.resolve([[{ id: 'cust1', name: 'Max Mustermann', email: 'max@test.de', must_change_password: 0 }], []]);
            }
            return Promise.resolve([[], []]);
        });

        const res = await request(app)
            .get('/api/portal/me')
            .set('Authorization', `Bearer ${portalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.customer.name).toBe('Max Mustermann');
        
        mockDb.mockRestore();
    });

    test('PATCH /api/portal/licenses/:key/domain should validate domain format', async () => {
        jest.spyOn(db, 'query').mockImplementation((sql, params) => {
             if (sql.includes('FROM customer_sessions')) return Promise.resolve([[{ id: 's1' }], []]);
             if (sql.includes('FROM customers')) return Promise.resolve([[{ id: 'cust1' }], []]);
             return Promise.resolve([[], []]);
        });

        const res = await request(app)
            .patch('/api/portal/licenses/KEY123/domain')
            .set('Authorization', `Bearer ${portalToken}`)
            .send({ domain: 'invalid domain' });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toContain('Ungültige Domain');
    });

    test('PATCH /api/portal/update-profile should validate billing fields', async () => {
        jest.spyOn(db, 'query').mockImplementation((sql, params) => {
             if (sql.includes('FROM customer_sessions')) return Promise.resolve([[{ id: 's1' }], []]);
             if (sql.includes('FROM customers')) return Promise.resolve([[{ id: 'cust1' }], []]);
             return Promise.resolve([[], []]);
        });

        // 1. Invalid zip code (letters/numbers only, max 10 chars)
        let res = await request(app)
            .patch('/api/portal/update-profile')
            .set('Authorization', `Bearer ${portalToken}`)
            .send({ billing_zip: '12345-67890' });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toContain('Postleitzahl ist ungültig');

        // 2. Invalid country code (2-letter ISO only)
        res = await request(app)
            .patch('/api/portal/update-profile')
            .set('Authorization', `Bearer ${portalToken}`)
            .send({ billing_country: 'GER' });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toContain('Ungültiges Land');
    });

    test('PATCH /api/portal/update-profile should update billing fields when valid', async () => {
        const mockDb = jest.spyOn(db, 'query').mockImplementation((sql, params) => {
             if (sql.includes('FROM customer_sessions')) return Promise.resolve([[{ id: 's1' }], []]);
             if (sql.includes('FROM customers WHERE id = ?')) {
                 return Promise.resolve([[{ 
                     id: 'cust1', name: 'Max', email: 'max@test.de', 
                     billing_street: 'Hauptstr. 1', billing_city: 'Berlin', 
                     billing_zip: '10115', billing_country: 'DE', tax_id: 'DE123456789'
                 }], []]);
             }
             return Promise.resolve([[], []]);
        });

        const res = await request(app)
            .patch('/api/portal/update-profile')
            .set('Authorization', `Bearer ${portalToken}`)
            .send({ 
                billing_street: 'Hauptstr. 1', 
                billing_city: 'Berlin', 
                billing_zip: '10115', 
                billing_country: 'de', 
                tax_id: 'DE123456789' 
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.customer.billing_street).toBe('Hauptstr. 1');
        expect(res.body.customer.billing_zip).toBe('10115');
        expect(res.body.customer.billing_country).toBe('DE'); // converted to uppercase
        expect(res.body.customer.tax_id).toBe('DE123456789');

        mockDb.mockRestore();
    });

    test('POST /api/portal/login should reject unverified customer', async () => {
        const mockDb = jest.spyOn(db, 'query').mockImplementation((sql, params) => {
            if (sql.includes('FROM customers')) {
                return Promise.resolve([[{ id: 'cust1', name: 'Max', email: 'max@test.de', password_hash: 'hashed', verified: 0 }], []]);
            }
            return Promise.resolve([[], []]);
        });
        const mockCompare = jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

        const res = await request(app)
            .post('/api/portal/login')
            .send({ email: 'max@test.de', password: 'password123' });

        expect(res.statusCode).toBe(403);
        expect(res.body.email_not_verified).toBe(true);

        mockDb.mockRestore();
        mockCompare.mockRestore();
    });

    test('POST /api/portal/register should validate and register user', async () => {
        const mockDb = jest.spyOn(db, 'query').mockImplementation((sql, params) => {
            if (sql.includes('SELECT id FROM customers WHERE email = ?')) {
                return Promise.resolve([[], []]); // email not taken
            }
            if (sql.includes('SELECT COUNT(*) AS n FROM customers WHERE portal_username = ?')) {
                return Promise.resolve([[{ n: 0 }], []]);
            }
            if (sql.includes('FROM smtp_config')) {
                return Promise.resolve([[{
                    id: 1,
                    host: 'localhost',
                    port: 587,
                    smtp_user: 'test',
                    smtp_pass: 'test',
                    smtp_from: 'test@test.de'
                }], []]);
            }
            return Promise.resolve([[], []]);
        });
        const mockCreateTransport = jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
            sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-id' }),
            verify: jest.fn().mockResolvedValue(true)
        });

        const res = await request(app)
            .post('/api/portal/register')
            .send({
                name: 'Test Customer',
                email: 'newcust@test.de',
                password: 'supersecretpassword10',
                company: 'My Company',
                billing_street: 'Test Road 10',
                billing_city: 'Munich',
                billing_zip: '80331',
                billing_country: 'DE'
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('Registrierung erfolgreich');

        mockDb.mockRestore();
        mockCreateTransport.mockRestore();
    });

    test('POST /api/portal/verify-email should verify token', async () => {
        const mockDb = jest.spyOn(db, 'query').mockImplementation((sql, params) => {
            if (sql.includes('SELECT id FROM customers WHERE email_verify_token = ?')) {
                return Promise.resolve([[{ id: 'cust1' }], []]);
            }
            return Promise.resolve([[], []]);
        });

        const res = await request(app)
            .post('/api/portal/verify-email')
            .send({ token: 'sometoken' });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

        mockDb.mockRestore();
    });

    test('GET /api/portal/plans should return active plans', async () => {
        const res = await request(app).get('/api/portal/plans');
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.plans)).toBe(true);
        expect(res.body.plans.length).toBeGreaterThan(0);
        expect(res.body.plans[0]).toHaveProperty('id');
        expect(res.body.plans[0]).toHaveProperty('price');
    });

    test('POST /api/portal/licenses/book should book license and create invoice', async () => {
        const mockDb = jest.spyOn(db, 'query').mockImplementation((sql, params) => {
            if (sql.includes('FROM customer_sessions')) return Promise.resolve([[{ id: 's1' }], []]);
            if (sql.includes('FROM customers WHERE id = ?')) {
                return Promise.resolve([[{ id: 'cust1', name: 'Max', email: 'max@test.de', verified: 1 }], []]);
            }
            return Promise.resolve([[], []]);
        });

        // Mock db.getConnection for transaction in createInvoiceFromLicense
        const mockConn = {
            beginTransaction: jest.fn().mockResolvedValue(true),
            commit: jest.fn().mockResolvedValue(true),
            rollback: jest.fn().mockResolvedValue(true),
            release: jest.fn().mockResolvedValue(true),
            query: jest.fn().mockImplementation((sql, params) => {
                if (sql.includes('SELECT invoice_prefix, next_number FROM invoice_settings')) {
                    return Promise.resolve([[{ invoice_prefix: 'INV', next_number: 1 }], []]);
                }
                if (sql.includes('SELECT * FROM licenses WHERE license_key = ?')) {
                    return Promise.resolve([[{ license_key: 'MERAKI-PRO-1234-2026', customer_id: 'cust1', type: 'PRO' }], []]);
                }
                if (sql.includes('SELECT name, currency FROM customers WHERE id = ?')) {
                    return Promise.resolve([[{ name: 'Max', currency: 'EUR' }], []]);
                }
                return Promise.resolve([[], []]);
            })
        };
        const mockGetConnection = jest.spyOn(db, 'getConnection').mockResolvedValue(mockConn);

        const res = await request(app)
            .post('/api/portal/licenses/book')
            .set('Authorization', `Bearer ${portalToken}`)
            .send({ plan_id: 'PRO', domain: 'myrestaurant.de' });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.license_key).toBeDefined();
        expect(res.body.invoice_id).toBeDefined();

        mockDb.mockRestore();
        mockGetConnection.mockRestore();
    });

    // ── Upgrade endpoint (B4) ─────────────────────────────────────────────────

    test('POST /api/portal/licenses/:key/upgrade requires auth', async () => {
        const res = await request(app)
            .post('/api/portal/licenses/TEST-KEY/upgrade')
            .send({ new_type: 'PRO' });
        expect(res.statusCode).toBe(401);
    });

    test('POST /api/portal/licenses/:key/upgrade rejects downgrade', async () => {
        jest.spyOn(db, 'query').mockImplementation((sql) => {
            if (sql.includes('FROM customer_sessions')) return Promise.resolve([[{ id: 's1' }], []]);
            if (sql.includes('FROM customers')) return Promise.resolve([[{ id: 'cust1', name: 'Test', email: 'test@example.com' }], []]);
            if (sql.includes('FROM licenses WHERE license_key')) {
                return Promise.resolve([[{ license_key: 'K1', type: 'PRO', status: 'active', customer_id: 'cust1', expires_at: '2025-12-31' }], []]);
            }
            return Promise.resolve([[], []]);
        });

        const res = await request(app)
            .post('/api/portal/licenses/K1/upgrade')
            .set('Authorization', `Bearer ${portalToken}`)
            .send({ new_type: 'STARTER' });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/downgrade|Downgrade/i);
    });

    test('POST /api/portal/licenses/:key/upgrade rejects invalid plan type', async () => {
        jest.spyOn(db, 'query').mockImplementation((sql) => {
            if (sql.includes('FROM customer_sessions')) return Promise.resolve([[{ id: 's1' }], []]);
            if (sql.includes('FROM customers')) return Promise.resolve([[{ id: 'cust1', name: 'Test', email: 'test@example.com' }], []]);
            return Promise.resolve([[], []]);
        });

        const res = await request(app)
            .post('/api/portal/licenses/K1/upgrade')
            .set('Authorization', `Bearer ${portalToken}`)
            .send({ new_type: 'INVALID_PLAN' });

        expect(res.statusCode).toBe(400);
    });

    test('POST /api/portal/licenses/:key/upgrade returns 404 when license not found', async () => {
        jest.spyOn(db, 'query').mockImplementation((sql) => {
            if (sql.includes('FROM customer_sessions')) return Promise.resolve([[{ id: 's1' }], []]);
            if (sql.includes('FROM customers')) return Promise.resolve([[{ id: 'cust1', name: 'Test', email: 'test@example.com' }], []]);
            if (sql.includes('FROM licenses WHERE license_key')) return Promise.resolve([[], []]);
            return Promise.resolve([[], []]);
        });

        const res = await request(app)
            .post('/api/portal/licenses/NOTEXIST/upgrade')
            .set('Authorization', `Bearer ${portalToken}`)
            .send({ new_type: 'PRO' });

        expect(res.statusCode).toBe(404);
    });

    // ── Stats endpoint (C5) ───────────────────────────────────────────────────

    test('GET /api/portal/stats requires auth', async () => {
        const res = await request(app).get('/api/portal/stats');
        expect(res.statusCode).toBe(401);
    });

    test('GET /api/portal/stats returns stats object when authenticated', async () => {
        jest.spyOn(db, 'query').mockImplementation((sql) => {
            if (sql.includes('FROM customer_sessions')) return Promise.resolve([[{ id: 's1' }], []]);
            if (sql.includes('FROM customers')) return Promise.resolve([[{ id: 'cust1', name: 'Test', email: 'test@example.com' }], []]);
            if (sql.includes('SUM(usage_count)')) {
                return Promise.resolve([[{ total_validations: 42, active_licenses: 2 }], []]);
            }
            if (sql.includes('license_devices')) {
                return Promise.resolve([[{ active_devices: 5 }], []]);
            }
            if (sql.includes('analytics_features')) return Promise.resolve([[], []]);
            return Promise.resolve([[], []]);
        });

        const res = await request(app)
            .get('/api/portal/stats')
            .set('Authorization', `Bearer ${portalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.stats).toBeDefined();
    });
});
