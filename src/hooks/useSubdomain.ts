import { useState } from 'react';

export const useSubdomain = () => {
  const [subdomain] = useState<string | null>(() => {
    // Immediately compute subdomain from URL (avoid useEffect timing issues)
    if (typeof window === 'undefined') return null;

    const hostname = window.location.hostname;

    // Ignore admin domain (Force Null for Super Admin)
    if (hostname.includes('admin.eregi') || hostname.startsWith('admin.')) {
      return null;
    }

    // Extract subdomain
    const parts = hostname.split('.');

    // If it's a standard 3+ part domain and not www
    if (parts.length >= 3) {
      const firstPart = parts[0];
      if (firstPart !== 'www' && firstPart !== 'eregi') {
        return firstPart;
      }
    }

    // Handle localhost with subdomain (e.g., kadd.localhost)
    if (hostname.includes('localhost') && parts.length >= 2) {
      const firstPart = parts[0];
      if (firstPart !== 'www' && firstPart !== 'eregi') {
        return firstPart;
      }
    }

    return null;
  });

  // NO useEffect needed - initial state is computed correctly
  // Keeping empty dependency array caused state to be reset to null on first update

  return { subdomain };
};
