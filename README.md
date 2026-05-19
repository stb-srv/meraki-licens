# OPA-Santorini License Server

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D%2018-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)
![Status](https://img.shields.io/badge/Status-Production-success)

---

## 📋 Kurzbeschreibung

Der **OPA-Santorini License Server** ist der zentrale REST-API-Lizenzserver für das [OPA-Santorini Restaurant-Management-System (CMS)](https://github.com/stb-srv/OPA-Sanatori). Er dient zur sicheren Verwaltung, Validierung und Überwachung von Lizenzen für registrierte CMS-Instanzen und stellt sicher, dass lizenzierte Restaurant-Features und Gerätelimits eingehalten werden. Durch signierte kryptografische Tokens ermöglicht er sowohl hochsichere Echtzeit-Validierungen als auch zeitlich begrenzte Offline-Freischaltungen für Restaurant-Instanzen vor Ort.

---

## ✨ Features

* **🔑 Lizenzverwaltung & Validierung:** Vollwertiges Key-Management mit Unterstützung von Typen (TRIAL, FREE, BASIC, PRO, ENTERPRISE), Domain-Binding (mit Wildcard-Support) und automatischen Validierungs-Checks.
* **🧑‍💼 Integriertes Kunden-Portal:** Dedizierter Bereich für Kunden zur Profilverwaltung, zum Ändern ihrer Rechnungsadresse und zum Verwalten verknüpfter Domains und Lizenzen.
* **🧾 Automatisches Rechnungssystem:** Dynamische Generierung von Rechnungen bei Lizenz-Erstellung oder -Verlängerung inklusive Mahnwesen-Cronjob für überfällige Posten.
* **📄 PDF-Generierung:** Automatisierte Erstellung professioneller Rechnungs-PDFs via `pdfkit` mit konfigurierbarem Design, Firmenlogo und Steuerangaben.
* **🤝 Reseller-System:** Dedizierte Endpunkte für Reseller zur automatisierten Lizenzbestellung und -ausgabe über verschlüsselte API-Keys.
* **🔐 Zwei-Faktor-Authentifizierung (2FA):** Optionale Absicherung von Superadmin- und Admin-Accounts mittels zeitbasierter Einmalpasswörter (TOTP/Google Authenticator) inklusive QR-Code-Setup.
* **📡 Webhooks & Logs:** Event-getriebene HTTP POST Notifications an Drittsysteme bei Lizenz- oder Rechnungsereignissen inklusive detailliertem Logging.
* **⏰ Zuverlässige Cron-Jobs:** Automatische Bereinigung abgelaufener Nonces, Prüfung fälliger/überfälliger Rechnungen und E-Mail-Ablaufwarnungen vor dem Lizenzende.
* **🔄 Auto-Migrationssystem:** Vollautomatisches Schema- und Datenmigrationssystem direkt beim Serverstart – manuelle DB-Setups entfallen komplett.
* **📩 Self-Registration (In Progress):** Integriertes Feature zur E-Mail-Verifizierung und Kundenregistrierung für den einfachen Einstieg.

---

## 📋 Voraussetzungen

* **Node.js** >= 18.x
* **MySQL / MariaDB** >= 10.5.x
* **pdfkit** (für PDF-Generierung)

### Installierte npm-Abhängigkeiten (aus `package.json`):

* `express` – Web-Framework für die REST-API
* `mysql2` – MySQL/MariaDB-Treiber mit Promise-Support
* `bcryptjs` – Sicheres Passwort-Hashing für Admin- und Kunden-Accounts
* `jsonwebtoken` – Token-basierte Authentifizierung (RS256 für Lizenzen, HS256 für Portal- & Admin-Sessions)
* `helmet` – Schutz vor gängigen Web-Schachstellen durch HTTP-Header
* `cors` – Steuerung von Cross-Origin Resource Sharing
* `express-rate-limit` – Schutz vor Brute-Force und API-Abuse
* `nodemailer` – Integrierter E-Mail-Versand (SMTP)
* `otplib` – Implementierung von TOTP für die 2FA
* `qrcode` – Generierung von Setup-QR-Codes im Admin-Bereich
* `pdfkit` – Modul zur Erstellung von Rechnungs-PDFs
* `dotenv` – Laden von Konfigurationsvariablen aus der `.env`-Datei

---

## 🚀 Installation & Setup

Befolgen Sie diese Schritte, um den Server lokal oder auf einer Produktionsumgebung einzurichten:

```bash
# 1. Repository klonen
git clone https://github.com/stb-srv/licens-srv_OPA-Santorini
cd licens-srv_OPA-Santorini

# 2. Abhängigkeiten installieren
npm install

# 3. Umgebungsvariablen einrichten
cp .env.example .env

# 4. Passe die .env-Datei an (Datenbank-Zugangsdaten, Secrets und SMTP)
# nano .env

# 5. Server starten
npm start
```

> 💡 **Hinweis:** Die Datenbank-Migrationen laufen beim ersten Start (und bei zukünftigen Updates) **vollkommen automatisch** ab. Es ist keine manuelle Tabellen-Erstellung nötig.

---

## 🗄️ Datenbank-Migrationen

Der Server verfügt über ein eingebautes, robustes Migrationssystem.

> 📢 **Automatischer Ablauf:** Die Migrationen laufen **automatisch** beim Serverstart (`npm start`).
> Neue `.js`- oder `.sql`-Dateien im Verzeichnis `server/migrations/` werden beim nächsten Start
> automatisch erkannt und ausgeführt. Eine bereits ausgeführte Migration
> wird nicht erneut angewendet (das Tracking erfolgt über die Tabelle `schema_migrations` in der DB).

### Manueller Aufruf (z.B. für Debugging oder CI/CD):
Falls Sie Migrationen manuell ausführen oder das Schema unabhängig vom Server-Boot prüfen möchten, führen Sie folgenden Befehl aus:
```bash
node server/migrate.js
```

### Neue Migration hinzufügen:
Um eine neue Tabellenänderung oder ein neues Schema einzuführen, gehen Sie wie folgt vor:

1. Erstellen Sie eine neue Datei im Verzeichnis `server/migrations/`.
2. Benennen Sie sie mit einer fortlaufenden, 4-stelligen Nummerierung und einer Kurzbeschreibung (z. B. `0020_add_new_table.js` oder `0020_add_new_table.sql`).
3. **Für SQL-Migrationen (`.sql`):** Schreiben Sie einfach die puren SQL-Statements in die Datei.
4. **Für JS-Migrationen (`.js`):** Exportieren Sie die Funktionen `up(db)` und `down(db)` wie im folgenden Beispiel:

```javascript
/**
 * Migration 0020 – Beispiel-Migration
 */

export async function up(db) {
    console.log('⏫ Migration 0020: Adding example column...');
    await db.query(`
        ALTER TABLE customers 
        ADD COLUMN IF NOT EXISTS example_field VARCHAR(255) DEFAULT NULL
    `);
    console.log('  ✅ Column customers.example_field verified/added.');
}

export async function down(db) {
    console.log('⏬ Migration 0020: Dropping example column...');
    await db.query(`
        ALTER TABLE customers DROP COLUMN IF EXISTS example_field
    `);
    console.log('  ✅ Column customers.example_field dropped.');
}

export default up;
```

---

## 📄 Lizenz

Dieses Projekt ist unter der **MIT-Lizenz** lizenziert. Weitere Details finden Sie in der `LICENSE`-Datei.
