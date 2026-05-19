import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const RSA_PRIVATE_KEY = process.env.RSA_PRIVATE_KEY
    ? process.env.RSA_PRIVATE_KEY.replace(/\\n/g, '\n')
    : null;

// Public Key: aus .env laden (passend zum Private Key)
export const RSA_PUBLIC_KEY = process.env.RSA_PUBLIC_KEY
    ? process.env.RSA_PUBLIC_KEY.replace(/\\n/g, '\n')
    : null;

// HMAC_SECRET: nur intern in diesem Modul verwendet
const HMAC_SECRET = process.env.HMAC_SECRET || 'hmac-change-me-in-production';

export const createSignedLicenseToken = (payload, expiresIn = '72h') => {
    if (!RSA_PRIVATE_KEY) return null;
    return jwt.sign(payload, RSA_PRIVATE_KEY, { algorithm: 'RS256', expiresIn });
};

export const signResponse = (payload) => {
    const data = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256', HMAC_SECRET).update(data).digest('hex');
    return { ...payload, _sig: sig, _ts: Date.now() };
};

export const isHmacActive = () => HMAC_SECRET !== 'hmac-change-me-in-production';

export { HMAC_SECRET };
