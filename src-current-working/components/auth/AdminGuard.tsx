import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Navigate, Outlet, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../common/LoadingSpinner';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';

import { SUPER_ADMINS } from '../../constants/defaults';

const AdminGuard: React.FC = () => {
  const { auth: { user, loading } } = useAuth();
  const location = useLocation();
  const { cid, sid } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isBypassing, setIsBypassing] = useState(false);
  const [bypassLoading, setBypassLoading] = useState(false);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState<boolean | null>(null);

  const userEmail = user?.email || '';
  const isSuperAdmin = userEmail && SUPER_ADMINS.includes(userEmail);

  const currentSocietyId = useMemo(() => {
    if (sid) return sid;
    if (cid) {
      const parts = cid.split('_');
      if (parts.length >= 1) return parts[0];
    }
    return null;
  }, [cid, sid]);

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
                  const data = result.data as any;

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

          } catch (e: any) {
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
      } catch (error) {
          setIsAdminAuthorized(false);
      }
  }, [isSuperAdmin, userEmail, currentSocietyId]);

  useEffect(() => {
      if (user && !loading && !isBypassing) {
          checkSocietyAdminCallback();
      }
  }, [user, loading, isBypassing, checkSocietyAdminCallback]);

  if (loading || bypassLoading) return <LoadingSpinner />;
  
  if (isBypassing) {
      console.log(`🛡️ [AdminGuard] Bypass token active - allowing access`);
      return <Outlet />;
  }

  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
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
