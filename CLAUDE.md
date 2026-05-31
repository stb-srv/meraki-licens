# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

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

## Architecture

**OPA-Santorini License Server** — Node.js (ES Modules) REST API for managing restaurant-CMS licenses. Runs standalone behind nginx/PM2, typically on port 4000.

### Entry point: `server.js`

Startup sequence:
1. Validates required env vars (fails fast with `process.exit(1)` on missing secrets)
2. Tests MySQL connection
3. Runs auto-migrations via `server/migrate.js`
4. Mounts routes and starts Express

### Route structure (`server/routes/`)

| Mount path | File | Auth |
|---|---|---|
| `/api/v1/` | `public.js` | None |
| `/api/admin/` | `admin.js`, `admin-licenses.js`, `admin-customers.js`, `admin-invoices.js`, `admin-stats.js`, `admin-settings.js` | `requireAuth` + optionally `requireSuperAdmin` |
| `/api/portal/` | `customer-portal.js` | `requirePortalAuth` |
| `/api/reseller/` | `reseller.js` | API key |
| `/api/status` | `status.js` | None |

### Auth layers (`server/middleware.js`)

| Layer | Token | Secret | Middleware |
|---|---|---|---|
| Admin / Superadmin | JWT RS256 (or HS256 fallback) | `ADMIN_SECRET` / `RSA_PRIVATE_KEY` | `requireAuth` |
| Superadmin only | same | same | `requireAuth` + `requireSuperAdmin` |
| Customer portal | JWT HS256 | `PORTAL_SECRET` | `requirePortalAuth` (in portal route) |
| License token (CMS-side) | JWT RS256 | `RSA_PRIVATE_KEY` | Verified locally by CMS via public key |
| Offline token | HMAC HS256 | `HMAC_SECRET` | Custom validation in `public.js` |

Admin sessions are tracked in the `admin_sessions` DB table (token hash, revocation). If the table doesn't exist yet (migration pending), JWT signature is accepted as fallback.

### Key modules

- **`server/plans.js`** — Single source of truth for all license plans (`TRIAL`, `FREE`, `STARTER`, `PRO`, `PRO_PLUS`, `ENTERPRISE`). Contains feature flags, device limits, and `expires_days`. Never inline plan logic in routes.
- **`server/db-schema.js`** — Canonical DB field types (`DB_SCHEMA.FIELDS.*`, `DB_SCHEMA.PK.*`). Always import and use these in migrations instead of hardcoding `CHAR(36)` or `VARCHAR(255)`.
- **`server/invoiceHelper.js`** — Invoice creation logic, number sequences, PDF triggering.
- **`server/pdfGenerator.js`** — `pdfkit`-based PDF generation; PDFs saved under `STORAGE_PATH/invoices/`.
- **`server/cron.js`** — Three cron jobs: nonce cleanup, invoice due-date checker, license expiry email warnings.
- **`server/helpers.js`** — `asyncHandler` wrapper and shared utilities; DB logic goes here (not inline in routes).
- **`server/webhook.js`** — HTTP POST dispatcher for external systems on license/invoice events.

### DB migrations (`server/migrations/`)

- Auto-run on every `npm start`; tracked in `schema_migrations` table.
- Naming: `NNNN_short_description.js` (four-digit sequential number).
- Template for new migrations:

```js
import { DB_SCHEMA } from '../db-schema.js';

export async function up(db) {
    await db.query(`
        CREATE TABLE IF NOT EXISTS my_table (
            id          ${DB_SCHEMA.FIELDS.uuid} NOT NULL PRIMARY KEY,
            customer_id ${DB_SCHEMA.PK.customers} NOT NULL,
            name        ${DB_SCHEMA.FIELDS.shortText} NOT NULL,
            created_at  ${DB_SCHEMA.FIELDS.timestamp} DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=${DB_SCHEMA.ENGINE} DEFAULT CHARSET=${DB_SCHEMA.CHARSET};
    `);
}
export default up;
```

> Foreign keys must be added via `ALTER TABLE` **after** table creation. See `0017_invoices.js` as reference.

### Static frontend (`public/`)

Three HTML pages served statically: `index.html` (admin panel), `login.html`, `portal.html` (customer portal). These are served directly by Express.

---

## Code rules

1. **ES Modules only** — `import`/`export` everywhere; no `require()`. Project uses `"type": "module"`.
2. **Use `DB_SCHEMA`** — Never hardcode DB type strings in migrations.
3. **Audit log** — Write to `audit_log` table for all security-relevant actions (login, license changes, deletions).
4. **No DB logic in route handlers** — DB queries belong in `helpers.js`, `invoiceHelper.js`, or new service modules.
5. **Middleware enforcement** — New admin routes need `requireAuth`; superadmin-only routes additionally need `requireSuperAdmin`.
6. **All secrets via `.env`** — See `.env.example` for the full list. Required: `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `ADMIN_SECRET`, `PORTAL_SECRET`, `HMAC_SECRET`.

---

## Tests

Tests live in `tests/` (`admin.test.js`, `portal.test.js`, `public.test.js`). Jest is configured in `jest.config.js` with env vars pre-set (test DB credentials). Tests run against a real MySQL instance — no DB mocking.
