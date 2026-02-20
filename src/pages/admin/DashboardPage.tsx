import React, { useEffect, useState } from 'react';
import { useAdminStore } from '../../store/adminStore';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import DataWidget from '../../components/eregi/DataWidget';
import { Users, CreditCard, Ticket, AlertCircle } from 'lucide-react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { safeText } from '../../utils/safeText';

interface RegistrationData {
    id: string;
    userId?: string;
    status: string;
    amount?: number;
    createdAt?: { seconds: number; nanoseconds?: number } | Date;
    [key: string]: unknown;
}

export default function DashboardPage() {
    const { selectedConferenceId, selectedConferenceSlug, selectedConferenceTitle } = useAdminStore();
    const [stats, setStats] = useState({
        totalRegistrations: 0,
        pendingPayments: 0,
        completedPayments: 0,
        totalRevenue: 0
    });

    useEffect(() => {
        const fetchStats = async () => {
            if (!selectedConferenceId) return;

            try {
                const q = query(
                    collection(db, 'conferences', selectedConferenceId, 'registrations')
                );
                const snapshot = await getDocs(q);

                // Group by userId to handle duplicates (users who tried multiple times)
                const userRegistrations = new Map<string, RegistrationData[]>();
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const userId = data.userId;
                    if (userId) {
                        if (!userRegistrations.has(userId)) {
                            userRegistrations.set(userId, []);
                        }
                        userRegistrations.get(userId)!.push({ id: doc.id, ...data } as RegistrationData);
                    }
                });

                let completed = 0;
                let canceled = 0;
                let revenue = 0;

                // Count each user once, using their best registration
                userRegistrations.forEach((regs) => {
                    // Sort by status priority: PAID > REFUNDED > CANCELED > others
                    const sorted = regs.sort((a, b) => {
                        if (a.status === 'PAID' && b.status !== 'PAID') return -1;
                        if (a.status !== 'PAID' && b.status === 'PAID') return 1;
                        if (a.status === 'REFUNDED' && b.status !== 'REFUNDED') return -1;
                        if (a.status !== 'REFUNDED' && b.status === 'REFUNDED') return 1;
                        // If same status, newer first
                        const aTime = a.createdAt?.toMillis?.() || 0;
                        const bTime = b.createdAt?.toMillis?.() || 0;
                        return bTime - aTime;
                    });

                    const best = sorted[0];
                    if (best.status === 'PAID') {
                        completed++;
                        revenue += (best.amount || 0);
                    } else if (['CANCELED', 'REFUNDED', 'REFUND_REQUESTED'].includes(best.status)) {
                        canceled++;
                    }
                });

                setStats({
                    totalRegistrations: completed, // Fix: Exclude canceled from total count as per user feedback
                    pendingPayments: canceled,
                    completedPayments: completed,
                    totalRevenue: revenue
                });
            } catch (error) {
                console.error("Error fetching dashboard stats:", error);
            }
        };

        fetchStats();
    }, [selectedConferenceId]);

    if (!selectedConferenceId) {
        return (
            <div className="p-10 text-center">
                <AlertCircle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
                <h2 className="text-xl font-bold text-gray-800">No Conference Selected</h2>
                <p className="text-gray-600 mt-2">Please select a conference from the sidebar or return to Society HQ.</p>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Event Dashboard</h1>
                <p className="text-slate-500 mt-1">Overview for <span className="font-semibold text-blue-600">{safeText(selectedConferenceTitle) || selectedConferenceSlug}</span></p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <DataWidget
                    title="Total Registrations"
                    value={stats.totalRegistrations}
                    subValue="All time"
                    icon={Users}
                    variant="primary"
                />
                <DataWidget
                    title="Completed Payments"
                    value={stats.completedPayments}
                    subValue="Paid attendees"
                    icon={Ticket}
                    variant="success"
                />
                <DataWidget
                    title="Canceled/Refunded"
                    value={stats.pendingPayments}
                    subValue="Not active"
                    icon={AlertCircle}
                    variant="warning"
                />
                <DataWidget
                    title="Total Revenue"
                    value={`₩${stats.totalRevenue.toLocaleString()}`}
                    subValue="Gross revenue"
                    icon={CreditCard}
                />
            </div>

            {/* Quick Actions or Recent Activity could go here */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-gray-500 text-center py-8">
                            No recent activity to display.
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            {/* Add quick action buttons here if needed */}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
