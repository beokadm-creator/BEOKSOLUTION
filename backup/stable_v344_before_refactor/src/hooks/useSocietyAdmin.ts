import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useLocation } from 'react-router-dom';

const EMPTY_ADMIN_STATE = { isAdmin: false, loading: false, permissions: null, isSocietyAdmin: false };

export const useSocietyAdmin = (societyId: string | undefined, userEmail: string | undefined | null) => {
    const { pathname } = useLocation();
    const isSuperPath = pathname.startsWith('/super');

    const [isSocietyAdmin, setIsSocietyAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // [Super Pass] 완전 격리: Super Path에서는 아무것도 하지 않음
        if (isSuperPath) {
            setLoading(false);
            return;
        }

        // [Hard-Fix] Silence all logic if societyId is missing
        if (!societyId) {
             return;
        }
        
        console.log('[useSocietyAdmin] Checking admin rights:', { societyId, userEmail });
        
        const checkAdmin = async () => {
            // [Kill Switch] 2. Stop loop by returning early if no societyId
            // Do NOT set state here if societyId is missing.
            // Check handled above, but kept for safety inside async
            if (!societyId) {
                return;
            }

            setLoading(true);
            if (!userEmail) {
                setLoading(false);
                return;
            }

            try {
                // 0. Super Admin Bypass
                const SUPER_ADMINS = ['aaron@beoksolution.com', 'test@eregi.co.kr', 'any@eregi.co.kr'];
                if (SUPER_ADMINS.includes(userEmail || '')) {
                    console.log('[useSocietyAdmin] Super Admin access granted');
                    setIsSocietyAdmin(true);
                    setLoading(false);
                    return;
                }

                // Check society document's adminEmails array
                const socRef = doc(db, 'societies', societyId);
                const socSnap = await getDoc(socRef);
                
                if (socSnap.exists()) {
                    const data = socSnap.data();
                    console.log('[useSocietyAdmin] Society data:', { societyId, data: { adminEmails: data.adminEmails } });
                    if (data.adminEmails && Array.isArray(data.adminEmails) && data.adminEmails.includes(userEmail)) {
                        console.log('[useSocietyAdmin] Admin access granted for:', userEmail);
                        setIsSocietyAdmin(true);
                    } else {
                        console.log('[useSocietyAdmin] Admin access denied for:', userEmail);
                        setIsSocietyAdmin(false);
                    }
                } else {
                    console.log('[useSocietyAdmin] Society document not found for:', societyId);
                    setIsSocietyAdmin(false);
                }
            } catch (error) {
                console.error("[useSocietyAdmin] Error checking society admin:", error);
                setIsSocietyAdmin(false);
            } finally {
                setLoading(false);
            }
        };

        checkAdmin();
    }, [societyId, userEmail]);

    const isAdmin = isSocietyAdmin;
    const permissions = null;

    return useMemo(() => {
        if (isSuperPath) return EMPTY_ADMIN_STATE;
        if (!societyId) return EMPTY_ADMIN_STATE;
        
        return { isAdmin, loading, permissions, isSocietyAdmin };
    }, [isAdmin, loading, permissions, isSocietyAdmin, societyId, isSuperPath]); 
};
