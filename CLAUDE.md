# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

> **Umgebungshinweis:** Claude Code läuft in einer Flatpak-Sandbox — `npm` und `node` sind nicht direkt im PATH. Alle Node-Befehle über `flatpak-spawn --host`:

```bash
flatpak-spawn --host npm start
flatpak-spawn --host npm test
flatpak-spawn --host node server/migrate.js
# Env-Vars übergeben:
flatpak-spawn --host sh -c 'DB_PATH=./data/test.db node server.js'
```

```bash
npm start          # Start server (auto-runs DB migrations)
npm run dev        # Start with --watch (hot reload)
npm test           # Run Jest tests (ESM mode)
node server/migrate.js  # Run migrations standalone (for CI/CD or debug)
```

Run a single test file:
```bash
npx jest tests/admin.test.js
```

Generate secrets:
```bash
openssl rand -hex 48
```

---

## Repository Structure

```
meraki-licens/
├── server.js                        # Express app entry point
├── init.js                          # App initialization helpers
├── jest.config.js                   # Jest test config
├── .env.example                     # Environment variable template
├── package.json                     # Node v18+, ES Modules ("type": "module")
├── server/
│   ├── db.js                        # SQLite wrapper (synchronous API)
│   ├── db-schema.js                 # DB field type constants (DB_SCHEMA)
│   ├── middleware.js                # requireAuth, requireSuperAdmin, rate limiters
│   ├── helpers.js                   # asyncHandler, addAuditLog, shared utilities
│   ├── plans.js                     # Re-exports from @meraki/plans
│   ├── crypto.js                    # RSA/HMAC token signing
│   ├── cron.js                      # Background jobs (expiry, invoices, cleanup)
│   ├── webhook.js                   # Event webhook dispatcher
│   ├── logger.js                    # Pino structured logging
│   ├── invoiceHelper.js             # Invoice creation, numbering, PDF triggering
│   ├── pdfGenerator.js              # pdfkit-based PDF generation
│   ├── smtp.js                      # SMTP configuration helper
│   ├── mailer/
│   │   ├── index.js                 # Nodemailer transporter, sendTemplateMail()
│   │   └── templates.js             # Email template rendering (German)
│   ├── routes/
│   │   ├── public.js                # Setup, Validate, Refresh, Offline Token, Trials
│   │   ├── admin.js                 # Admin login, 2FA, logout
│   │   ├── admin-licenses.js        # License CRUD, bulk ops, upgrade/renew/extend
│   │   ├── admin-customers.js       # Customer CRUD
│   │   ├── admin-invoices.js        # Invoice CRUD, PDF generation, sending
│   │   ├── admin-settings.js        # SMTP, Plans, Admin users, Invoice settings
│   │   ├── admin-stats.js           # Licensing/usage analytics
│   │   ├── customer-portal.js       # Customer login, profile, licenses, invoices
│   │   ├── reseller.js              # Reseller API (trial issuance)
│   │   └── status.js                # Health checks
│   └── migrations/
│       ├── 0001_schema.js           # Complete canonical SQLite schema
│       └── 0002–0021_*.js           # Incremental schema updates
├── public/
│   ├── index.html                   # Admin panel
│   ├── login.html                   # Admin login
│   ├── portal.html                  # Customer portal
│   └── setup.html                   # First-run setup wizard
├── tests/
│   ├── admin.test.js
│   ├── portal.test.js
│   └── public.test.js
└── data/                            # SQLite database directory (gitignored)
```

---

## Architecture

**Meraki License Server** — Node.js (ES Modules) REST API for managing restaurant-CMS licenses. Runs standalone behind nginx/PM2, typically on port 4000.

### Entry point: `server.js`

Startup sequence:
1. Validates required env vars — fails fast with `process.exit(1)` on missing secrets
2. Opens SQLite connection at `DB_PATH` (default: `./data/licens.db`)
3. Runs auto-migrations via `server/migrate.js`
4. Configures Express: helmet (CSP), CORS, static files, JSON body parser
5. Mounts routes (see route table below)
6. Starts cron background jobs
7. Listens on `PORT` (default: 4000)

**CORS Strategy:**
- Static origins from `CORS_ORIGINS` env (comma-separated)
- Dynamic origins from active licenses' `associated_domain` field (queried at request time)
- Exemptions (no CORS check): `/api/v1/public-key`, `/api/v1/heartbeat`, `/api/v1/trial/register`

