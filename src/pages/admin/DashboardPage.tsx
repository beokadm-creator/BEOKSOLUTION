import React, { useEffect, useState } from 'react';
import { useAdminStore } from '../../store/adminStore';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import DataWidget from '../../components/eregi/DataWidget';
import { Users, CreditCard, Ticket, AlertCircle, Download, Loader2 } from 'lucide-react';
import { collection, query, getDocs, doc, getDoc, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { safeText } from '../../utils/safeText';
import { Button } from '../../components/ui/button';
import * as XLSX from 'xlsx';

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
                        const aTime = (a.createdAt as any)?.toMillis?.() || (a.createdAt as any)?.seconds * 1000 || 0;
                        const bTime = (b.createdAt as any)?.toMillis?.() || (b.createdAt as any)?.seconds * 1000 || 0;
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

    const [isExporting, setIsExporting] = useState(false);

    const handleExportReport = async () => {
        if (!selectedConferenceId) return;
        setIsExporting(true);
        try {
            // 1. Fetch attendance rules
            const rulesRef = doc(db, `conferences/${selectedConferenceId}/settings/attendance`);
            const rulesSnap = await getDoc(rulesRef);
            let globalGoal = 0;
            let completionMode = 'DAILY_SEPARATE';
            let cumulativeGoalMinutes = 0;
            if (rulesSnap.exists()) {
                const rulesData = rulesSnap.data().rules || {};
                const dates = Object.keys(rulesData).sort();
                if (dates.length > 0) {
                    const firstRule = rulesData[dates[0]];
                    globalGoal = firstRule.globalGoalMinutes || 0;
                    completionMode = firstRule.completionMode || 'DAILY_SEPARATE';
                    cumulativeGoalMinutes = firstRule.cumulativeGoalMinutes || 0;
                }
            }
            const goal = completionMode === 'CUMULATIVE' && cumulativeGoalMinutes > 0 ? cumulativeGoalMinutes : globalGoal;

            // 2. Fetch Access Logs for first entry / last exit
            const accessLogsRef = collection(db, `conferences/${selectedConferenceId}/access_logs`);
            const accessLogsSnap = await getDocs(accessLogsRef);
            const userTimes: Record<string, { firstEntryTime?: number, lastExitTime?: number }> = {};
            accessLogsSnap.forEach(d => {
                const data = d.data();
                const logTime = (data.timestamp?.toMillis?.()) || (data.timestamp?.seconds ? data.timestamp.seconds * 1000 : null) || (data.timestamp instanceof Date ? data.timestamp.getTime() : (data.timestamp ? new Date(data.timestamp).getTime() : null));
                const id = data.registrationId || data.scannedQr;
                if (!id || !logTime) return;

                if (!userTimes[id]) userTimes[id] = {};
                if (data.action === 'ENTRY') {
                    if (!userTimes[id].firstEntryTime || logTime < userTimes[id].firstEntryTime!) {
                        userTimes[id].firstEntryTime = logTime;
                    }
                } else if (data.action === 'EXIT') {
                    if (!userTimes[id].lastExitTime || logTime > userTimes[id].lastExitTime!) {
                        userTimes[id].lastExitTime = logTime;
                    }
                }
            });

            // 3. Fetch Registrations
            const regRef = collection(db, `conferences/${selectedConferenceId}/registrations`);
            const regQuery = query(regRef, where('paymentStatus', '==', 'PAID'));
            const regSnap = await getDocs(regQuery);
            const regs = regSnap.docs.map(d => {
                const data = d.data();
                const times = userTimes[d.id] || (data.badgeQr && userTimes[data.badgeQr]) || {};
                const totalMinutes = typeof data.totalMinutes === 'number' ? data.totalMinutes : 0;
                let isCompliant = !!data.isCompleted;
                if (completionMode !== 'CUMULATIVE' && goal > 0) {
                    isCompliant = totalMinutes >= goal;
                }
                return {
                    '이름': data.userName || data.name || data.userInfo?.name || 'Unknown',
                    '전화번호': data.phone || data.mobile || data.userInfo?.phone || data.userInfo?.mobile || '',
                    '이메일': data.userEmail || data.email || data.userInfo?.email || '',
                    '면허번호': data.licenseNumber || data.license || data.userInfo?.licenseNumber || data.userInfo?.license || '',
                    '소속': data.affiliation || data.organization || data.userOrg || data.userInfo?.affiliation || '',
                    '회원등급': data.memberGrade || data.tier || data.userTier || data.grade || data.categoryName || data.userInfo?.grade || data.userInfo?.memberGrade || '',
                    '구분': '내부등록',
                    '결제금액': Number(data.amount) || Number(data.paymentAmount) || 0,
                    '최초입장시간': times.firstEntryTime,
                    '마지막 퇴장시간': times.lastExitTime,
                    '현재 상태': data.attendanceStatus === 'INSIDE' ? '입장 중' : '퇴장',
                    '수강인정시간(분)': totalMinutes,
                    '수강완료표기': isCompliant ? 'Y' : 'N'
                };
            });

            // 4. Fetch External Attendees
            const extRef = collection(db, `conferences/${selectedConferenceId}/external_attendees`);
            const extQuery = query(extRef, where('deleted', '==', false));
            const extSnap = await getDocs(extQuery);
            const exts = extSnap.docs.map(d => {
                const data = d.data();
                const times = userTimes[d.id] || (data.badgeQr && userTimes[data.badgeQr]) || {};
                const totalMinutes = typeof data.totalMinutes === 'number' ? data.totalMinutes : 0;
                let isCompliant = !!data.isCompleted;
                if (completionMode !== 'CUMULATIVE' && goal > 0) {
                    isCompliant = totalMinutes >= goal;
                }
                return {
                    '이름': data.name || 'Unknown',
                    '전화번호': data.phone || data.mobile || '',
                    '이메일': data.email || '',
                    '면허번호': data.licenseNumber || data.license || '',
                    '소속': data.organization || data.affiliation || '',
                    '회원등급': data.memberGrade || data.tier || data.userTier || data.grade || data.categoryName || '비회원 (외부)',
                    '구분': '외부등록',
                    '결제금액': Number(data.amount) || 0,
                    '최초입장시간': times.firstEntryTime,
                    '마지막 퇴장시간': times.lastExitTime,
                    '현재 상태': data.attendanceStatus === 'INSIDE' ? '입장 중' : '퇴장',
                    '수강인정시간(분)': totalMinutes,
                    '수강완료표기': isCompliant ? 'Y' : 'N'
                };
            });

            // Combine and format
            const formatTime = (ts?: number) => {
                if (!ts) return '';
                const d = new Date(ts);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            };

            const combined = [...regs, ...exts].map(r => ({
                ...r,
                '최초입장시간': formatTime(r['최초입장시간'] as number),
                '마지막 퇴장시간': formatTime(r['마지막 퇴장시간'] as number),
            }));

            const ws = XLSX.utils.json_to_sheet(combined);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");
            XLSX.writeFile(wb, `comprehensive_report_${selectedConferenceId}.xlsx`);
        } catch (error) {
            console.error("Export failed:", error);
            alert("엑셀 다운로드에 실패했습니다.");
        } finally {
            setIsExporting(false);
        }
    };

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
                <p className="text-slate-500 mt-1">Overview for <span className="font-semibold text-[#003366]">{safeText(selectedConferenceTitle) || selectedConferenceSlug}</span></p>
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
                    variant="primary"
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
                            <Button
                                onClick={handleExportReport}
                                disabled={isExporting}
                                className="w-full flex items-center justify-center gap-2 col-span-2"
                                variant="outline"
                            >
                                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                종합 보고서 다운로드 (Excel)
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
