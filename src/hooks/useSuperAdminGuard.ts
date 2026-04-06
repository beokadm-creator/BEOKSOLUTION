import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export const useSuperAdminGuard = () => {
    const [authorized, setAuthorized] = useState(false);
    const [checking, setChecking] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
            if (!user) {
                // Not logged in -> Redirect to Login
                setAuthorized(false);
                setChecking(false);
                navigate('/login');
                return;
            }

            const email = (user.email || '').toLowerCase();

            // Primary: Check Firestore super_admins collection
            try {
                const docRef = doc(db, 'super_admins', email);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists() && docSnap.data()?.role === 'SUPER_ADMIN') {
                    setAuthorized(true);
                } else {
                    toast.error("Access Denied: Not a Super Admin");
                    setAuthorized(false);
                    navigate('/');
                }
            } catch (error) {
                console.error("Super Admin Check Failed", error);
                setAuthorized(false);
                navigate('/');
            } finally {
                setChecking(false);
            }
        });

        return () => unsubscribe();
         
    }, [navigate]);

    return { authorized, checking };
};
