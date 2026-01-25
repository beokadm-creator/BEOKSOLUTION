import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Registration, ConferenceUser } from '../types/schema';

export interface RegistrationWithUser extends Registration {
    userName: string;
    userEmail: string;
    userPhone: string;
    userOrg?: string;
    userTier: string;
}

export const useRegistrations = (conferenceId: string) => {
    const [registrations, setRegistrations] = useState<RegistrationWithUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchRegistrations = async () => {
        setLoading(true);
        try {
            // 1. Fetch all registrations
            const regRef = collection(db, `conferences/${conferenceId}/registrations`);
            const regSnap = await getDocs(regRef);
            
            // 2. Fetch users to join data (Inefficient for large data, but okay for demo/MVP)
            // In prod, duplicate user info into registration doc or use efficient indexing/functions
            const regs = regSnap.docs.map(d => d.data() as Registration);
            
            const joinedData: RegistrationWithUser[] = [];

            // Parallel fetch optimization
            const userPromises = regs.map(async (reg) => {
                try {
                    const userRef = doc(db, `conferences/${conferenceId}/users/${reg.userId}`);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const userData = userSnap.data() as ConferenceUser;
                        return {
                            ...reg,
                            userName: userData.name,
                            userEmail: userData.email,
                            userPhone: userData.phone,
                            userTier: userData.tier,
                            // userOrg: userData.organization // Not in schema yet, add if needed
                        } as RegistrationWithUser;
                    }
                } catch (e) {
                    console.warn(`User not found for reg ${reg.id}`);
                }
                return {
                     ...reg,
                     userName: 'Unknown',
                     userEmail: '',
                     userPhone: '',
                     userTier: 'UNKNOWN'
                } as RegistrationWithUser;
            });

            const results = await Promise.all(userPromises);
            setRegistrations(results);
            setLoading(false);

        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            setError(errorMessage);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (conferenceId) {
            fetchRegistrations();
        }
    }, [conferenceId]);

    // Refund Logic (Reused/Extended)
    const processRefund = async (regId: string, amount: number) => {
         try {
            // Mock API Call
            console.log(`[useRegistrations] Refund ${amount} for ${regId}`);
            
            const regRef = doc(db, `conferences/${conferenceId}/registrations/${regId}`);
            await updateDoc(regRef, {
                paymentStatus: amount > 0 ? 'PARTIAL_REFUNDED' : 'REFUNDED', // Logic check needed: if amount < total, partial.
                refundAmount: amount, // Accumulate? Or set? For now set.
                updatedAt: Timestamp.now()
            });
            
            // Refresh
            fetchRegistrations();
            return true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            setError(errorMessage);
            return false;
        }
    };

    return {
        registrations,
        loading,
        error,
        refresh: fetchRegistrations,
        processRefund
    };
};