### Route structure (`server/routes/`)

| Mount path | File | Auth |
|---|---|---|
| `/api/v1/` | `public.js` | None |
| `/api/admin/` | `admin.js`, `admin-licenses.js`, `admin-customers.js`, `admin-invoices.js`, `admin-stats.js`, `admin-settings.js` | `requireAuth` + optionally `requireSuperAdmin` |
| `/api/portal/` | `customer-portal.js` | `requirePortalAuth` |
| `/api/v1/reseller/` | `reseller.js` | `requireResellerKey` (API key) |
| `/api/status` | `status.js` | None |

### Auth layers (`server/middleware.js`)

| Layer | Token type | Secret | Middleware |
|---|---|---|---|
| Admin / Superadmin | JWT RS256 (or HS256 fallback) | `RSA_PRIVATE_KEY` / `ADMIN_SECRET` | `requireAuth` |
| Superadmin only | same | same | `requireAuth` + `requireSuperAdmin` |
| Customer portal | JWT HS256 | `PORTAL_SECRET` | `requirePortalAuth` (in portal route) |
| License token (CMS-side) | JWT RS256 | `RSA_PUBLIC_KEY` | Verified locally by CMS |
| Offline token | JWT HS256 | `HMAC_SECRET` | Custom validation in `public.js` |

Admin sessions are tracked in the `admin_sessions` DB table (token hash + revocation flag).
Customer sessions are tracked in `customer_sessions` similarly.

**Rate limiters (in `middleware.js`):**

| Limiter | Limit | Applied to |
|---|---|---|
| `loginLimiter` | 10/15 min | Admin login |
| `setupLimiter` | 5/hour | First-run setup |
| `trialLimiter` | 3/day per IP | Trial registration |
| `validateLimiter` | 30/min | License validation |
| `offlineTokenLimiter` | 20/15 min | Offline token requests |
| `bulkLimiter` | 10/min | Bulk license operations |

**IP Whitelist:** `ADMIN_IP_WHITELIST` env (comma-separated IPs or `*`) applied via `requireIpWhitelist` on all admin routes.

### Key modules

- **`server/plans.js`** — Re-exports `PLAN_DEFINITIONS` and `PLAN_MODULES` from `@meraki/plans` (`../meraki-plans/`). **Never** define plans here directly — always edit in the shared package `meraki-plans/index.js` so CMS and license server stay in sync.
- **`server/db-schema.js`** — Canonical DB field types (`DB_SCHEMA.FIELDS.*`, `DB_SCHEMA.PK.*`). Always import and use these in migrations instead of hardcoding type strings.
- **`server/crypto.js`** — RSA/HMAC token signing: `signAdminToken()`, `signLicenseToken()`, `signOfflineToken()`, `signResponse()`.
- **`server/invoiceHelper.js`** — Invoice creation logic, number sequences, PDF triggering. All functions are synchronous.
- **`server/pdfGenerator.js`** — `pdfkit`-based PDF generation; PDFs saved under `STORAGE_PATH/invoices/`. Exports `generateInvoicePDF(data, path)` and `getInvoicePDFBuffer(data)`.
- **`server/cron.js`** — Background jobs: nonce cleanup, invoice due-date checker, license expiry email warnings, auto-invoice generation.
- **`server/helpers.js`** — `asyncHandler` wrapper, `addAuditLog()`, `normalizeDomain()`, `domainMatches()`, `toDbDate()`, `parseJsonField()`. DB logic goes here, not inline in routes.
- **`server/webhook.js`** — HTTP POST dispatcher (`fireWebhook(event, payload)`) for external systems on license/invoice events.
- **`server/logger.js`** — Pino structured logger; log level via `LOG_LEVEL` env (default: `'info'`).
- **`server/mailer/index.js`** — Nodemailer transporter; exports `sendTemplateMail(template, email, context)` and `sendMail(options)`. SMTP config: DB first, then env fallback.
- **`server/mailer/templates.js`** — All email templates in German. Render with `renderTemplate(name, context)` → `{ subject, html, text }`.

---

## Database (SQLite / better-sqlite3)

**`server/db.js` exports a synchronous API** — no `await` on DB calls:
```js
const [rows] = db.query('SELECT * FROM licenses WHERE license_key = ?', [key]);
const [[row]] = db.query('SELECT * FROM licenses WHERE license_key = ?', [key]); // first row
const [result] = db.query('INSERT INTO ...', [...]);  // { affectedRows, insertId }
db.runTransaction(() => { db.query(...); db.query(...); }); // atomic, auto-rollback on throw
```

