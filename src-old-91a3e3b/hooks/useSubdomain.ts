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
    // Pattern: [subdomain].eregi.co.kr or [subdomain].domain.com
    const parts = hostname.split('.');
    
    // Assuming structure like kadd.eregi.co.kr (4 parts) or kadd.localhost (2 parts - likely handled above)
    // If it's a standard 3+ part domain and not www
    if (parts.length >= 3) {
      const firstPart = parts[0];
      if (firstPart !== 'www' && firstPart !== 'eregi') {
        setSubdomain(firstPart);
      }
    }
  }, []);

  return { subdomain };
};
