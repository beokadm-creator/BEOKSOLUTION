import React, { useEffect, useState } from 'react';
import { getFirestore, collection, getCountFromServer } from 'firebase/firestore';
import { Users, Building, Database } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

export default function SuperAdminWidgets() {
    const [stats, setStats] = useState({ users: 0, societies: 0, conferences: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            const db = getFirestore();
            try {
                // Parallel fetching for performance
                // Note: getCountFromServer is efficient/cheap
                const [usersSnap, socSnap, confSnap] = await Promise.all([
                    getCountFromServer(collection(db, 'users')),
                    getCountFromServer(collection(db, 'societies')),
                    getCountFromServer(collection(db, 'conferences'))
                ]);

                setStats({
                    users: usersSnap.data().count,
                    societies: socSnap.data().count,
                    conferences: confSnap.data().count
                });
            } catch (e) {
                console.error("Failed to fetch super admin stats", e);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    const Widget = ({ label, count, icon: Icon, color, delay }: any) => (
        <div className={`relative overflow-hidden bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between group hover:border-${color}-500/50 transition-all duration-500`}>
            {/* Neon Glow Background */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-${color}-500/20 transition-all`}></div>

            <div className="relative z-10">
                <p className={`text-xs font-bold text-${color}-400 mb-1 uppercase tracking-widest`}>{label}</p>
                {loading ? (
                    <Skeleton className="h-8 w-16 bg-gray-800" />
                ) : (
                    <h3 className="text-3xl font-black text-white font-mono tracking-tighter animate-in fade-in slide-in-from-bottom-2 duration-700" style={{ animationDelay: `${delay}ms` }}>
                        {count.toLocaleString()}
                    </h3>
                )}
            </div>

            <div className={`w-12 h-12 rounded-xl bg-${color}-500/10 flex items-center justify-center text-${color}-400 border border-${color}-500/20 group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Widget label="Total Societies" count={stats.societies} icon={Building} color="blue" delay={0} />
            <Widget label="Active Conferences" count={stats.conferences} icon={Database} color="purple" delay={150} />
            <Widget label="Total Users" count={stats.users} icon={Users} color="emerald" delay={300} />
        </div>
    );
}
