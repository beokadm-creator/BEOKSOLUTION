import { getRootCookie, SESSION_KEYS } from './cookie';

export interface SessionToken {
  source: 'firebase' | 'cookie' | 'url_fallback' | 'url_legacy' | 'none';
  token: string | null;
  isValid: boolean;
  expiresAt: number | null;
};

export const getTokenSourcePriority = (): string[] => {
  return ['firebase', 'cookie', 'url_fallback', 'url_legacy'];
};

export const validateTokenExpiry = (token: string): { valid: boolean; expiresAt: number | null } => {
  try {
    const tokenPayload = JSON.parse(atob(token.split('.')[1]));
    const exp = tokenPayload.exp;
    const now = Math.floor(Date.now() / 1000);

    if (exp < now) {
      return { valid: false, expiresAt: exp };
    }

    return { valid: true, expiresAt: exp };
  } catch {
    return { valid: true, expiresAt: null };
  }
};

export const getSessionToken = (): SessionToken => {
  const urlParams = new URLSearchParams(window.location.search);
  const fallbackToken = urlParams.get('token');
  const legacyUrlToken = urlParams.get('eregi_session');
  const cookieToken = getRootCookie('eregi_session');

  const sources = getTokenSourcePriority();

  for (const source of sources) {
    let token: string | null = null;

    switch (source) {
      case 'url_fallback':
        token = fallbackToken;
        break;
      case 'url_legacy':
        token = legacyUrlToken;
        break;
      case 'cookie':
        token = cookieToken;
        break;
    }

    if (token) {
      const { valid, expiresAt } = validateTokenExpiry(token);
      return { source, token, isValid: valid, expiresAt };
    }
  }

  return { source: 'none', token: null, isValid: false, expiresAt: null };
};

export const hasValidSession = (): boolean => {
  const session = getSessionToken();
  return session.token !== null && session.isValid;
};

export const clearSessionStorage = () => {
  Object.values(SESSION_KEYS).forEach(key => {
    sessionStorage.removeItem(key);
  });
};

export const clearLocalStorage = () => {
  Object.values(SESSION_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
};
