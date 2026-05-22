# Agent-Prompt: licens-srv_OPA-Santorini — Vollständige Analyse & Ausbau

## Repository
https://github.com/stb-srv/licens-srv_OPA-Santorini

## Projektstatus (Stand: Mai 2026)

### ✅ Bereits korrekt implementiert (NICHT anfassen)
- `normalizeLicense()` in `server/routes/admin-licenses.js` — alle JSON-Felder werden normalisiert
- `safeParse()` in `public/index.html` — defensives JSON-Parsing
- `openCreateLicenseForCustomer()` in `public/index.html` — Lizenz aus Kunden erstellen
- `resetNewLicenseModal()` und `nl-customer-info`-Block im Lizenz-Modal
- `POST /api/portal/register` in `server/routes/customer-portal.js` — Selbstregistrierung existiert serverseitig
- `normalizeLicense` auf alle GET/POST/PATCH-Responses in admin-licenses.js angewendet
- Rate-Limiter auf allen kritischen Routen (login, register, validate)
- IP-Whitelist (`requireIpWhitelist`) auf allen `/api/admin/*`-Routes
- Session-Blacklist in `requireAuth` (admin_sessions-Tabelle)
- `must_change_password`-Flow im Kunden-Portal

---

## Aufgabe 1 — Login-Landing-Page (NEU)

Erstelle eine neue Datei `public/login.html` als zentrale Einstiegsseite mit zwei klar getrennten Login-Bereichen.

### Design-Anforderungen
- Selbes CSS-Schema wie `public/portal.html` (CSS-Variablen: `--bg`, `--bg2`, `--surface`, `--accent`, `--text`, `--text2`, `--border`)
- Dark/Light-Mode-Toggle (wie in portal.html)
- Responsiv, mobile-first
- Kein Tailwind, kein Framework — reines Vanilla-CSS/JS

### Struktur der login.html

```
┌─────────────────────────────────────────────────────┐
│  [Logo / Titel: OPA! Santorini License]    [🌙]    │
├──────────────────────┬──────────────────────────────┤
│   KUNDEN-PORTAL      │    ADMIN-VERWALTUNG          │
│  ──────────────────  │   ──────────────────────     │
│  E-Mail              │   Benutzername               │
│  Passwort            │   Passwort                   │
│  [Einloggen]         │   [Admin Login]              │
│                      │                              │
│  [Registrieren]      │   (kein öffentl. Register)   │
│  [Passwort vergessen]│                              │
└──────────────────────┴──────────────────────────────┘
```

Bei mobile: beide Blöcke untereinander mit Tab-Navigation (Kunde / Admin).

### Funktionen in login.html

#### Kunden-Login
```js
// POST /api/portal/login — mit {email, password}
// Bei Erfolg: token in sessionStorage, redirect zu portal.html
// Bei must_change_password: redirect zu portal.html?setup=1
// Fehler: inline unter dem Formular anzeigen
```

#### Kunden-Registrierung (Modal oder Inline-Toggle)
Zeige ein Registrierungs-Formular mit:
- Name *
- E-Mail *
- Passwort * (min. 10 Zeichen)
- Passwort wiederholen *
- Firma (optional)
- Telefon (optional)
- Checkbox: AGB / Datenschutz akzeptiert *

```js
// POST /api/portal/register — mit {name, email, password, company, phone}
// Bei Erfolg: "Registrierung erfolgreich. Bitte E-Mail bestätigen." anzeigen
// (server sendet Verification-Mail wenn SMTP konfiguriert)
// Fehler: inline anzeigen
```

#### Passwort vergessen (Link öffnet kleines Panel)
```js
// POST /api/portal/forgot-password — mit {email}
// Server: prüfen ob Route existiert, sonst TODO-Kommentar hinterlassen
// Hinweis anzeigen: "Falls ein Account existiert, wurde eine E-Mail gesendet."
```

#### Admin-Login
```js
// POST /api/admin/login — mit {username, password}
// Bei Erfolg: token in sessionStorage, redirect zu index.html
// Bei two_factor_required: 2FA-Code-Eingabe einblenden (wie in index.html)
// POST /api/admin/login/2fa — mit {code, temp_token}
```

### Verlinkung
- `portal.html`: Oben links einen Link "← Zurück zum Login" hinzufügen (nur wenn kein Token vorhanden)
- `index.html`: Login-Bereich bleibt wie er ist, zusätzlich einen "← Zur Login-Seite" Link ergänzen
- `login.html` verlinkt zu `portal.html` nach erfolgreichem Kunden-Login
- `login.html` verlinkt zu `index.html` nach erfolgreichem Admin-Login

---

## Aufgabe 2 — Kunden-Registrierung: Backend prüfen & ergänzen

### 2.1 — Route POST /api/portal/register prüfen
**Datei:** `server/routes/customer-portal.js`, ab Zeile 540

Prüfe ob folgende Felder entgegengenommen werden:
- `name` (Pflicht)
- `email` (Pflicht, Validierung)
- `password` (Pflicht, min. 10 Zeichen)
- `company` (optional)
- `phone` (optional)

