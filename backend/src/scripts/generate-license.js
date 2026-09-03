// ---------------------------------------------------------------------------
// SELLER-ONLY TOOL. Never send license-private-key.pem to a client — it's
// what lets you issue valid licenses. A client only ever needs the
// LICENSE_KEY token this prints; the matching public key already ships in
// src/config/license-public-key.pem.
//
// One-time setup (run once, keep the private key OUTSIDE this repo and out
// of anything you deliver to clients — e.g. in a password manager or a
// private git repo only you control):
//   openssl genrsa -out license-private-key.pem 2048
//   openssl rsa -in license-private-key.pem -pubout -out license-public-key.pem
// Then commit license-public-key.pem's contents into
// backend/src/config/license-public-key.pem in the codebase you sell.
//
// Issue a license for a client:
//   LICENSE_PRIVATE_KEY_PATH=/path/to/license-private-key.pem \
//     node src/scripts/generate-license.js --client "Acme Ltd" --domain shop.acme.com --days 365
//
// A deployment usually has TWO public hostnames that need to pass the check:
// the storefront domain traffic actually arrives on (what req.hostname sees
// behind a Next.js rewrite/proxy) AND the backend's own hosting domain
// (what Next.js SSR hits directly via an absolute backend URL, and what
// webhooks/health checks call). License both, comma-separated:
//   --domain shop.acme.com,acme-api.onrender.com
// ---------------------------------------------------------------------------

import fs from 'fs';
import jwt from 'jsonwebtoken';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const client = getArg('client');
const domain = getArg('domain');
const days = Number(getArg('days', '365'));
const keyPath = getArg('key', process.env.LICENSE_PRIVATE_KEY_PATH);

if (!client || !domain) {
    console.error(
        'Usage: node src/scripts/generate-license.js --client "Name" --domain example.com [--days 365] [--key /path/to/private.pem]\n' +
            '(or set LICENSE_PRIVATE_KEY_PATH instead of --key)',
    );
    process.exit(1);
}

if (!keyPath) {
    console.error('No private key path given. Pass --key /path/to/license-private-key.pem or set LICENSE_PRIVATE_KEY_PATH.');
    process.exit(1);
}

if (!fs.existsSync(keyPath)) {
    console.error(
        `Private key not found at ${keyPath}.\n` +
            'Generate one first (keep it OUTSIDE this repo and never send it to a client):\n' +
            '  openssl genrsa -out license-private-key.pem 2048\n' +
            '  openssl rsa -in license-private-key.pem -pubout -out license-public-key.pem',
    );
    process.exit(1);
}

if (!Number.isFinite(days) || days <= 0) {
    console.error('--days must be a positive number.');
    process.exit(1);
}

const privateKey = fs.readFileSync(keyPath, 'utf8');
const normalizeDomain = (d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
const domains = domain.split(',').map(normalizeDomain).filter(Boolean);

const token = jwt.sign({ domains, client }, privateKey, {
    algorithm: 'RS256',
    expiresIn: `${days}d`,
});

console.log(`\nLicense issued for "${client}" (${domains.join(', ')}), valid ${days} days.\n`);
console.log(`LICENSE_KEY=${token}\n`);
console.log('Paste that line into the client\'s backend/.env (production only).');
