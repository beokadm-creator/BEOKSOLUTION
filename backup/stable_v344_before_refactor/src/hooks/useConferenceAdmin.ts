import { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Registration } from '../types/schema';

export interface DashboardStats {
    totalRegistrants: number;
    totalRevenue: number;
    recentRegistrations: Registration[];
    dailyTrend: { date: string; count: number }[];
}

export const useConferenceAdmin = (conferenceId: string, userEmail?: string) => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(false);

    // 1. Check Admin Access
    useEffect(() => {
        const checkAccess = async () => {
            if (!conferenceId || !userEmail) {
                setLoadingAuth(false);
                return;
            }
            try {
                // Check specific conference admin
                const adminRef = doc(db, `conferences/${conferenceId}/admins/${userEmail}`);
                const adminSnap = await getDoc(adminRef);
                
                if (adminSnap.exists()) {
                    setIsAdmin(true);
                } else {
                    // Check Super Admin (Optional fallback)
                    // const superRef = doc(db, 'super_admins', userEmail); ...
                    // For now strict check
                    setIsAdmin(false);
                }
            } catch (e) {
                console.error(e);
                setIsAdmin(false);
            } finally {
                setLoadingAuth(false);
            }
        };
        checkAccess();
    }, [conferenceId, userEmail]);

    // 2. Fetch Dashboard Stats
    const fetchStats = async () => {
        if (!conferenceId) return;
        setLoadingStats(true);
        try {
            const regRef = collection(db, `conferences/${conferenceId}/registrations`);
            const snap = await getDocs(regRef);
            
            let totalRevenue = 0;
            const dailyCounts: Record<string, number> = {};
            const allRegs = snap.docs.map(d => d.data() as Registration);

            allRegs.forEach(reg => {
                if (reg.paymentStatus === 'PAID') {
                    totalRevenue += reg.amount;
                }
                
                // Daily Trend
                const date = new Date(reg.createdAt.seconds * 1000).toISOString().split('T')[0];
                dailyCounts[date] = (dailyCounts[date] || 0) + 1;
            });

            // Recent 5 (Client-side sort for simplicity or use query)
            // Using query for efficiency in real app, but here we have allRegs
            const recentRegistrations = allRegs
                .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds)
                .slice(0, 5);

            const dailyTrend = Object.keys(dailyCounts)
                .sort()
                .map(date => ({ date, count: dailyCounts[date] }));

            setStats({
                totalRegistrants: allRegs.length,
                totalRevenue,
                recentRegistrations,
                dailyTrend
            });
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingStats(false);
        }
    };

    return { isAdmin, loadingAuth, stats, loadingStats, fetchStats };
};
