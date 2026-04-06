import { useState, useEffect, useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { SUPER_ADMINS } from '../constants/defaults';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { resolveSocietyByIdentifier } from '../utils/societyResolver';

const EMPTY_ADMIN_STATE = { isAdmin: false, loading: false, permissions: null, isSocietyAdmin: false };

/**
 * Check if an email is a super admin.
 * Primary: Firestore `super_admins` collection lookup.
 * Fallback: hardcoded SUPER_ADMINS array (for offline/outage resilience).
 */
const checkIsSuperAdmin = async (email: string): Promise<boolean> => {
    if (!email) return false;
    try {
        const docRef = doc(db, 'super_admins', email.toLowerCase());
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.role === 'SUPER_ADMIN') return true;
        }
    } catch {
        // Firestore unavailable — fallback below
    }
    return SUPER_ADMINS.includes(email);
};

export const useSocietyAdmin = (societyId: string | undefined, userEmail: string | undefined | null) => {
    const { pathname } = useLocation();
    const { vid } = useParams();
    const isSuperPath = pathname.startsWith('/super');

    const [isSocietyAdmin, setIsSocietyAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (vid) {
            setLoading(false);
            return;
        }

        if (isSuperPath) {
            setLoading(false);
            return;
        }

        if (!societyId) {
             return;
        }
        
        const checkAdmin = async () => {
            if (!societyId) {
                return;
            }

            setLoading(true);
            if (!userEmail) {
                setLoading(false);
                return;
            }

            try {
                const isSuperAdminResult = await checkIsSuperAdmin(userEmail);
                
                if (isSuperAdminResult) {
                    setIsSocietyAdmin(true);
                    setLoading(false);
                    return;
                }

                const resolved = await resolveSocietyByIdentifier(societyId);

                if (resolved) {
                    const data = resolved.data;
                    const isAuthorized = data.adminEmails && Array.isArray(data.adminEmails) && data.adminEmails.includes(userEmail);
                    
                    setIsSocietyAdmin(isAuthorized);
                } else {
                    setIsSocietyAdmin(false);
                }
            } catch {
                setIsSocietyAdmin(false);
            } finally {
                setLoading(false);
            }
        };

        checkAdmin();
    }, [societyId, userEmail, isSuperPath, vid]);

    const isAdmin = isSocietyAdmin;
    const permissions = null;

    return useMemo(() => {
        if (isSuperPath) return EMPTY_ADMIN_STATE;
        if (!societyId) return EMPTY_ADMIN_STATE;
        
        return { isAdmin, loading, permissions, isSocietyAdmin };
    }, [isAdmin, loading, isSocietyAdmin, societyId, isSuperPath]); 
};
