import { useState, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/firebase';
import toast from 'react-hot-toast';

export const useSuperAdminMembers = () => {
    const [members, setMembers] = useState<Array<{
        id: string;
        name?: string;
        email?: string;
        phone?: string;
        organization?: string;
        affiliation?: string;
        marketingAgreed?: boolean;
        infoAgreed?: boolean;
        createdAt?: { seconds: number };
    }>>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    const fetchMembers = useCallback(async (currentSocietyId: string) => {
        console.log('[useSuperAdminMembers] fetchMembers called, currentSocietyId:', currentSocietyId);
        setLoadingMembers(true);
        try {
            // Directly fetch all users from /users collection
            const usersRef = collection(db, 'users');
            const userSnap = await getDocs(usersRef);

            console.log('[useSuperAdminMembers] Total users in /users collection:', userSnap.docs.length);

            const membersList: typeof members = [];

            userSnap.docs.forEach(userDoc => {
                const userData = userDoc.data() as { name?: string; email?: string; phone?: string; organization?: string; affiliation?: string; marketingAgreed?: boolean; infoAgreed?: boolean; createdAt?: { seconds: number } };
                membersList.push({
                    id: userDoc.id,
                    ...userData
                });
            });

            console.log('[useSuperAdminMembers] Final members count:', membersList.length);
            setMembers(membersList);
        } catch (e) {
            console.error('[useSuperAdminMembers] fetchMembers error:', e);
            toast.error("Failed to fetch members");
        } finally {
            setLoadingMembers(false);
        }
    }, []);

    const handleDeleteUser = async (uid: string) => {
        if (!confirm("WARNING: This will PERMANENTLY DELETE the user account (Auth + DB). This cannot be undone.\n\nAre you sure?")) return;

        const toastId = toast.loading("Deleting user...");
        try {
            const deleteFn = httpsCallable(functions, 'deleteUserAccount');
            const res = await deleteFn({ uid }) as { data: { success: boolean } };

            if (res.data.success) {
                toast.success("User terminated.", { id: toastId });
                setMembers(prev => prev.filter(m => m.id !== uid));
            } else {
                toast.error("Deletion failed.", { id: toastId });
            }
        } catch (e) {
            console.error("Delete Error:", e);
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            toast.error(`Error: ${errorMessage}`, { id: toastId });
        }
    };

    return {
        members,
        loadingMembers,
        fetchMembers,
        handleDeleteUser
    };
};
