import { useState, useEffect } from 'react';
import { getDoc, doc, query, where, getDocs, collection, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { RegistrationPeriod, ConferenceUser, RegistrationSettings } from '../types/schema';
import toast from 'react-hot-toast';

export const useRegistration = (conferenceId: string, _user: ConferenceUser | null) => {
    const [availablePeriods, setAvailablePeriods] = useState<RegistrationPeriod[]>([]);

    useEffect(() => {
        const fetchPeriods = async () => {
            if (!conferenceId) return;
            try {
                const ref = doc(db, `conferences/${conferenceId}/settings/registration`);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data() as RegistrationSettings;
                    // Filter active periods
                    const now = Timestamp.now();
                    const active = data.periods.filter(p =>
                        p.startDate <= now && p.endDate >= now
                    );
                    setAvailablePeriods(active);
                }
            } catch (e) {
                console.error("Failed to fetch periods", e);
            }
        };
        fetchPeriods();
    }, [conferenceId]);

    const resumeRegistration = async (userId: string): Promise<Record<string, unknown> | null> => {
        if (!conferenceId || !userId) return null;

        try {
            const q = query(
                collection(db, `conferences/${conferenceId}/registrations`),
                where('userId', '==', userId),
                where('status', '==', 'PENDING')
            );
            const snap = await getDocs(q);

            if (!snap.empty) {
                // Get most recent
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                docs.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
                    const aTime = (a.updatedAt as { seconds: number })?.seconds || 0;
                    const bTime = (b.updatedAt as { seconds: number })?.seconds || 0;
                    return bTime - aTime;
                });

                const pending = docs[0];
                toast("작성 중인 신청서를 불러왔습니다.");
                return pending;
            }
        } catch (e) {
            console.error("Resume Error:", e);
        }
        return null;
    };

    return {
        availablePeriods,
        resumeRegistration
    };
};
