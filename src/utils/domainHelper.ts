export const DOMAIN_CONFIG = {
    // Ignored subdomains when attempting to extract society from subdomain
    IGNORED_SUBDOMAINS: [
        'www',
        'admin',
        'eregi',
    ],
    // Ignored domain suffixes (Firebase hostings)
    IGNORED_SUFFIXES: [
        '.web.app',
        '.firebaseapp.com',
    ],
    // Default society id if no other is found
    DEFAULT_SOCIETY: import.meta.env.VITE_DEFAULT_SOCIETY || '',
    // Base domain of the application
    BASE_DOMAIN: import.meta.env.VITE_BASE_DOMAIN || 'eregi.co.kr',
};

/**
 * Extracts the society ID from the current hostname, taking into account
 * ignored subdomains and suffixes.
 * @param host The hostname string (e.g. window.location.hostname)
 * @returns The extracted society ID or null
 */
export const extractSocietyFromHost = (host: string): string | null => {
    if (!host) return null;

    // Localhost check
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
        return null;
    }

    // Admin domains Check
    if (host.includes('admin.eregi') || host.startsWith('admin.')) {
        return null;
    }

    // Firebase app domains Check
    for (const suffix of DOMAIN_CONFIG.IGNORED_SUFFIXES) {
        if (host.endsWith(suffix)) {
            return null;
        }
    }

    const parts = host.split('.');

    // Need at least something like subdomain.domain.com (3 parts)
    // or at least 2 parts like subdomain.localhost (not applicable here due to localhost Check)
    // For safety, we check if parts.length >= 2 or 3, but specifically grab the first part
    // if it's not in the ignored list.

    if (parts.length >= 3) {
        const firstPart = parts[0].toLowerCase();
        if (!DOMAIN_CONFIG.IGNORED_SUBDOMAINS.includes(firstPart)) {
            return firstPart;
        }
    } else if (parts.length > 2) {
        const firstPart = parts[0].toLowerCase();
        if (!DOMAIN_CONFIG.IGNORED_SUBDOMAINS.includes(firstPart)) {
            return firstPart;
        }
    }

    return null;
};
