import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { env } from './env.js';

// ---------------------------------------------------------------------------
// Commercial license enforcement.
//
// LICENSE_KEY is a JWT signed with the seller's PRIVATE key (never present in
// this repo — see src/scripts/generate-license.js) and verified here against
// the PUBLIC key committed at license-public-key.pem. The public key can only
// verify signatures, never create them, so it's safe to ship with every
// client's copy. Forging a token for a different domain or a later expiry
// requires the private key, which only the seller holds.
//
// The licensed domain is checked per-request against real traffic
// (req.hostname in license.middleware.js), not against an editable env var,
// so changing config alone can't relicense a copy for a different site.
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_KEY_PATH = path.join(__dirname, 'license-public-key.pem');

let cached = { valid: false, payload: null, error: 'not checked yet' };

export const verifyLicense = () => {
    if (!env.LICENSE_KEY) {
        cached = { valid: false, payload: null, error: 'LICENSE_KEY is not set' };
        return cached;
    }

    try {
        const publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
        const payload = jwt.verify(env.LICENSE_KEY, publicKey, { algorithms: ['RS256'] });
        if (!payload.domain) throw new Error('license token is missing a domain claim');
        cached = { valid: true, payload, error: null };
    } catch (err) {
        cached = { valid: false, payload: null, error: err.message };
    }
    return cached;
};

export const getLicenseState = () => cached;

export const isDomainLicensed = (hostname) => {
    if (!cached.valid) return false;
    const normalize = (h) => String(h || '').toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '');
    return normalize(hostname) === normalize(cached.payload.domain);
};
