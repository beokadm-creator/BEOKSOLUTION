import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Registration, ConferenceUser, AccessLog } from '../types/schema';
import { calculateStayTime } from '../utils/attendance';
import { logger } from '../utils/logger';

export interface MyPageData {
    user: ConferenceUser | null;
    registration: Registration | null;
    history: string[]; // List of other conference IDs
    stayTimeMinutes: number;
    canPrintCertificate: boolean;
}

export const useMyPage = (conferenceId: string, userId: string) => {
    const [data, setData] = useState<MyPageData>({ 
        user: null, 
        registration: null, 
        history: [], 
        stayTimeMinutes: 0,
        canPrintCertificate: false
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!conferenceId || !userId) {
                setLoading(false);
                return;
            }

            try {
                // 1. Fetch User Profile
                const userRef = doc(db, `conferences/${conferenceId}/users/${userId}`);
                const userSnap = await getDoc(userRef);
                const user = userSnap.exists() ? (userSnap.data() as ConferenceUser) : null;

                // 2. Fetch Registration
                const regRef = collection(db, `conferences/${conferenceId}/registrations`);
                const q = query(regRef, where('userId', '==', userId));
                const regSnap = await getDocs(q);
                const registration = !regSnap.empty ? (regSnap.docs[0].data() as Registration) : null;

                // 3. Fetch Access Logs
                const logRef = collection(db, `conferences/${conferenceId}/access_logs`);
                const logQ = query(logRef, where('userId', '==', userId));
                const logSnap = await getDocs(logQ);
                const logs = logSnap.docs.map(d => d.data() as AccessLog);

                // 4. Calculate Stay Time
                // Assuming session end is today 18:00 for simplicity or fetch from info
                const todayEnd = new Date();
                todayEnd.setHours(18, 0, 0, 0);
                const minutes = calculateStayTime(logs, [], todayEnd);

                // 5. Criteria (Mock: > 60 mins)
                const canPrint = minutes >= 60;

                // 6. Global History (Mock)
                const history: string[] = [];

                setData({ user, registration, history, stayTimeMinutes: minutes, canPrintCertificate: canPrint });
            } catch (e: any) {
                logger.error('useMyPage', 'Fetch error', e);
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [conferenceId, userId]);

    return { data, loading, error };
};
