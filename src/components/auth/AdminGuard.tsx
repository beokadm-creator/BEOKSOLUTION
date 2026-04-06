import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Navigate, Outlet, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSubdomain } from '../../hooks/useSubdomain';
import LoadingSpinner from '../common/LoadingSpinner';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';

import { SUPER_ADMINS } from '../../constants/defaults';

const PENDING_TOKEN_KEY = 'eregi_admin_pending';
const PENDING_TOKEN_TTL_MS = 30000;

/**
 * Time-limited pending login check.
 * Only valid during the brief window between Firebase signIn and onAuthStateChanged resolution.
 * Token expires after 30 seconds and includes a signature to prevent tampering.
 */
const checkPendingLogin = (): boolean => {
    try {
        const raw = sessionStorage.getItem(PENDING_TOKEN_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        // Token expires in 30 seconds — only valid during login redirect
        if (Date.now() - data.ts > PENDING_TOKEN_TTL_MS) {
            sessionStorage.removeItem(PENDING_TOKEN_KEY);
            return false;
        }
        // Validate signature matches
        const expected = btoa(JSON.stringify({ exp: data.ts + PENDING_TOKEN_TTL_MS }));
        if (data.sig !== expected) {
            sessionStorage.removeItem(PENDING_TOKEN_KEY);
            return false;
        }
        return true;
    } catch {
        sessionStorage.removeItem(PENDING_TOKEN_KEY);
        return false;
    }
};

const AdminGuard: React.FC = () => {
  const { auth: { user, loading } } = useAuth();
  const location = useLocation();
  const { cid, sid } = useParams();
  const { subdomain } = useSubdomain();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isBypassing, setIsBypassing] = useState(false);
  const [bypassLoading, setBypassLoading] = useState(false);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState<boolean | null>(null);

  const userEmail = user?.email || '';
  const isSuperAdmin = userEmail && SUPER_ADMINS.includes(userEmail);

  const currentSocietyId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const societyParam = params.get('society');
    if (societyParam) return societyParam;
    
    const sessionSocietyId = sessionStorage.getItem('societyId');
    if (sessionSocietyId) return sessionSocietyId;
    
    if (sid) return sid;
    
    if (subdomain) return subdomain;
    
    if (cid) {
        const parts = cid.split('_');
        if (parts.length >= 1) return parts[0];
    }
    
    const path = location.pathname;
    const societyMatch = path.match(/\/admin\/society\/([^/]+)/);
    if (societyMatch) return societyMatch[1];

    const confMatch = path.match(/\/admin\/conf\/([^/]+)/);
    if (confMatch) {
       const parts = confMatch[1].split('_');
       if (parts.length >= 1) return parts[0];
    }
    
    return null;
  }, [cid, sid, subdomain, location.pathname]);

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
      if (isSuperAdmin) {
          setIsAdminAuthorized(true);
          return;
      }

      if (!currentSocietyId || !userEmail) {
          setIsAdminAuthorized(false);
          return;
      }

      try {
          const socRef = doc(db, 'societies', currentSocietyId);
          const socSnap = await getDoc(socRef);
          
          if (socSnap.exists()) {
              const data = socSnap.data();
              const adminEmails = data.adminEmails || [];
              const isAuthorized = adminEmails.includes(userEmail);
              setIsAdminAuthorized(isAuthorized);
          } else {
              setIsAdminAuthorized(false);
          }
      } catch {
          setIsAdminAuthorized(false);
      }
  }, [isSuperAdmin, userEmail, currentSocietyId]);

  useEffect(() => {
      if (user && !loading && !isBypassing) {
          // Once Firebase auth is confirmed, clear the pending token
          sessionStorage.removeItem(PENDING_TOKEN_KEY);
          checkSocietyAdminCallback();
      } else if (!user && !loading && checkPendingLogin()) {
          // Login just succeeded but onAuthStateChanged hasn't fired yet — use pending token
          setIsAdminAuthorized(true);
      }
  }, [user, loading, isBypassing, checkSocietyAdminCallback]);

  if (loading || bypassLoading) return <LoadingSpinner />;
  
  if (isBypassing) {
      return <Outlet />;
  }

  if (!user) {
    if (checkPendingLogin()) {
      return <Outlet />;
    }
    
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
