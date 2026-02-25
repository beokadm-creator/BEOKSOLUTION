import { useState } from 'react';

export const useSubdomain = () => {
  const [subdomain] = useState<string | null>(() => {
    // Immediately compute subdomain from URL (avoid useEffect timing issues)
    if (typeof window === 'undefined') return null;

    const hostname = window.location.hostname;
    const params = new URLSearchParams(window.location.search);
    const societyParam = params.get('society');

    // DEV 환경: URL 파라미터로 학회 지정 (?society=kadd)
    if (societyParam) {
      return societyParam;
    }

    // Firebase Hosting 채널 URL은 서브도메인으로 처리하지 않음
    // 예: eregi-8fc1e--dev-lr7jo34l.web.app
    if (hostname.includes('.web.app') || hostname.includes('localhost')) {
      // 하지만 개발 환경에서 society 파라미터가 없더라도, URL 경로에서 추론할 수 있으면 허용
      // (useConference와 유사한 로직이 필요하지만, 여기서는 subdomain만 반환하므로 null 유지)
      return null;
    }

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

    return null;
  });

  // NO useEffect needed - initial state is computed correctly
  // Keeping empty dependency array caused state to be reset to null on first update

  return { subdomain };
};
