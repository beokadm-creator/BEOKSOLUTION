
const ROOT_DOMAIN = '.eregi.co.kr';

export const setRootCookie = (name: string, value: string, days: number = 7) => {
  const date = new Date();
  const maxAge = days * 24 * 60 * 60; // Convert days to seconds
  date.setTime(date.getTime() + (maxAge * 1000));
  const expires = "expires=" + date.toUTCString();
  
  // [Step 403-A] Optimize cookie attribute order for browser compatibility
  // [Step 403-D] Add max-age for better persistence
  document.cookie = `${name}=${value};${expires};max-age=${maxAge};path=/;domain=${ROOT_DOMAIN};SameSite=None;secure`;
};

export const getRootCookie = (name: string): string | null => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for(let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

export const removeRootCookie = (name: string) => {
  // To delete, set expires to past date AND match domain/path
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${ROOT_DOMAIN};secure;SameSite=None`;
};
