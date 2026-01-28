import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useRef } from 'react';
import { auth as firebaseAuth, db, functions } from '../firebase';
import { ConferenceUser } from '../types/schema';
import { setRootCookie, getRootCookie, removeRootCookie } from '../utils/cookie';

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

export const useAuth = (conferenceId?: string) => {
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
                console.warn("[Auth] Check timed out. Forcing app load.");
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
        // [Step 413-D] Silent & Robust Patch: Block sync if already authenticated
        // Note: currentUser is truthy here, so we are authenticated in Firebase.
        // If we also have a session cookie, we definitely skip.
        const existingToken = getRootCookie('eregi_session');
        
        if (!existingToken) {
             const now = Date.now();
             
             // Check Global Lock and Cooldown
             if (GLOBAL_SYNC_LOCK || (now - LAST_SYNC_TIME < 60000)) {
                 // Silent return (no warning logs to keep console clean)
                 // console.debug(`[Auth] Sync Locked/Cooldown.`); 
             } else {
                 // [Surgical Extraction] Sync logic physically removed
                 console.debug("[Auth] Token sync completely disabled.");
             }
        }

        // [Step 403-A] Prevent loading flash during sync
        // Don't set loading=true here - wait for snapshot to resolve
        
        // [Fix-Step 350] Real-time Sync
        const userDocRef = doc(db, 'users', currentUser.uid);
        
        // Subscribe to user doc
        docUnsub = onSnapshot(userDocRef, (docSnap: any) => {
             if (docSnap.exists()) {
                const userData = docSnap.data() as ConferenceUser;
                const userWithId = { 
                    ...userData, 
                    id: currentUser.uid, 
                    uid: currentUser.uid,
                    authStatus: userData.authStatus || { emailVerified: currentUser.emailVerified, phoneVerified: false }
                };
                
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
                            tier: 'NON_MEMBER',
                            authStatus: { emailVerified: currentUser.emailVerified, phoneVerified: false },
                            createdAt: null as any,
                            updatedAt: null as any
                        },
                        loading: false,
                        step: 'LOGGED_IN',
                        error: null
                    };
                 });
             }
        }, (err: any) => {
            console.error("Auth Snapshot Error:", err);
            setAuth(prev => {
                // 에러 메시지가 이전과 동일하다면 상태 업데이트를 스킵하여 리렌더링 차단
                if (prev.error === err.message) return prev;
                return { ...prev, loading: false, error: err.message };
            });
        });

      } else {
        // [Sync Restore] Check Cookie OR URL for Resurrection
        const urlParams = new URLSearchParams(window.location.search);
        // [Step 403-D] Check 'token' param first (Fallback mechanism)
        const fallbackToken = urlParams.get('token');
        const legacyUrlToken = urlParams.get('eregi_session');
        const cookieToken = getRootCookie('eregi_session');
        
        // Priority: 1. URL token (fallback) 2. Legacy URL token 3. Cookie
        const sessionToken = fallbackToken || legacyUrlToken || cookieToken;

        if (sessionToken) {
            console.log("[Auth] Found session token, attempting resurrection...");
            // [Step 403-A] Set loading during resurrection to prevent flash
            setAuth(prev => ({ ...prev, loading: true, step: 'REQUESTED' }));
            try {
                await signInWithCustomToken(firebaseAuth, sessionToken);
                
                // [Step 403-D] If we used a URL token, save it to cookie and clean URL
                if (fallbackToken || legacyUrlToken) {
                    setRootCookie('eregi_session', sessionToken);
                    
                    // Clean up URL for security and aesthetics
                    if (fallbackToken) {
                        const newUrl = new URL(window.location.href);
                        newUrl.searchParams.delete('token');
                        window.history.replaceState({}, document.title, newUrl.toString());
                    }
                }
                return; // Wait for the next state change
            } catch (loginErr) {
                console.warn("[Auth] Resurrection failed, clearing cookie:", loginErr);
                removeRootCookie('eregi_session');
                setAuth(prev => ({ ...prev, loading: false, step: 'IDLE' }));
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

  // Legacy / Mock methods kept for compatibility if needed, but essentially no-ops or wrappers
  const logout = async () => {
      console.log("🚪 LOGOUT REQUESTED");
      removeRootCookie('eregi_session'); // Sync Logout
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
