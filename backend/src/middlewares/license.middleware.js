import { env } from '../config/env.js';
import { getLicenseState, isDomainLicensed } from '../config/license.js';
import { logger } from '../lib/logger.js';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

// Blocks all traffic once the license is missing/invalid/expired, or once
// production traffic arrives on a domain the license wasn't issued for.
// A no-op outside production so local/staging environments never need a
// license key. Relies on config/license.js re-verifying LICENSE_KEY on an
// interval (see server.js) so an expiry is caught without a restart.
export const licenseGuard = (req, res, next) => {
    if (env.NODE_ENV !== 'production') return next();

    const state = getLicenseState();
    if (!state.valid) {
        logger.error({ err: state.error }, 'Blocked request: invalid/missing/expired license');
        return res.status(503).json({ success: false, message: 'Service unavailable: invalid license.' });
    }

    const hostname = req.hostname;
    if (!LOCAL_HOSTS.has(hostname) && !isDomainLicensed(hostname)) {
        logger.error(
            { hostname, licensedDomain: state.payload.domain },
            'Blocked request: domain not licensed',
        );
        return res.status(503).json({ success: false, message: 'Service unavailable: domain not licensed.' });
    }

    next();
};
