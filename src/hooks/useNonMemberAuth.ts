import { useState, useLayoutEffect, useCallback, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { functions, auth, db } from '../firebase';
import { SESSION_KEYS } from '../utils/cookie';

export interface NonMemberSession {
    registrationId: string;
    email: string;
    name: string;
    uid?: string;
    cid: string;
    paymentStatus?: string;
    phone?: string;
    affiliation?: string;
    licenseNumber?: string;
    formData?: unknown;
    agreements?: unknown;
    memberVerificationData?: unknown;
    currentStep?: number;
    categoryName?: string;
    amount?: number;
}

export const useNonMemberAuth = (currentCid?: string | null) => {
    const [nonMember, setNonMember] = useState<NonMemberSession | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const nonMemberRef = useRef<NonMemberSession | null>(null);
    const restoredCidRef = useRef<string | null>(null);

    useLayoutEffect(() => {
        const restoreSession = async () => {
            try {
                const stored = sessionStorage.getItem(SESSION_KEYS.NON_MEMBER);
                if (!stored) {
                    console.log('[useNonMemberAuth] No session in sessionStorage');
                    setNonMember(null);
                    nonMemberRef.current = null;
                    setLoading(false);
                    setInitialLoadComplete(true);
                } else {
                    const session: NonMemberSession = JSON.parse(stored);

                    if (!currentCid) {
                        console.log('[useNonMemberAuth] Current CID not available yet, waiting for conference data');
                        setNonMember(null);
                        nonMemberRef.current = null;
                        setLoading(false);
                        return;
                    }

                    if (restoredCidRef.current !== currentCid) {
                        restoredCidRef.current = currentCid;

                        if (session.cid !== currentCid) {
                            console.log('[useNonMemberAuth] Session CID mismatch:', { sessionCid: session.cid, currentCid });
                            sessionStorage.removeItem(SESSION_KEYS.OPERATOR_TOKEN);
                            setNonMember(null);
                            nonMemberRef.current = null;
                        } else {
                            if (!session.paymentStatus && session.registrationId) {
                                console.warn('[useNonMemberAuth] Session missing paymentStatus. Verification will be done by page.');
                            }

                            console.log('[useNonMemberAuth] Restoring session from sessionStorage:', session);
                            setNonMember(session);
                            nonMemberRef.current = session;
                        }
                    } else {
                        console.log('[useNonMemberAuth] Session already restored for this CID');
                    }
                }

                setLoading(false);
                setInitialLoadComplete(true);
            } catch (err) {
                console.error('Failed to restore non-member session', err);
                sessionStorage.removeItem(SESSION_KEYS.OPERATOR_TOKEN);
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

            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(new Error('요청 시간이 초과되었습니다. 인터넷 연결을 확인하고 다시 시도해주세요.'));
                }, 30000);
            });

            const loginPromise = (async (): Promise<NonMemberSession> => {
                try {
                    console.log('[useNonMemberAuth] Attempting Firebase Auth login...');
                    const userCredential = await signInWithEmailAndPassword(auth, email, password);
                    const user = userCredential.user;
                    console.log('[useNonMemberAuth] Firebase Auth success:', user.uid);

                    const registrationsRef = collection(db, 'conferences', cid, 'registrations');
                    let q = query(registrationsRef, where('userId', '==', user.uid));
                    let querySnapshot = await getDocs(q);

                    if (querySnapshot.empty) {
                         console.log('[useNonMemberAuth] No registration found by userId, trying email...');
                         q = query(registrationsRef, where('email', '==', email));
                         querySnapshot = await getDocs(q);
                    }

                    if (!querySnapshot.empty) {
                        const docSnapshot = querySnapshot.docs[0];
                        const data = docSnapshot.data();
                        console.log('[useNonMemberAuth] Registration found:', docSnapshot.id);

                        const newSession: NonMemberSession = {
                            registrationId: docSnapshot.id,
                            email: data.email || email,
                            name: data.name || user.displayName || 'Member',
                            uid: user.uid,
                            cid: cid,
                            paymentStatus: data.paymentStatus || 'PENDING',
                            phone: data.phone,
                            affiliation: data.affiliation,
                            licenseNumber: data.licenseNumber,
                            formData: data.formData,
                            agreements: data.agreements,
                            memberVerificationData: data.memberVerificationData,
                            currentStep: data.currentStep,
                            categoryName: data.categoryName,
                            amount: data.amount
                        };

                        console.log('[useNonMemberAuth] Session created:', newSession);
                        
                        sessionStorage.setItem(SESSION_KEYS.NON_MEMBER, JSON.stringify(newSession));
                        setNonMember(newSession);
                        nonMemberRef.current = newSession;
                        restoredCidRef.current = cid;
                        
                        return newSession;
                    } else {
                        console.log('[useNonMemberAuth] No registration found for authenticated user.');
                        throw new Error('해당 학술대회에 등록된 정보가 없습니다.');
                    }

                } catch (authErr: unknown) {
                    console.log('[useNonMemberAuth] Firebase Auth failed, proceeding to guest lookup:', authErr);
                }

                console.log('[useNonMemberAuth] Calling resumeGuestRegistration...');
                const resumeGuestRegistration = httpsCallable(functions, 'resumeGuestRegistration');
                const result = await resumeGuestRegistration({ email, password, confId: cid });

                console.log('[useNonMemberAuth] Cloud Function response:', result);

                const responseData = result.data as { success: boolean; data?: Record<string, unknown>; message?: string };
                
                if (!result.data || !responseData.success) {
                    const errorMsg = responseData?.message || '등록된 이메일 정보를 찾을 수 없거나 비밀번호가 일치하지 않습니다.';
                    throw new Error(errorMsg);
                }

                const data = responseData.data as Record<string, unknown> | undefined;
                const paymentStatus = (data?.paymentStatus as string) || 'PENDING';

                console.log('[useNonMemberAuth] Response data:', { responseData, paymentStatus });

                const newSession: NonMemberSession = {
                    registrationId: (data?.registrationId as string) || '',
                    email: (data?.email as string) || email,
                    name: (data?.name as string) || 'Non-Member',
                    uid: (data?.userId as string | undefined) || (data?.registrationId as string),
                    cid: cid,
                    paymentStatus: paymentStatus,
                    phone: data?.phone as string | undefined,
                    affiliation: data?.affiliation as string | undefined,
                    licenseNumber: data?.licenseNumber as string | undefined,
                    formData: data?.formData,
                    agreements: data?.agreements,
                    memberVerificationData: data?.memberVerificationData,
                    currentStep: data?.currentStep as number | undefined,
                    categoryName: data?.categoryName as string | undefined,
                    amount: data?.amount as number | undefined
                };

                console.log('[useNonMemberAuth] Session created:', newSession);

                sessionStorage.setItem(SESSION_KEYS.NON_MEMBER, JSON.stringify(newSession));
                setNonMember(newSession);
                nonMemberRef.current = newSession;
                restoredCidRef.current = cid;

                return newSession;
            })();

            session = await Promise.race([loginPromise, timeoutPromise]);

            console.log('[useNonMemberAuth] Login completed, session:', session);

            return session;

        } catch (err: unknown) {
            console.error('[useNonMemberAuth] Login error:', err);
            const errorMessage = (err as { code?: string; message?: string }).code === 'functions/internal'
                ? '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
                : ((err as { message?: string }).message || '인증에 실패했습니다.');
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, []);

    const logout = useCallback(() => {
        sessionStorage.removeItem(SESSION_KEYS.OPERATOR_TOKEN);
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
