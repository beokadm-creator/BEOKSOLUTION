import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { SESSION_KEYS, clearNonMemberSessions } from '../utils/cookie';

export interface NonMemberSession {
    registrationId: string;
    email: string;
    name: string;
    cid: string;
    paymentStatus?: string; // Add payment status
}

export const useNonMemberAuth = (currentCid?: string | null) => {
    const [nonMember, setNonMember] = useState<NonMemberSession | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    // Use ref to track the actual session value immediately
    const nonMemberRef = useRef<NonMemberSession | null>(null);
    const restoredCidRef = useRef<string | null>(null);

    // Restore session on mount (with payment verification)
    // Use useLayoutEffect for synchronous state updates
    useLayoutEffect(() => {
        const restoreSession = async () => {
            try {
                const stored = sessionStorage.getItem(SESSION_KEYS.NON_MEMBER);
                if (!stored) {
                    // No session to restore
                    console.log('[useNonMemberAuth] No session in sessionStorage');
                    setNonMember(null);
                    nonMemberRef.current = null;
                    setLoading(false);
                    setInitialLoadComplete(true);
                } else {
                    const session: NonMemberSession = JSON.parse(stored);

                    // CRITICAL: Only mark initialLoadComplete=true when we have a valid CID
                    // If currentCid is not available yet, just wait (don't mark as complete)
                    if (!currentCid) {
                        // Conference ID not loaded yet - just wait, don't mark load complete
                        console.log('[useNonMemberAuth] Current CID not available yet, waiting for conference data');
                        setNonMember(null);
                        nonMemberRef.current = null;
                        setLoading(false);
                        // DON'T set initialLoadComplete=true yet - we're still waiting
                        return;
                    }

                    // Track which CID we've restored for
                    if (restoredCidRef.current !== currentCid) {
                        restoredCidRef.current = currentCid;

                        // If currentCid is provided, verify it matches session
                        if (session.cid !== currentCid) {
                            // Session is for a different conference
                            console.log('[useNonMemberAuth] Session CID mismatch:', { sessionCid: session.cid, currentCid });
                            clearNonMemberSessions();
                            setNonMember(null);
                            nonMemberRef.current = null;
                        } else {
                            // CRITICAL FIX: Verify payment status if not already stored in session
                            if (!session.paymentStatus && session.registrationId) {
                                // Query Firestore to get current payment status
                                // Note: This would require db import. For now, we'll trust the session data
                                // The ConferenceDetailHome will do the actual verification
                                console.warn('[useNonMemberAuth] Session missing paymentStatus. Verification will be done by page.');
                            }

                            // Restore session - CID matches
                            console.log('[useNonMemberAuth] Restoring session from sessionStorage:', session);
                            setNonMember(session);
                            nonMemberRef.current = session;
                        }
                    } else {
                        // Already restored for this CID, keep current state
                        console.log('[useNonMemberAuth] Session already restored for this CID');
                    }
                }

                // Set loading and initialLoadComplete states after all restoration attempts
                setLoading(false);
                setInitialLoadComplete(true);
            } catch (err) {
                console.error('Failed to restore non-member session', err);
                clearNonMemberSessions();
                setNonMember(null);
                nonMemberRef.current = null;
                setLoading(false);
                setInitialLoadComplete(true);
            }
        };

        restoreSession();
    }, [currentCid]);

    const login = useCallback(async (email: string, password: string, cid: string) => {
        setLoading(true);
        setError(null);

        let session: NonMemberSession | null = null;

        try {
            console.log('[useNonMemberAuth] Starting login:', { email, cid });

            // 30 second timeout for login
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(new Error('요청 시간이 초과되었습니다. 인터넷 연결을 확인하고 다시 시도해주세요.'));
                }, 30000);
            });

            const loginPromise = (async (): Promise<NonMemberSession> => {
                // Use Cloud Function to authenticate non-member
                console.log('[useNonMemberAuth] Calling resumeGuestRegistration...');
                const resumeGuestRegistration = httpsCallable(functions, 'resumeGuestRegistration');
                const result = await resumeGuestRegistration({ email, password, confId: cid });

                console.log('[useNonMemberAuth] Cloud Function response:', result);

                if (!result.data || !(result.data as any).success) {
                    const errorMsg = (result.data as any)?.message || '등록된 이메일 정보를 찾을 수 없거나 비밀번호가 일치하지 않습니다.';
                    throw new Error(errorMsg);
                }

                const responseData = (result.data as any).data;
                const paymentStatus = responseData.paymentStatus || 'PENDING';

                console.log('[useNonMemberAuth] Response data:', { responseData, paymentStatus });

                // CRITICAL FIX: Allow PENDING registrations to resume
                // Users need to access their PENDING registrations to complete payment
                const newSession: NonMemberSession = {
                    registrationId: responseData.registrationId,
                    email: responseData.email || email,
                    name: responseData.name || 'Non-Member',
                    cid: cid,
                    paymentStatus: paymentStatus
                };

                console.log('[useNonMemberAuth] Session created:', newSession);

                sessionStorage.setItem(SESSION_KEYS.NON_MEMBER, JSON.stringify(newSession));
                setNonMember(newSession);
                nonMemberRef.current = newSession;
                restoredCidRef.current = cid;

                return newSession;
            })();

            // Race between login and timeout - MUST explicitly type as NonMemberSession
            session = await Promise.race([loginPromise, timeoutPromise]);

            console.log('[useNonMemberAuth] Login completed, session:', session);

            return session;

        } catch (err: any) {
            console.error('[useNonMemberAuth] Login error:', err);
            const errorMessage = err.code === 'functions/internal'
                ? '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
                : (err.message || '인증에 실패했습니다.');
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, []);

    const logout = useCallback(() => {
        clearNonMemberSessions();
        setNonMember(null);
        nonMemberRef.current = null;
        restoredCidRef.current = null;
    }, []);

    return {
        nonMember,
        loading,
        initialLoadComplete,
        error,
        login,
        logout
    };
};
