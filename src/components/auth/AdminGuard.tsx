import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Navigate, Outlet, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSubdomain } from '../../hooks/useSubdomain';
import LoadingSpinner from '../common/LoadingSpinner';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';

import { SUPER_ADMINS } from '../../constants/defaults';

const AdminGuard: React.FC = () => {
  const { auth: { user, loading } } = useAuth();
  const location = useLocation();
  const { cid, sid } = useParams();
  const { subdomain } = useSubdomain();  // ✅ Get subdomain (kadd, kap)
  const [searchParams, setSearchParams] = useSearchParams();
  const [isBypassing, setIsBypassing] = useState(false);
  const [bypassLoading, setBypassLoading] = useState(false);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState<boolean | null>(null);

  const userEmail = user?.email || '';
  const isSuperAdmin = userEmail && SUPER_ADMINS.includes(userEmail);

  const currentSocietyId = useMemo(() => {
    // ✅ 0순위: URL 파라미터 ?society=kadd (DEV 환경)
    const params = new URLSearchParams(window.location.search);
    const societyParam = params.get('society');
    if (societyParam) return societyParam;
    
    // ✅ 1순위: sessionStorage (로그인 후 리다이렉트 시)
    const sessionSocietyId = sessionStorage.getItem('societyId');
    if (sessionSocietyId) return sessionSocietyId;
    
    // ✅ 2순위: URL 파라미터 sid (/admin/society/:sid)
    if (sid) return sid;
    
    // ✅ 3순위: Subdomain (kadd.eregi.co.kr → kadd)
    if (subdomain) return subdomain;
    
    // ✅ 4순위: cid에서 추출 (kap_2026spring → kap)
    if (cid) {
        const parts = cid.split('_');
        if (parts.length >= 1) return parts[0];
    }
    
    // ✅ 5순위: URL 경로 직접 파싱 (Fallback)
    const path = location.pathname;
    const societyMatch = path.match(/\/admin\/society\/([^/]+)/);
    if (societyMatch) return societyMatch[1];

    const confMatch = path.match(/\/admin\/conf\/([^/]+)/);
    if (confMatch) {
       const parts = confMatch[1].split('_');
       if (parts.length >= 1) return parts[0];
    }
    
    return null;
  }, [cid, sid, subdomain, location.pathname]);  // ✅ subdomain, location.pathname 추가

  // 🔧 [FIX] Memoize auth param to prevent infinite loops
  const authParam = useMemo(() => searchParams.get('auth'), [searchParams]);

  useEffect(() => {
      const checkBypass = async () => {
          const authToken = authParam || sessionStorage.getItem('operatorToken');

          if (!authToken) return;

          if (isBypassing) return;

          setBypassLoading(true);
          try {
              const parts = authToken.split('.');
              if (parts.length !== 2) throw new Error('Invalid Token Format');

              const payloadJson = atob(parts[0]);
              const payload = JSON.parse(payloadJson);

              if (Date.now() > payload.exp) {
                   sessionStorage.removeItem('operatorToken');
                   throw new Error('Token Expired');
              }

              const match = location.pathname.match(/\/admin\/conf\/([^/]+)/);
              if (match && match[1]) {
                  const targetCid = match[1];
                  if (payload.cid !== targetCid) {
                       throw new Error('Access Denied: Token not valid for this conference');
                   }
              }

              if (authParam) {
                  const verifyFn = httpsCallable(functions, 'verifyAccessLink');
                  const result = await verifyFn({ token: authToken });
                  const data = result.data as { valid: boolean };

                  if (data.valid) {
                      sessionStorage.setItem('operatorToken', authToken);
                      const newParams = new URLSearchParams(searchParams);
                      newParams.delete('auth');
                      setSearchParams(newParams);
                      setIsBypassing(true);
                  }
              } else {
                  setIsBypassing(true);
              }

          } catch {
              sessionStorage.removeItem('operatorToken');
          } finally {
              setBypassLoading(false);
          }
      };

      checkBypass();
  }, [authParam, location.pathname, isBypassing, searchParams, setSearchParams]);

  const checkSocietyAdminCallback = useCallback(async () => {
      console.log(`🛡️ [AdminGuard] Checking admin access...`);
      console.log(`🛡️ [AdminGuard] currentSocietyId: ${currentSocietyId}`);
      console.log(`🛡️ [AdminGuard] userEmail: ${userEmail}`);
      console.log(`🛡️ [AdminGuard] isSuperAdmin: ${isSuperAdmin}`);
      
      if (isSuperAdmin) {
          console.log(`🛡️ [AdminGuard] ✅ Super Admin bypass`);
          setIsAdminAuthorized(true);
          return;
      }

      if (!currentSocietyId || !userEmail) {
          console.log(`🛡️ [AdminGuard] ❌ Missing societyId or email`);
          setIsAdminAuthorized(false);
          return;
      }

      try {
          console.log(`🛡️ [AdminGuard] Fetching society document: ${currentSocietyId}`);
          const socRef = doc(db, 'societies', currentSocietyId);
          const socSnap = await getDoc(socRef);
          
          console.log(`🛡️ [AdminGuard] Document exists: ${socSnap.exists()}`);
          
          if (socSnap.exists()) {
              const data = socSnap.data();
              const adminEmails = data.adminEmails || [];
              console.log(`🛡️ [AdminGuard] adminEmails:`, adminEmails);
              console.log(`🛡️ [AdminGuard] Checking if ${userEmail} in adminEmails`);
              const isAuthorized = adminEmails.includes(userEmail);
              console.log(`🛡️ [AdminGuard] isAuthorized: ${isAuthorized}`);
              setIsAdminAuthorized(isAuthorized);
          } else {
              console.log(`🛡️ [AdminGuard] ❌ Society document not found`);
              setIsAdminAuthorized(false);
          }
      } catch (error) {
          console.log(`🛡️ [AdminGuard] ❌ Exception:`, error);
          setIsAdminAuthorized(false);
      }
  }, [isSuperAdmin, userEmail, currentSocietyId]);

  useEffect(() => {
      console.log(`🛡️ [AdminGuard] useEffect triggered`);
      console.log(`🛡️ [AdminGuard] user:`, user);
      console.log(`🛡️ [AdminGuard] loading:`, loading);
      console.log(`🛡️ [AdminGuard] isBypassing:`, isBypassing);
      
      // ✅ sessionStorage 체크 (로그인 직후 빠른 확인용)
      const societyAdmin = sessionStorage.getItem('societyAdmin');
      const storedSocietyId = sessionStorage.getItem('societyId');
      const storedIsSuperAdmin = sessionStorage.getItem('isSuperAdmin');
      
      console.log(`🛡️ [AdminGuard] sessionStorage societyAdmin: ${societyAdmin}`);
      console.log(`🛡️ [AdminGuard] sessionStorage societyId: ${storedSocietyId}`);
      console.log(`🛡️ [AdminGuard] sessionStorage isSuperAdmin: ${storedIsSuperAdmin}`);
      
      if (user && !loading && !isBypassing) {
          console.log(`🛡️ [AdminGuard] Calling checkSocietyAdminCallback...`);
          checkSocietyAdminCallback();
      } else if (!user && societyAdmin === 'true' && storedSocietyId === currentSocietyId) {
          // ✅ 로그인 직후 sessionStorage에 있는 경우 임시 통과
          console.log(`🛡️ [AdminGuard] ✅ Bypassing via sessionStorage (login just succeeded)`);
          setIsAdminAuthorized(true);
      } else if (storedIsSuperAdmin === 'true') {
          // ✅ Super Admin bypass
          console.log(`🛡️ [AdminGuard] ✅ Super Admin bypass via sessionStorage`);
          setIsAdminAuthorized(true);
      } else {
          console.log(`🛡️ [AdminGuard] Skipped: user=${!!user}, loading=${loading}, isBypassing=${isBypassing}`);
      }
  }, [user, loading, isBypassing, checkSocietyAdminCallback, currentSocietyId]);

  if (loading || bypassLoading) return <LoadingSpinner />;
  
  if (isBypassing) {
      console.log(`🛡️ [AdminGuard] Bypass token active - allowing access`);
      return <Outlet />;
  }

  if (!user) {
    // ✅ sessionStorage에 admin 정보가 있으면 통과 (로그인 직후)
    const societyAdmin = sessionStorage.getItem('societyAdmin');
    const storedSocietyId = sessionStorage.getItem('societyId');
    const storedIsSuperAdmin = sessionStorage.getItem('isSuperAdmin');
    
    if ((societyAdmin === 'true' && storedSocietyId === currentSocietyId) || storedIsSuperAdmin === 'true') {
      return <Outlet />;
    }
    
    // DEV 환경: society 파라미터 유지하며 로그인 페이지로 리다이렉트
    const params = new URLSearchParams(window.location.search);
    const societyParam = params.get('society');
    const loginPath = societyParam ? `/admin/login?society=${societyParam}` : '/admin/login';
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  const isSocietyPath = location.pathname.startsWith('/admin/society');
  const isConferencePath = location.pathname.startsWith('/admin/conf');
  const isSuperPath = location.pathname.startsWith('/super');

  if (isSuperPath) {
      if (isSuperAdmin) {
          return <Outlet />;
      } else {
          return <Navigate to="/admin/login" replace />;
      }
  }

  if (isSocietyPath || isConferencePath) {
      if (isAdminAuthorized === null) {
          return <LoadingSpinner />;
      }

      if (isAdminAuthorized) {
          return <Outlet />;
      } else {
          return <Navigate to="/admin/login" replace />;
      }
  }

  return <Outlet />;
};
export default AdminGuard;
