import request from 'supertest';
import { app } from '../server.js';
import db from '../server/db.js';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const ADMIN_SECRET = 'secure-test-secret';

describe('Admin API', () => {
    let adminToken;

    beforeAll(() => {
        // Create a valid token for tests
        adminToken = jwt.sign({ username: 'testadmin', role: 'superadmin' }, ADMIN_SECRET);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('POST /api/admin/login should work with correct credentials', async () => {
        const passwordHash = await bcrypt.hash('password123', 12);

        // Mock DB for login (better-sqlite3 adapter is synchronous: returns [rows])
        const mockQuery = jest.spyOn(db, 'query').mockImplementation((sql) => {
            if (sql.includes('FROM admins WHERE username = ?')) {
                return [
                    [
                        {
                            id: 1,
                            username: 'testadmin',
                            password_hash: passwordHash,
                            role: 'superadmin',
                            two_factor_enabled: 0,
                        },
                    ],
                ];
            }
            if (sql.includes('INSERT INTO admin_sessions')) {
                return [{ affectedRows: 1 }];
            }
            if (sql.includes('INSERT INTO audit_log')) {
                return [{ affectedRows: 1 }];
            }
            return [[]];
        });

        const res = await request(app)
            .post('/api/admin/login')
            .send({ username: 'testadmin', password: 'password123' });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body).toHaveProperty('token');

        mockQuery.mockRestore();
    });

    test('GET /api/admin/licenses should require authentication', async () => {
        const res = await request(app).get('/api/admin/licenses');
        expect(res.statusCode).toBe(401);
    });

    test('GET /api/admin/licenses should work with valid token', async () => {
        // Mock DB for session check and license list
        const mockDb = jest.spyOn(db, 'query').mockImplementation((sql) => {
            if (sql.includes('FROM admin_sessions')) {
                return [[{ id: 'sess1' }]];
            }
            if (sql.includes('COUNT(*)')) {
                return [[{ total: 1 }]];
            }
            if (sql.includes('SELECT * FROM licenses')) {
                return [[{ license_key: 'TEST-KEY', type: 'PRO' }]];
            }
            return [[]];
        });

        const res = await request(app)
            .get('/api/admin/licenses')
            .set('Authorization', `Bearer ${adminToken}`);

        if (res.statusCode !== 200) {
            console.error('Admin Licenses Error:', res.body);
        }

        expect(res.statusCode).toBe(200);
        expect(res.body.licenses).toBeDefined();
        expect(res.body.licenses[0].license_key).toBe('TEST-KEY');

        mockDb.mockRestore();
    });

    test('GET /api/admin/stats/invoices should return correct KPIs', async () => {
        const mockDb = jest.spyOn(db, 'query').mockImplementation((sql) => {
            if (sql.includes('FROM admin_sessions')) {
                return [[{ id: 'sess1' }]];
            }
            if (sql.includes('total_invoiced')) {
                return [
                    [
                        {
                            total_invoiced: 250.0,
                            total_paid: 150.0,
                            total_open: 50.0,
                            total_overdue: 50.0,
                            count_draft: 1,
                            count_sent: 1,
                            count_overdue: 1,
                            count_paid: 1,
                        },
                    ],
                ];
            }
            if (sql.includes('mrr')) {
                return [[{ mrr: 150.0 }]];
            }
            if (sql.includes('days_overdue')) {
                return [
                    [
                        {
                            invoice_number: 'INV-2026-0001',
                            customer_name: 'Max',
                            amount_gross: 50.0,
                            due_date: '2026-05-01',
                            days_overdue: 18,
                        },
                    ],
                ];
            }
            if (sql.includes('paid_at')) {
                return [
                    [
                        {
                            invoice_number: 'INV-2026-0002',
                            customer_name: 'Max',
                            amount_gross: 150.0,
                            paid_at: '2026-05-18',
                        },
                    ],
                ];
            }
            return [[]];
        });

        const res = await request(app)
            .get('/api/admin/stats/invoices')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.total_invoiced).toBe(250);
        expect(res.body.total_paid).toBe(150);
        expect(res.body.mrr).toBe(150);
        expect(res.body.overdue_invoices[0].invoice_number).toBe('INV-2026-0001');
        expect(res.body.recent_paid[0].invoice_number).toBe('INV-2026-0002');

        mockDb.mockRestore();
    });
});
