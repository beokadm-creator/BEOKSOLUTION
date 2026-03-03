import { useState, useEffect } from 'react';
import { extractSocietyFromHost } from '../utils/domainHelper';

export const useSubdomain = () => {
  const [subdomain, setSubdomain] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;

    // Check URL parameters first for DEV testing overrides
    const params = new URLSearchParams(window.location.search);
    const societyParam = params.get('society');
    if (societyParam) {
      return societyParam;
    }

    return extractSocietyFromHost(window.location.hostname);
  });

  useEffect(() => {
    // Determine the current subdomain based on current URL
    const checkSubdomain = () => {
      const params = new URLSearchParams(window.location.search);
      const societyParam = params.get('society');
      const currentSub = societyParam || extractSocietyFromHost(window.location.hostname);

      setSubdomain(currentSub);
    };

    // We can't rely completely on react-router-dom hook here because 
    // useSubdomain is called outside of <Router> in App.tsx.
    // Instead, we listen to native history popstate events and patch pushState/replaceState

    window.addEventListener('popstate', checkSubdomain);

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      checkSubdomain();
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      checkSubdomain();
    };

    return () => {
      window.removeEventListener('popstate', checkSubdomain);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []);

  return { subdomain };
};