Falls Felder fehlen: entsprechend ergänzen.

Prüfe ob nach erfolgreicher Registrierung:
1. Eine Willkommens-Mail via `sendTemplateMail('accountCreated', ...)` gesendet wird
2. Ein Audit-Log-Eintrag `customer_self_registered` erstellt wird
3. Response: `{ success: true, message: 'Registrierung erfolgreich. Bitte prüfe deine E-Mail.' }`

Falls nicht vorhanden: ergänzen.

### 2.2 — Route POST /api/portal/forgot-password (NEU, falls nicht vorhanden)
**Datei:** `server/routes/customer-portal.js`

```js
router.post('/forgot-password', registerLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'E-Mail erforderlich.' });

  // Immer gleiche Response — kein User-Enumeration
  res.json({ success: true, message: 'Falls ein Account existiert, wurde eine Reset-Mail gesendet.' });

  try {
    const [[customer]] = await db.query(
      'SELECT id, name, email FROM customers WHERE email = ? AND (archived IS NULL OR archived = 0)', 
      [email.toLowerCase().trim()]
    );
    if (!customer) return; // Stille Fehlerbehandlung

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 Stunde
    await db.query(
      'UPDATE customers SET portal_token = ?, portal_token_expires = ? WHERE id = ?',
      [resetToken, expires, customer.id]
    );

    const portalUrl = (process.env.PORTAL_URL || '').replace(/\/$/, '');
    await sendTemplateMail('passwordReset', customer.email, {
      name: customer.name,
      reset_url: `${portalUrl}/login.html?reset=${resetToken}`
    });
  } catch (e) {
    console.error('[Portal/forgot-password]', e.message);
  }
}));
```

**Wichtig:** Registriere den `server.js` Route-Import, falls die Route nicht bereits eingebunden ist.

---

## Aufgabe 3 — Admin-UI: Verbesserungen in public/index.html

### 3.1 — Kunden-Detailansicht mit Lizenzen
**Problem:** Beim Klick auf einen Kunden sieht man keine zugehörigen Lizenzen direkt.
**Fix:** Im `openEditCustomer()`-Dialog unten einen Bereich "Lizenzen dieses Kunden" ergänzen:

```js
// Nach dem Laden des Edit-Modals: Lizenzen des Kunden nachladen
API('/admin/licenses?limit=50').then(function(d){
  var myLics = (d.licenses||[]).filter(function(l){ return l.customer_id === c.id; });
  var html = myLics.length
    ? '<table class="data-table" style="font-size:.8rem"><thead><tr><th>Key</th><th>Typ</th><th>Status</th><th>Ablauf</th></tr></thead><tbody>'
      + myLics.map(function(l){
          return '<tr><td><code>'+esc(l.license_key)+'</code></td><td>'+esc(l.type)+'</td><td>'+statusBadge(l.status)+'</td><td>'+fmtDate(l.expires_at)+'</td></tr>';
        }).join('')
      + '</tbody></table>'
    : '<p style="color:var(--text-muted,#7a7974);font-size:.85rem">Keine Lizenzen vorhanden.</p>';
  var el = document.getElementById('ec-licenses-block');
  if (el) el.innerHTML = html;
});
```

Im Modal `modal-edit-customer` einen Block ergänzen:
```html
<hr style="border-color:var(--border);margin:1rem 0">
<div style="font-size:.8rem;font-weight:700;letter-spacing:.05em;color:var(--primary);text-transform:uppercase;margin-bottom:.5rem">Lizenzen</div>
<div id="ec-licenses-block"><div class="loading" style="font-size:.8rem">Lade...</div></div>
```

### 3.2 — "Lizenz erstellen"-Button im Kunden-Edit-Modal
**Problem:** `openCreateLicenseForCustomer()` ist nur in der Tabellen-Row verfügbar, nicht im Edit-Dialog.
**Fix:** Im `modal-edit-customer` Footer vor dem Schließen-Button ergänzen:
```html
<button class="btn btn-primary btn-sm" onclick="openCreateLicenseForCustomerFromEdit()">+ Lizenz erstellen</button>
```

```js
function openCreateLicenseForCustomerFromEdit() {
  var id = document.getElementById('ec-id').value;
  closeModal('modal-edit-customer');
  setTimeout(function(){ openCreateLicenseForCustomer(id); }, 150);
}
```

### 3.3 — Plan-Info beim Lizenz-Erstellen anzeigen
**Problem:** Beim Auswählen des Lizenztyps im "Neue Lizenz"-Modal sieht man nicht, was der Plan enthält.
**Fix:** Beim `change`-Event auf `#nl-type` einen Info-Block unter dem Select aktualisieren:

