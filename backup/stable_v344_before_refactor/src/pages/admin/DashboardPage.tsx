import React, { useEffect, useState } from 'react';
import { useAdminStore } from '../../store/adminStore';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Users, CreditCard, Ticket, AlertCircle } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { safeText } from '../../utils/safeText';

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
            
            // This is a placeholder for real stats fetching logic
            // In a real app, you might want to use aggregation queries or maintain counters
            try {
                const q = query(
                    collection(db, 'registrations'), 
                    where('conferenceId', '==', selectedConferenceId)
                );
                const snapshot = await getDocs(q);
                
                let total = 0;
                let pending = 0;
                let completed = 0;
                let revenue = 0;

                snapshot.forEach(doc => {
                    const data = doc.data();
                    total++;
                    if (data.paymentStatus === 'COMPLETED') {
                        completed++;
                        revenue += (data.paymentAmount || 0);
                    } else {
                        pending++;
                    }
                });

                setStats({
                    totalRegistrations: total,
                    pendingPayments: pending,
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
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Registrations</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalRegistrations}</div>
                        <p className="text-xs text-muted-foreground">All time</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completed Payments</CardTitle>
                        <Ticket className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.completedPayments}</div>
                        <p className="text-xs text-muted-foreground">Paid attendees</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pendingPayments}</div>
                        <p className="text-xs text-muted-foreground">Awaiting payment</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₩{stats.totalRevenue.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Gross revenue</p>
                    </CardContent>
                </Card>
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
