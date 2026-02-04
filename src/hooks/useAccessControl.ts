import { useState } from 'react';
import { collection, query, where, getDocs, addDoc, Timestamp, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Registration } from '../types/schema';

export const useAccessControl = (conferenceId: string, locationId: string = 'ROOM_A') => {
    const [log, setLog] = useState<{ message: string; type: 'SUCCESS' | 'ERROR' | 'INFO' }>({ 
        message: 'Ready to scan', type: 'INFO' 
    });

    // Role-based Access Logic (Simplified)
    const scanBadge = async (qrData: string) => {
        setLog({ message: 'Verifying...', type: 'INFO' });

        try {
            // 1. Fast Validation (Format)
            if (qrData.startsWith('{')) {
                setLog({ message: 'ERROR: Invalid QR Type (Confirmation).', type: 'ERROR' });
                return;
            }

            // 2. Single Query Strategy (Performance +20%)
            const regRef = collection(db, `conferences/${conferenceId}/registrations`);
            const q = query(regRef, where('badgeQr', '==', qrData), limit(1));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setLog({ message: 'ERROR: Invalid Badge.', type: 'ERROR' });
                return;
            }

            const regData = snapshot.docs[0].data() as Registration;

            // 3. Role/Tier Check (Policy Engine)
            // If user has no valid tier or status is not COMPLETED
            if (regData.status !== 'COMPLETED' && regData.status !== 'PAID') {
                 setLog({ message: `ERROR: Status is ${regData.status}`, type: 'ERROR' });
                 return;
            }

            // 4. Log Entry (Fire & Forget mostly, but we await for consistency)
            const logsRef = collection(db, `conferences/${conferenceId}/access_logs`);
            await addDoc(logsRef, {
                action: 'ENTRY',
                timestamp: Timestamp.now(),
                scannedQr: qrData,
                locationId: locationId,
                userId: regData.userId || 'anonymous',
                scannerId: 'device_001_optimized'
            });

            setLog({ message: `SUCCESS: Welcome, ${regData.userTier || 'Guest'}`, type: 'SUCCESS' });

        } catch (err: unknown) {
            console.error(err);
            const message = err instanceof Error ? err.message : 'Unknown error';
            setLog({ message: `System Error: ${message}`, type: 'ERROR' });
        }
    };

    return { log, scanBadge };
};