**Pragmas set on open:** `journal_mode = WAL` (better concurrency), `foreign_keys = ON`.

**Dates** — store as ISO strings: `new Date().toISOString().slice(0, 19).replace('T', ' ')`.
Use the helper: `toDbDate(new Date())` from `server/helpers.js`.
Never pass `Date` objects directly to `db.query()` — better-sqlite3 converts them to Unix timestamps.

**SQLite date functions** (replacing MySQL equivalents):
- `NOW()` → `datetime('now')`
- `DATE_ADD(NOW(), INTERVAL 30 DAY)` → `datetime('now', '+30 days')`
- `DATEDIFF(NOW(), col)` → `CAST(julianday('now') - julianday(col) AS INTEGER)`
- `CURDATE()` → `date('now')`
- `DATE_FORMAT(NOW(), '%Y-%m-01')` → `strftime('%Y-%m-01', 'now')`

**LIKE with escape** — always add `ESCAPE '\\'` when the search string is user-supplied:
```js
where += ` AND name LIKE ? ESCAPE '\\'`;
```

**Upsert** — `ON DUPLICATE KEY UPDATE` → `ON CONFLICT(col) DO UPDATE SET x = excluded.x`

**JSON queries** — `JSON_CONTAINS(tags, JSON_QUOTE(?))` → `EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)`

### DB Schema Overview

The canonical schema lives in `server/migrations/0001_schema.js`. Key tables:

| Table | PK type | Purpose |
|---|---|---|
| `admins` | INTEGER AUTO | Admin users; `role` = `admin`/`superadmin`; optional 2FA (TOTP) |
| `customers` | TEXT UUID | Customer accounts; billing address, `portal_username`, `must_change_password` flag |
| `licenses` | TEXT (key) | License records; `type`, `status`, `associated_domain`, `expires_at`, JSON `allowed_modules`/`limits`/`tags` |
| `devices` | TEXT UUID | Device registrations linked to a license |
| `invoices` | TEXT UUID | `status` = draft/sent/paid/overdue/cancelled; `type` = invoice/credit_note/reminder/renewal |
| `invoice_items` | INTEGER AUTO | Line items per invoice |
| `invoice_settings` | INTEGER (singleton row id=1) | Company info, invoice prefix, `next_number` sequence |
| `admin_sessions` | TEXT UUID | JWT hash + `revoked` flag + `expires_at` (8h) |
| `customer_sessions` | TEXT UUID | Portal JWT hash + `revoked` flag + `expires_at` (24h) |
| `audit_log` | TEXT UUID | `action`, `actor`, `details` (JSON), `ts` |
| `used_nonces` | TEXT | Replay-attack prevention; cleaned hourly |
| `webhooks` | INTEGER AUTO | Webhook subscriptions (url, secret, events) |
| `webhook_logs` | TEXT UUID | Webhook dispatch history |
| `reseller_keys` | INTEGER AUTO | `api_key`, quota tracking (`max_trials`, `used_trials`) |
| `license_heartbeats` | TEXT PK (license_key) | Latest heartbeat per license |
| `purchase_history` | TEXT UUID | Order history (purchase/renewal) |
| `smtp_config` | INTEGER (singleton row id=1) | SMTP settings (overrides env vars) |

**JSON columns** (`tags`, `allowed_modules`, `limits`, `validated_domains`) — store as JSON strings; parse with `parseJsonField(val, default)` from `helpers.js`.

### DB migrations (`server/migrations/`)

- Auto-run on every `npm start`; tracked in `schema_migrations` table.
- `0001_schema.js` contains the **complete current schema**. Incremental migrations exist up to `0021_*.js`. New migrations should use the next sequential number (currently `0022_...`).
- Naming: `NNNN_short_description.js` (four-digit sequential number).
- Template for new migrations (synchronous):

```js
export function up(db) {   // no async — better-sqlite3 is synchronous
    db.exec(`
        CREATE TABLE IF NOT EXISTS my_table (
            id         TEXT NOT NULL PRIMARY KEY,
            name       TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );
    `);
}
export default up;
```

> Foreign keys are declared inline in `CREATE TABLE` (no `ALTER TABLE` needed). SQLite FK enforcement is enabled via `PRAGMA foreign_keys = ON`.

