import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from './db.js';

export const RSA_PRIVATE_KEY = process.env.RSA_PRIVATE_KEY
    ? process.env.RSA_PRIVATE_KEY.replace(/\\n/g, '\n')
    : null;

// Public Key: aus .env laden (passend zum Private Key)
export const RSA_PUBLIC_KEY = process.env.RSA_PUBLIC_KEY
    ? process.env.RSA_PUBLIC_KEY.replace(/\\n/g, '\n')
    : null;

// HMAC_SECRET: wird für Offline-Token-Signierung verwendet
const HMAC_SECRET = process.env.HMAC_SECRET;
if (!HMAC_SECRET || HMAC_SECRET === 'hmac-change-me-in-production') {
    throw new Error(
        'FATAL: HMAC_SECRET ist nicht gesetzt oder verwendet den unsicheren Default-Wert. Bitte in .env konfigurieren.'
    );
}

export function generateKeyPair() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return { privateKey, publicKey, kid: crypto.randomUUID() };
}

export function getActiveSigningKey() {
    try {
        const [[row]] = query(
            "SELECT kid, private_key FROM signing_keys WHERE status = 'active' ORDER BY created_at DESC LIMIT 1"
        );
        if (row) return { kid: row.kid, privateKey: row.private_key };
    } catch {
        /* fall through */
    }
    return RSA_PRIVATE_KEY ? { kid: 'env', privateKey: RSA_PRIVATE_KEY } : null;
}

export function getPublicKeyByKid(kid) {
    if (kid === 'env' || !kid) return RSA_PUBLIC_KEY;
    try {
        const [[row]] = query('SELECT public_key FROM signing_keys WHERE kid = ?', [kid]);
        return row?.public_key ?? RSA_PUBLIC_KEY;
    } catch {
        return RSA_PUBLIC_KEY;
    }
}

export function getAllJwks() {
    const keys = [];
    try {
        const [rows] = query(
            "SELECT kid, public_key FROM signing_keys WHERE status != 'retired' ORDER BY created_at DESC"
        );
        for (const row of rows) {
            try {
                const jwk = crypto.createPublicKey(row.public_key).export({ format: 'jwk' });
                keys.push({ ...jwk, kid: row.kid, use: 'sig', alg: 'RS256' });
            } catch {
                /* skip malformed key */
            }
        }
    } catch {
        /* DB not ready */
    }
    if (keys.length === 0 && RSA_PUBLIC_KEY) {
        try {
            const jwk = crypto.createPublicKey(RSA_PUBLIC_KEY).export({ format: 'jwk' });
            keys.push({ ...jwk, kid: 'env', use: 'sig', alg: 'RS256' });
        } catch {
            /* skip */
        }
    }
    return { keys };
}

export const createSignedLicenseToken = (payload, expiresIn = '72h') => {
    const active = getActiveSigningKey();
    if (!active) return null;
    return jwt.sign(payload, active.privateKey, {
        algorithm: 'RS256',
        expiresIn,
        ...(active.kid !== 'env' ? { header: { kid: active.kid, alg: 'RS256' } } : {}),
    });
};

export const signResponse = (payload) => {
    const data = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256', HMAC_SECRET).update(data).digest('hex');
    return { ...payload, _sig: sig, _ts: Date.now() };
};

export const isHmacActive = () => HMAC_SECRET !== 'hmac-change-me-in-production';

export { HMAC_SECRET };
