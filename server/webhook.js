import crypto from 'crypto';
import db from './db.js';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const RETRY_DELAYS = [0, 5 * 60 * 1000, 30 * 60 * 1000]; // 0, 5min, 30min

function logWebhookCall(url, event, status, errorMessage = null, attemptCount = 1) {
    try {
        db.query(
            `INSERT INTO webhook_logs (id, webhook_url, event, status, error_message, attempt_count, attempted_at)
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
            [crypto.randomUUID(), url, event, status, errorMessage, attemptCount]
        );
    } catch (e) {
        console.error('❌ Fehler beim Schreiben des Webhook-Logs:', e.message);
    }
}

async function sendWithRetry(url, secret, body, event) {
    for (let attempt = 1; attempt <= RETRY_DELAYS.length; attempt++) {
        if (RETRY_DELAYS[attempt - 1] > 0)
            await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]));
        try {
            const sig = secret ? crypto.createHmac('sha256', secret).update(body).digest('hex') : null;
            const headers = { 'Content-Type': 'application/json' };
            if (sig) headers['X-MERAKI-Signature'] = sig;
            const response = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(5000) });
            if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
            logWebhookCall(url, event, 'success', null, attempt);
            return;
        } catch (e) {
            if (attempt === RETRY_DELAYS.length) {
                console.warn(`⚠️  Webhook ${url} nach ${attempt} Versuchen fehlgeschlagen:`, e.message);
                logWebhookCall(url, event, 'failed', e.message, attempt);
            }
        }
    }
}

export async function fireWebhook(event, payload) {
    const urls = [];
    if (process.env.WEBHOOK_URL) urls.push({ url: process.env.WEBHOOK_URL, secret: WEBHOOK_SECRET });
    try {
        const [rows] = db.query('SELECT url, secret FROM webhooks WHERE active = 1');
        for (const r of rows) urls.push({ url: r.url, secret: r.secret });
    } catch {}

    const body = JSON.stringify({ event, ts: new Date().toISOString(), ...payload });
    for (const { url, secret } of urls) {
        sendWithRetry(url, secret, body, event).catch(() => {});
    }
}