---

## Environment Variables

**Required:**
- `ADMIN_SECRET` — Admin JWT signing secret (min 32 chars in production)
- `PORTAL_SECRET` — Portal JWT signing secret
- `HMAC_SECRET` — Offline token & response HMAC signing (min 32 chars)

**Optional:**
- `DB_PATH` — SQLite file path (default: `./data/licens.db`)
- `PORT` — Server port (default: 4000)
- `NODE_ENV` — `'test'`, `'development'`, or production (affects logging, migrations)
- `CORS_ORIGINS` — Comma-separated allowed origins
- `ADMIN_IP_WHITELIST` — Comma-separated IPs or `*`
- `RSA_PRIVATE_KEY` / `RSA_PUBLIC_KEY` — PEM format (`\n` escaped); enables RS256 admin & license tokens
- `SETUP_TOKEN` — Enables `POST /api/v1/setup` for first admin creation
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — Email config (overridden by `smtp_config` DB table)
- `PORTAL_URL` — Base URL for portal links in emails
- `APP_URL` — Base URL for app links in emails
- `STORAGE_PATH` — Invoice PDF directory (default: `./storage`)
- `WEBHOOK_URL` — Default webhook endpoint
- `WEBHOOK_SECRET` — HMAC signature secret for default webhook
- `LOG_LEVEL` — Pino log level (default: `'info'`)

See `.env.example` for the full annotated list.

---

## Common Coding Patterns

### DB query pattern

```js
// SELECT → [rows]
const [rows] = db.query('SELECT * FROM licenses', []);
const [[row]] = db.query('SELECT * FROM licenses LIMIT 1', []);

// INSERT/UPDATE/DELETE → [{ affectedRows, insertId }]
const [result] = db.query('INSERT INTO licenses (...) VALUES (?, ?)', [v1, v2]);

// Transaction (atomic, auto-rollback on throw)
db.runTransaction(() => {
    db.query('INSERT ...');
    db.query('UPDATE ...');
});
```

### Error handling

```js
import { asyncHandler } from '../middleware.js';

router.post('/endpoint', requireAuth, asyncHandler(async (req, res) => {
    // thrown errors propagate to the global error handler
}));
```

### JSON fields

```js
import { parseJsonField } from '../helpers.js';

const tags = parseJsonField(row.tags, []);           // safe parse, default []
db.query('UPDATE licenses SET tags = ?', [JSON.stringify(newTags)]);
```

### Date handling

```js
import { toDbDate } from '../helpers.js';

const now = toDbDate(new Date());                                   // 'YYYY-MM-DD HH:MM:SS'
const future = toDbDate(new Date(Date.now() + 30 * 86_400_000));
```

### Domain utilities

```js
import { normalizeDomain, domainMatches } from '../helpers.js';

normalizeDomain('https://www.example.com/path');    // 'example.com'
domainMatches('*.example.com', 'sub.example.com');  // true
```

### Audit logging

```js
import { addAuditLog } from '../helpers.js';

addAuditLog('license.status_changed', { key, from: old, to: newStatus }, req.admin.username);
```

---

## Tokens & Signing (`server/crypto.js`)

| Token | Algorithm | Secret | Expiry | Used by |
|---|---|---|---|---|
| Admin JWT | RS256 (or HS256 fallback) | `RSA_PRIVATE_KEY` / `ADMIN_SECRET` | 8h | Admin routes |
| License token | RS256 | `RSA_PRIVATE_KEY` | 80h | CMS verifies locally |
| Portal JWT | HS256 | `PORTAL_SECRET` | 24h | Customer portal |
| Offline token | HS256 | `HMAC_SECRET` | 1–168h | CMS offline cache |
| Response HMAC | sha256 | `HMAC_SECRET` | n/a | `_sig` + `_ts` fields |

RS256 is used when both `RSA_PRIVATE_KEY` and `RSA_PUBLIC_KEY` env vars are set. Otherwise falls back to HS256.

---

## License Validation (`server/routes/public.js`)

**Primary endpoint:** `POST /api/v1/validate`

**Validations (in order):**
1. License exists
2. Status = `active`
3. Not expired
4. Domain matches (`associated_domain`; wildcard `*` allows any)
5. Device limit not exceeded (if `max_devices > 0`)
6. Nonce not replayed

