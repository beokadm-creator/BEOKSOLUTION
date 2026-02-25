import { useState, useEffect } from 'react';

export const useSubdomain = () => {
  const [subdomain, setSubdomain] = useState<string | null>(null);

  useEffect(() => {
    const hostname = window.location.hostname;

    // Ignore localhost and admin domain (Force Null for Super Admin)
    if (hostname.includes('localhost') || hostname.includes('admin.eregi') || hostname.startsWith('admin.')) {
      setSubdomain(null);
      return;
    }

    // Extract subdomain
    const parts = hostname.split('.');

    // Pattern: [subdomain].eregi.co.kr or [subdomain].localhost
    // If we're on a firebase app or web app domain, the "subdomain" part is the project ID + variant: ignore it.
    if (hostname.includes('web.app') || hostname.includes('firebaseapp.com')) {
      setSubdomain(null);
      return;
    }

    if (parts.length >= 3) {
      const firstPart = parts[0];
      if (firstPart !== 'www' && firstPart !== 'eregi' && !firstPart.includes('--')) {
        setSubdomain(firstPart);
      }
    }
  }, []);

  return { subdomain };
};