```js
// Direkt nach dem Select nl-type im Modal:
// HTML ergänzen:
// <div id="nl-plan-info" style="font-size:.78rem;color:var(--text-muted,#7a7974);margin-top:.3rem"></div>

var PLANS_CACHE = null;
function loadPlanInfo(type) {
  if (!type) return;
  var el = document.getElementById('nl-plan-info');
  if (!el) return;
  function render(plans) {
    var p = plans[type];
    if (!p) { el.innerHTML = ''; return; }
    el.innerHTML = '📦 ' + esc(p.label||type) + ' — ' + (p.menu_items||'?') + ' Gerichte, ' + (p.max_tables||'?') + ' Tische, ' + (p.expires_days||'?') + ' Tage Laufzeit';
  }
  if (PLANS_CACHE) { render(PLANS_CACHE); return; }
  API('/admin/plans').then(function(d){ PLANS_CACHE = d; render(d); }).catch(function(){});
}
document.getElementById('nl-type').addEventListener('change', function(){ loadPlanInfo(this.value); });
// Auch beim Öffnen des Modals aufrufen: loadPlanInfo(document.getElementById('nl-type').value);
```

### 3.4 — Lizenz-Such-Filter um Kundenname erweitern
**Problem:** `GET /admin/licenses?search=` sucht nur `license_key LIKE ? OR customer_name LIKE ?`.
**Datei:** `server/routes/admin-licenses.js`
**Fix:** Suchfeld im Frontend-Label anpassen: `placeholder="Key, Kundenname, Domain suchen…"` und serverseitig:
```js
if (search) {
  where += ' AND (license_key LIKE ? OR customer_name LIKE ? OR associated_domain LIKE ?)';
  params.push(search, search, search);
}
```

---

## Aufgabe 4 — Kunden-Portal: Verbesserungen in public/portal.html

### 4.1 — Registrierungslink auf Login-Seite des Portals
**Problem:** portal.html hat keine Möglichkeit, sich zu registrieren.
**Fix:** Unter dem Login-Button in `page-login` ergänzen:
```html
<div style="text-align:center;margin-top:1rem;font-size:.85rem;color:var(--text2)">
  Noch kein Account? 
  <a href="login.html#register" style="color:var(--accent)">Jetzt registrieren</a>
</div>
```
(Verlinkt zur neuen login.html mit vorgesprungenem Registrierungs-Tab)

### 4.2 — Passwort-vergessen-Link
Unter dem Login-Button ergänzen:
```html
<div style="text-align:center;margin-top:.5rem;font-size:.82rem">
  <a href="login.html#forgot" style="color:var(--text2)">Passwort vergessen?</a>
</div>
```

### 4.3 — Lizenz-Ablauf-Warnung im Dashboard
**Fix:** In `loadLicenses()` für jede Lizenz prüfen ob `expires_at` innerhalb von 30 Tagen liegt:
```js
var daysLeft = Math.ceil((new Date(l.expires_at) - Date.now()) / 86400000);
var warnHtml = (daysLeft > 0 && daysLeft <= 30)
  ? '<div style="background:rgba(218,113,1,.12);color:#da7101;border-radius:6px;padding:.4rem .7rem;font-size:.8rem;margin-top:.5rem">⚠️ Läuft in '+daysLeft+' Tagen ab</div>'
  : (daysLeft <= 0 ? '<div style="background:rgba(161,44,123,.1);color:#a12c7b;border-radius:6px;padding:.4rem .7rem;font-size:.8rem;margin-top:.5rem">❌ Abgelaufen</div>' : '');
```

---

## Aufgabe 5 — server.js: Route-Verlinkung prüfen

Stelle sicher dass folgende Route-Importe in `server.js` vorhanden und korrekt eingebunden sind:
- `portalRoutes` → `app.use('/api/portal', portalRoutes)` ✅ (bereits vorhanden)
- Prüfe ob `/api/portal/register` und `/api/portal/forgot-password` korrekt erreichbar sind
- Falls `forgot-password` als neue Route ergänzt wurde: sicherstellen dass sie VOR `requirePortalAuth` liegt (öffentliche Route)

---

## Qualitätsvorgaben
- Alle neuen JS-Funktionen im bestehenden Vanilla-JS-Stil schreiben (function-Deklarationen, kein Arrow-only-Stil in alten Bereichen)
- Kein localStorage verwenden (sandboxed — nur sessionStorage oder in-memory)
- Alle API-Calls über die bestehende `API()`-Hilfsfunktion aus portal.html/index.html
- Keine neuen npm-Pakete
- Nach Fertigstellung: kurze Zusammenfassung mit allen geänderten Dateien + Zeilennummern
- Tests in `/tests/` müssen weiterhin durchlaufen

## Umsetzungsreihenfolge
1. Aufgabe 2.1 — POST /api/portal/register prüfen/ergänzen  
2. Aufgabe 2.2 — POST /api/portal/forgot-password einführen  
3. Aufgabe 1 — login.html erstellen (Kunden-Login, Admin-Login, Registrierung, 2FA)  
4. Aufgabe 3.1–3.4 — Admin-UI-Verbesserungen in index.html  
5. Aufgabe 4.1–4.3 — Portal-Verbesserungen in portal.html  
6. Aufgabe 5 — server.js Route-Check  