**Side effects on success:**
- Increments `usage_count`, updates `last_validated`, `validated_domains`
- Registers new devices in `devices` table
- Records daily usage in `analytics_daily`

**Offline token:** `POST /api/v1/offline-token` — HS256 JWT, cached locally by CMS, valid 1–168h.

---

## Invoice System

**Invoice numbering:** `{prefix}-{year}-{0001}` — sequence stored in `invoice_settings.next_number`; skips numbers already in use.

**Prices (EUR, hard-coded):** FREE/TRIAL: 0, STARTER: 29, PRO: 59, PRO_PLUS: 89, ENTERPRISE: 199. VAT: 19%.

**Auto-generation triggers:**
- License creation (paid plan) → draft invoice via `createInvoiceFromLicense()`
- Renewal → renewal invoice via `createInvoiceForRenewal()`
- Upgrade (to paid plan) → optionally generates invoice

**PDF storage:** `STORAGE_PATH/invoices/{filename}.pdf`

---

## Background Jobs (`server/cron.js`)

| Job | Schedule | Action |
|---|---|---|
| `runExpiryCron` | Daily | Sends 30-day & 7-day expiry warning emails; auto-expires past-due licenses; fires webhooks |
| `runNonceCleanup` | Hourly | Deletes nonces >2h old; cleans revoked/expired sessions |
| `runOverdueInvoiceCron` | Daily | Marks overdue invoices; sends dunning emails |
| `runAutoInvoiceCron` | Daily | Creates draft renewal invoices for licenses expiring in 7 days |

---

## Webhooks (`server/webhook.js`)

**Function:** `fireWebhook(event, payload)` — async, non-blocking.

**Event types:**
- `license.status_changed`, `license.renewed`, `license.upgraded`, `license.transferred`, `license.deleted`
- `trial.registered`
- `licenses.auto_expired` (batch)
- `invoice.auto_generated`

**Dispatch:** POSTs JSON to URLs from `WEBHOOK_URL` env + `webhooks` DB table. Adds `X-MERAKI-Signature: sha256_hex` header if secret configured. 5s timeout. Logs success/failure in `webhook_logs`.

---

## Email Templates (`server/mailer/templates.js`)

All templates are in German. Available template names:

`trialWelcome`, `licenseCreated`, `licenseRevoked`, `licenseRenewed`, `accountCreated`, `portalInvite`, `invoiceSent`, `invoiceOverdue`, `licenseExpiringSoon`, `licenseExpiring7d`

Usage:
```js
import { sendTemplateMail } from '../mailer/index.js';

await sendTemplateMail('licenseRenewed', customer.email, {
    customer_name: customer.name,
    license_key: license.license_key,
    expires_at: license.expires_at,
    portal_url: process.env.PORTAL_URL,
});
```

---

## Static Frontend (`public/`)

Four HTML pages served statically by Express:
- `index.html` — Admin panel (SPA)
- `login.html` — Admin login
- `portal.html` — Customer portal
- `setup.html` — First-run setup wizard (shown when no admins exist)

---

## Code Rules

1. **ES Modules only** — `import`/`export` everywhere; no `require()`. Project uses `"type": "module"`.
2. **Use `DB_SCHEMA`** — Never hardcode DB type strings in migrations; import from `server/db-schema.js`.
3. **Audit log** — Write to `audit_log` table for all security-relevant actions (login, license changes, deletions, 2FA changes).
4. **No DB logic in route handlers** — DB queries belong in `helpers.js`, `invoiceHelper.js`, or new service modules.
5. **Middleware enforcement** — New admin routes need `requireAuth`; superadmin-only routes additionally need `requireSuperAdmin`.
6. **All secrets via `.env`** — Required: `ADMIN_SECRET`, `PORTAL_SECRET`, `HMAC_SECRET`. See `.env.example` for the full list.
7. **Never define plans here** — Always edit `meraki-plans/index.js` (shared package) so CMS and license server stay in sync.
8. **Synchronous DB** — Never `await` a `db.query()` call — better-sqlite3 is synchronous.

---

## Tests

Tests live in `tests/` (`admin.test.js`, `portal.test.js`, `public.test.js`). Jest is configured in `jest.config.js` with env vars pre-set. Tests use `jest.spyOn(db, 'query')` mocks — no real database needed.

Run all tests:
```bash
npm test
```

Run a single file:
```bash
npx jest tests/admin.test.js
```
