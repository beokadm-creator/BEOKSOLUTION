import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useLocation, useParams } from 'react-router-dom';
import { SUPER_ADMINS } from '../constants/defaults';

const EMPTY_ADMIN_STATE = { isAdmin: false, loading: false, permissions: null, isSocietyAdmin: false };

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
        
        console.log('🛡️ [useSocietyAdmin] Checking admin rights:', { societyId, userEmail });
        
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
                const isSuperAdmin = SUPER_ADMINS.includes(userEmail || '');
                
                if (isSuperAdmin) {
                    console.log('🛡️ [useSocietyAdmin] SUPER_ADMIN access granted');
                    setIsSocietyAdmin(true);
                    setLoading(false);
                    return;
                }

                const socRef = doc(db, 'societies', societyId);
                const socSnap = await getDoc(socRef);
                
                if (socSnap.exists()) {
                    const data = socSnap.data();
                    const isAuthorized = data.adminEmails && Array.isArray(data.adminEmails) && data.adminEmails.includes(userEmail);
                    
                    console.log('🛡️ [useSocietyAdmin] Society data:', { societyId, isAuthorized });
                    
                    setIsSocietyAdmin(isAuthorized);
                } else {
                    console.warn('🛡️ [useSocietyAdmin] Society document not found:', societyId);
                    setIsSocietyAdmin(false);
                }
            } catch (error) {
                console.error('🛡️ [useSocietyAdmin] Error checking society admin:', error);
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
    }, [isAdmin, loading, permissions, isSocietyAdmin, societyId, isSuperPath]); 
};
