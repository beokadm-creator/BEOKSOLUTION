import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, signInWithCustomToken } from 'firebase/auth';
import { onSnapshot, doc, DocumentData } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth as firebaseAuth, db, functions } from '../firebase';
import { ConferenceUser } from '../types/schema';
import { getRootCookie, removeRootCookie, clearAllSessions } from '../utils/cookie';
import { getSessionToken } from '../utils/sessionManager';

// [Step 412-D] 물리적 쿨다운 강제
const GLOBAL_SYNC_LOCK = false;
const LAST_SYNC_TIME = 0;

export interface AuthState {
  user: ConferenceUser | null;
  loading: boolean;
  step: 'IDLE' | 'REQUESTED' | 'VERIFIED' | 'LOGGED_IN';
  error: string | null;
  syncError?: boolean; // [Silent Patch] CORS/Network failure flag
}

export const useAuth = () => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    loading: true,
    step: 'IDLE',
    error: null,
  });

  // const isSyncing = useRef(false); // [Step 412-D] Replaced by GLOBAL_SYNC_LOCK
  // const lastMintAttempt = useRef<number>(0); 

  useEffect(() => {
    // 1. Safety Timeout (Fix for infinite loading)
    // If Firebase takes > 15s to respond, force loading to false
    const safetyTimeout = setTimeout(() => {
        setAuth(prev => {
            if (prev.loading) {
                return { ...prev, loading: false };
            }
            return prev;
        });
    }, 15000);

    // 2. Auth Listener
    let docUnsub: (() => void) | null = null; // Snapshot Listener

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
      clearTimeout(safetyTimeout); // Clear timeout if Firebase responds

      if (currentUser) {
        // CRITICAL FIX: Clear non-member session when member logs in
        // Prevents privacy leak from previous non-member session
        try {
          sessionStorage.removeItem('NON_MEMBER');
          console.log('[useAuth] Cleared non-member session on member login');
        } catch (err) {
          console.warn('[useAuth] Failed to clear non-member session:', err);
        }

        // [Step 413-D] Silent & Robust Patch: Block sync if already authenticated
        // Note: currentUser is truthy here, so we are authenticated in Firebase.
        // If we also have a session cookie, we definitely skip.
        const existingToken = getRootCookie('eregi_session');
        
        if (!existingToken) {
             const now = Date.now();
             
              // Check Global Lock and Cooldown
              if (GLOBAL_SYNC_LOCK || (now - LAST_SYNC_TIME < 60000)) {
                  // Silent return (no warning logs to keep console clean)
              } else {
                  // [Surgical Extraction] Sync logic physically removed
              }
        }

        // [Step 403-A] Prevent loading flash during sync
        // Don't set loading=true here - wait for snapshot to resolve
        
        // [Fix-Step 350] Real-time Sync
        const userDocRef = doc(db, 'users', currentUser.uid);
        
        // Subscribe to user doc
        docUnsub = onSnapshot(userDocRef, (docSnap) => {
                   if (docSnap.exists()) {
                   const userData = docSnap.data() as DocumentData;

                   console.log('[useAuth] Raw Firestore userData:', userData);
                   console.log('[useAuth] userData.phoneNumber:', userData.phoneNumber);
                   console.log('[useAuth] userData.phone:', userData.phone);
                   console.log('[useAuth] userData.affiliation:', userData.affiliation);
                   console.log('[useAuth] userData.organization:', userData.organization);

                    // Handle userName vs name field mapping
                    // [FIX-20250124-02] Also map phoneNumber → phone, affiliation → organization
                    const userWithName = {
                       ...userData,
                       name: userData.name || userData.userName || currentUser.displayName || 'User',  // ✅ userName을 name으로 매핑
                       phone: userData.phone || userData.phoneNumber || '', // ✅ phoneNumber을 phone으로 매핑
                       organization: userData.organization || userData.affiliation || '' // ✅ affiliation을 organization으로 매핑
                    };

                    console.log('[useAuth] Mapped phone:', userWithName.phone);
                    console.log('[useAuth] Mapped organization:', userWithName.organization);

                   const userWithId = {
                      ...userWithName,
                      id: currentUser.uid,
                      uid: currentUser.uid,
                       authStatus: userData.authStatus || { emailVerified: currentUser.emailVerified, phoneVerified: false }
                   };

                   console.log('[useAuth] Final userWithId:', userWithId);

                   // [Fix] Value Comparison to prevent Loop
                  setAuth(prev => {
                     // JSON stringify for deep comparison of user object
                     const prevUserStr = JSON.stringify(prev.user);
                     const newUserStr = JSON.stringify(userWithId);

                     if (prevUserStr === newUserStr && prev.step === 'LOGGED_IN' && !prev.loading) {
                         return prev;
                     }

                    return {
                        user: userWithId,
                        loading: false,
                        step: 'LOGGED_IN',
                        error: null
                    };
                });
              } else {
                  // Doc missing
                  // [Fix] Value Comparison for Missing Doc case
                 setAuth(prev => {
                    if (prev.user?.uid === currentUser.uid && prev.step === 'LOGGED_IN' && !prev.loading) {
                        return prev;
                    }
                    return {
                        user: {
                            uid: currentUser.uid,
                            id: currentUser.uid,
                            name: currentUser.displayName || 'User',
                            email: currentUser.email || '',
                            phone: '',
                            country: 'KR',
                            isForeigner: false,
                            tier: 'NON_MEMBER' as 'MEMBER' | 'NON_MEMBER',
                            authStatus: { emailVerified: currentUser.emailVerified, phoneVerified: false },
                            createdAt: null as Timestamp | null,
                            updatedAt: null as Timestamp | null
                        },
                        loading: false,
                        step: 'LOGGED_IN',
                        error: null
                    };
                 });
              }
        }, (err: { code?: string; message?: string }) => {
            setAuth(prev => {
                // 에러 메시지가 이전과 동일하다면 상태 업데이트를 스킵하여 리렌더링 차단
                if (prev.error === err.message) return prev;
                return { ...prev, loading: false, error: err.message || 'Unknown error' };
            });
        });

      } else {
        const sessionInfo = getSessionToken();
        const sessionToken = sessionInfo.token;

        if (sessionToken) {
            setAuth(prev => ({ ...prev, loading: true, step: 'REQUESTED' }));
            try {
                if (!sessionInfo.isValid) {
                    removeRootCookie('eregi_session');
                    throw new Error("Session token expired. Please login again.");
                }

                // [Step 2] Call Cloud Function to mint Custom Token
                let customTokenToUse: string | null = null;
                const mintFn = httpsCallable(functions, 'mintCrossDomainToken');

                try {
                    const { data } = await mintFn({ idToken: sessionToken });
                    const resultData = data as { token: string };

                    if (!resultData.token) {
                        throw new Error("Custom token not received from server");
                    }

                    customTokenToUse = resultData.token;
                } catch (mintErr: unknown) {
                    const error = mintErr instanceof Error ? mintErr : new Error(String(mintErr));
                    throw new Error(`Failed to exchange token: ${error.message}`);
                }

                if (customTokenToUse) {
                    await signInWithCustomToken(firebaseAuth, customTokenToUse);
                } else {
                    throw new Error("No valid custom token available for login");
                }

                if (sessionInfo.source === 'url_fallback' || sessionInfo.source === 'url_legacy') {
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.delete('token');
                    newUrl.searchParams.delete('eregi_session');
                    window.history.replaceState({}, document.title, newUrl.toString());
                }
                return;
            } catch (loginErr: unknown) {
                clearAllSessions();
                const message = loginErr instanceof Error ? loginErr.message : 'Failed to restore session';
                setAuth(prev => ({
                    ...prev,
                    loading: false,
                    step: 'IDLE',
                    error: message
                }));
            }
        }

        if (docUnsub) {
            docUnsub();
            docUnsub = null;
        }
        setAuth({
          user: null,
          loading: false,
          step: 'IDLE',
          error: null
        });
      }
    });

    return () => {
        unsubscribe();
        if (docUnsub) docUnsub();
        clearTimeout(safetyTimeout);
    };
  }, []); // Run once on mount

  const logout = async () => {
      clearAllSessions();
      await signOut(firebaseAuth);
      setAuth({
        user: null,
        loading: false,
        step: 'IDLE',
        error: null
      });
  };

  return {
    auth,
    logout,
    // Keep these if RegistrationPage calls them, but they might be deprecated
    requestKoreanAuth: async () => {},
    verifyKoreanAuth: async () => {},
    requestForeignerAuth: async () => {},
    verifyForeignerAuth: async () => {}
  };
};
