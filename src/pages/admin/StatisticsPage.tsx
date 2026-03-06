import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAdminStore } from '../../store/adminStore';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Loader2, Download, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

// --- Types for Settings ---
interface BreakTime {
    label: string;
    start: string;
    end: string;
}

interface ZoneRule {
    id: string;
    name: string;
    start: string;
    end: string;
    goalMinutes: number;
    autoCheckout: boolean;
    breaks: BreakTime[];
    points: number;
}

interface DailyRule {
    date: string;
    globalGoalMinutes: number;
    completionMode?: 'DAILY_SEPARATE' | 'CUMULATIVE';
    cumulativeGoalMinutes?: number;
    zones: ZoneRule[];
}

// --- Participant record type (unified for registrations + external_attendees) ---
interface ParticipantRecord {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    affiliation?: string;
    badgeQr: string | null;
    badgeIssued: boolean;
    paymentStatus: string;
    totalMinutes: number;
    isCompleted: boolean;
    attendanceStatus: string;
    isExternal: boolean;
}

const StatisticsPage: React.FC = () => {
    const { selectedConferenceId } = useAdminStore();

    // Raw data
    const [participants, setParticipants] = useState<ParticipantRecord[]>([]);
    const [rules, setRules] = useState<Record<string, DailyRule>>({});
    const [dates, setDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // --- 1. Fetch Data ---
    const fetchData = useCallback(async () => {
        if (!selectedConferenceId) return;
        setLoading(true);
        try {
            // A. Fetch Attendance Settings (rules)
            const rulesRef = doc(db, `conferences/${selectedConferenceId}/settings/attendance`);
            const rulesSnap = await getDoc(rulesRef);
            if (rulesSnap.exists()) {
                const data = rulesSnap.data();
                setRules(data.rules || {});
                const availableDates = Object.keys(data.rules || {}).sort();
                setDates(availableDates);
                if (availableDates.length > 0 && !selectedDate) {
                    setSelectedDate(availableDates[0]);
                }
            }

            // B. Fetch PAID registrations (결제 완료자만)
            const regRef = collection(db, `conferences/${selectedConferenceId}/registrations`);
            const regQuery = query(regRef, where('paymentStatus', '==', 'PAID'));
            const regSnap = await getDocs(regQuery);

            const regParticipants: ParticipantRecord[] = regSnap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    userId: data.userId || d.id,
                    userName: data.userName || data.name || data.userInfo?.name || 'Unknown',
                    userEmail: data.userEmail || data.email || data.userInfo?.email || '',
                    affiliation: data.affiliation || data.organization || data.userOrg || data.userInfo?.affiliation || '',
                    badgeQr: data.badgeQr || null,
                    badgeIssued: !!data.badgeIssued,
                    paymentStatus: data.paymentStatus || '',
                    totalMinutes: typeof data.totalMinutes === 'number' ? data.totalMinutes : 0,
                    isCompleted: !!data.isCompleted,
                    attendanceStatus: data.attendanceStatus || 'OUTSIDE',
                    isExternal: false,
                };
            });

            // C. Fetch External Attendees (not deleted)
            const extRef = collection(db, `conferences/${selectedConferenceId}/external_attendees`);
            const extQuery = query(extRef, where('deleted', '==', false));
            const extSnap = await getDocs(extQuery);

            const extParticipants: ParticipantRecord[] = extSnap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    userId: data.userId || data.uid || d.id,
                    userName: data.name || 'Unknown',
                    userEmail: data.email || '',
                    affiliation: data.organization || data.affiliation || '',
                    badgeQr: data.badgeQr || null,
                    badgeIssued: !!data.badgeIssued,
                    paymentStatus: data.paymentStatus || 'PAID', // external은 admin 등록이므로 PAID 처리
                    totalMinutes: typeof data.totalMinutes === 'number' ? data.totalMinutes : 0,
                    isCompleted: !!data.isCompleted,
                    attendanceStatus: data.attendanceStatus || 'OUTSIDE',
                    isExternal: true,
                };
            });

            setParticipants([...regParticipants, ...extParticipants]);

        } catch (error) {
            console.error("Failed to fetch stats data:", error);
        } finally {
            setLoading(false);
        }
    }, [selectedConferenceId, selectedDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- 2. Process Data ---
    // [핵심 수정] StatisticsPage는 이제 access_logs 루트 컬렉션이 아닌,
    // 각 등록자 문서의 totalMinutes, isCompleted 필드를 직접 읽습니다.
    // 이 필드들은 AttendanceScannerPage / AttendanceLivePage의 performCheckOut 시
    // 실시간으로 업데이트됩니다.
    const stats = useMemo(() => {
        if (!selectedDate || !rules[selectedDate] || participants.length === 0) return null;

        const currentRule = rules[selectedDate];
        const globalGoal = currentRule.globalGoalMinutes;

        // userStats는 badgeQr이 있는 사람만 (명찰 발급된 참가자)
        const badgedParticipants = participants.filter(p => !!p.badgeQr && p.badgeIssued);

        // 전체 등록 완료자 = PAID 결제 완료자 전체 (명찰 발급 여부 무관)
        const totalRegistered = participants.length;

        // 명찰 발급 완료자
        const totalBadgeIssued = participants.filter(p => p.badgeIssued).length;

        // 수강 입장 경험이 있는 사람 (totalMinutes > 0 또는 attendanceStatus === INSIDE)
        const activeUsers = badgedParticipants.filter(
            p => p.totalMinutes > 0 || p.attendanceStatus === 'INSIDE'
        ).length;

        // 수강 완료자 판정
        // CUMULATIVE 모드: isCompleted 필드를 직접 사용 (서버/스캐너가 업데이트)
        // DAILY_SEPARATE 모드: totalMinutes >= globalGoalMinutes
        const userStatsList = badgedParticipants.map(p => {
            let isCompliant: boolean;
            if (currentRule.completionMode === 'CUMULATIVE') {
                isCompliant = p.isCompleted;
            } else {
                isCompliant = p.totalMinutes >= globalGoal;
            }

            // Zone별 시간 분배 (등록자 totalMinutes를 zone 수에 비례하여 추정 — 단순 통계용)
            // 실제 zone별 정밀 통계는 access_logs 기반 분석 필요
            const zones: Record<string, number> = {};
            if (currentRule.zones.length > 0) {
                const perZone = Math.floor(p.totalMinutes / currentRule.zones.length);
                currentRule.zones.forEach(z => {
                    zones[z.id] = perZone;
                });
            }

            return {
                userId: p.userId,
                userName: p.userName,
                userEmail: p.userEmail,
                affiliation: p.affiliation,
                badgeQr: p.badgeQr,
                isExternal: p.isExternal,
                totalMinutes: p.totalMinutes,
                attendanceStatus: p.attendanceStatus,
                zones,
                isCompliant,
                logCount: 0, // 서브컬렉션 fetch 없이 표시
            };
        });

        const compliantUsers = userStatsList.filter(u => u.isCompliant).length;
        const noShowUsers = badgedParticipants.filter(p => p.totalMinutes === 0 && p.attendanceStatus !== 'INSIDE').length;
        const incompleteUsers = Math.max(0, activeUsers - compliantUsers);

        // complianceRate: 명찰 발급자 기준
        const complianceRate = totalBadgeIssued > 0 ? (compliantUsers / totalBadgeIssued) * 100 : 0;

        const avgStayTime = activeUsers > 0
            ? badgedParticipants
                .filter(p => p.totalMinutes > 0)
                .reduce((acc, p) => acc + p.totalMinutes, 0) / activeUsers
            : 0;

        // Zone 통계 (전체 totalMinutes 기반 근사치)
        const zoneStats = currentRule.zones.map(z => {
            const visitedUsers = badgedParticipants.filter(p => p.totalMinutes > 0).length;
            const avgTime = visitedUsers > 0
                ? badgedParticipants.reduce((acc, p) => acc + Math.floor(p.totalMinutes / (currentRule.zones.length || 1)), 0) / (visitedUsers || 1)
                : 0;
            return {
                ...z,
                visitedUsers,
                avgTime
            };
        });

        return {
            userStatsList,
            totalRegistered,      // 결제 완료 전체 등록자
            totalBadgeIssued,     // 명찰 발급 완료자
            activeUsers,          // 수강 입장 경험자
            compliantUsers,       // 수강 완료자
            incompleteUsers,
            noShowUsers,
            complianceRate,
            avgStayTime,
            zoneStats,
            globalGoal,
        };

    }, [selectedDate, rules, participants]);

    const handleExportExcel = () => {
        if (!stats) return;

        try {
            const data = stats.userStatsList.map(u => ({
                Name: u.userName,
                Email: u.userEmail,
                Affiliation: u.affiliation || '',
                Type: u.isExternal ? 'External' : 'Registered',
                'Attendance Status': u.attendanceStatus,
                'Total Time (min)': u.totalMinutes,
                'Is Compliant': u.isCompliant ? 'Yes' : 'No',
                ...rules[selectedDate].zones.reduce((acc, z) => ({
                    ...acc,
                    [`${z.name} (min)`]: u.zones[z.id] || 0
                }), {})
            }));

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Attendance Stats");
            XLSX.writeFile(wb, `attendance_stats_${selectedDate}.xlsx`);
        } catch (error) {
            console.error('Excel export failed:', error);
            alert('엑셀 익스포트 중 오류가 발생했습니다. 다시 시도해 주세요.');
        }
    };

    if (loading) return <div className="flex h-screen justify-center items-center"><Loader2 className="animate-spin w-10 h-10 text-blue-500" /></div>;

    if (!selectedDate || !rules[selectedDate]) return (
        <div className="p-8 text-center">
            <h2 className="text-xl font-bold mb-2">No Attendance Rules Found</h2>
            <p className="text-gray-500">Please configure attendance settings for this conference first.</p>
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Statistics Dashboard</h1>
                    <p className="text-gray-500 mt-2">Real-time attendance tracking and analytics.</p>
                </div>
                <div className="flex gap-4">
                    <Select value={selectedDate} onValueChange={setSelectedDate}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select Date" />
                        </SelectTrigger>
                        <SelectContent>
                            {dates.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={handleExportExcel} className="gap-2">
                        <Download className="w-4 h-4" /> Export Excel
                    </Button>
                </div>
            </div>

            {stats && (
                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="zones">Zone Analysis</TabsTrigger>
                        <TabsTrigger value="users">User Details</TabsTrigger>
                    </TabsList>

                    {/* 1. OVERVIEW TAB */}
                    <TabsContent value="overview" className="space-y-6">
                        {/* 상단 카드 — 5개 핵심 지표 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-500">Total Registrations</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats.totalRegistered}</div>
                                    <p className="text-xs text-gray-400 mt-1">결제 완료 등록자</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-500">Badge Issued</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats.totalBadgeIssued}</div>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {stats.totalRegistered > 0
                                            ? `${((stats.totalBadgeIssued / stats.totalRegistered) * 100).toFixed(1)}% 발급률`
                                            : '—'}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-500">Active (입장)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats.activeUsers}</div>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {stats.totalBadgeIssued > 0
                                            ? `${((stats.activeUsers / stats.totalBadgeIssued) * 100).toFixed(1)}% 참석률`
                                            : '—'}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-500">Compliance Rate</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats.complianceRate.toFixed(1)}%</div>
                                    <p className="text-xs text-gray-400 mt-1">{stats.compliantUsers}명 수강 완료</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-500">Avg. Stay Time</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{Math.round(stats.avgStayTime)} min</div>
                                    <p className="text-xs text-gray-400 mt-1">Target: {stats.globalGoal} min</p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Completion Status</CardTitle>
                                    <CardDescription>명찰 발급자({stats.totalBadgeIssued}명) 기준</CardDescription>
                                </CardHeader>
                                <CardContent className="h-[300px] flex justify-center items-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: '수강 완료', value: stats.compliantUsers },
                                                    { name: '수강 진행 중', value: stats.incompleteUsers },
                                                    { name: '미입장', value: stats.noShowUsers },
                                                    { name: '미발급', value: Math.max(0, stats.totalRegistered - stats.totalBadgeIssued) },
                                                ].filter(d => d.value > 0)}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                                label={({ name, value }) => `${name}: ${value}`}
                                            >
                                                <Cell fill="#00C49F" />
                                                <Cell fill="#FFBB28" />
                                                <Cell fill="#E5E7EB" />
                                                <Cell fill="#93C5FD" />
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>등록 현황 요약</CardTitle>
                                    <CardDescription>전체 프로세스 진행 현황</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-4">
                                    {[
                                        { label: '결제 완료 (등록)', value: stats.totalRegistered, color: 'bg-blue-500' },
                                        { label: '명찰 발급', value: stats.totalBadgeIssued, color: 'bg-indigo-500' },
                                        { label: '수강 입장', value: stats.activeUsers, color: 'bg-purple-500' },
                                        { label: '수강 완료', value: stats.compliantUsers, color: 'bg-green-500' },
                                    ].map(item => (
                                        <div key={item.label} className="space-y-1">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">{item.label}</span>
                                                <span className="font-bold">{item.value}명</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2">
                                                <div
                                                    className={`${item.color} h-2 rounded-full transition-all`}
                                                    style={{ width: stats.totalRegistered > 0 ? `${(item.value / stats.totalRegistered) * 100}%` : '0%' }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* 2. ZONES TAB */}
                    <TabsContent value="zones" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {stats.zoneStats.map((zone) => (
                                <Card key={zone.id}>
                                    <CardHeader>
                                        <CardTitle className="text-lg">{zone.name}</CardTitle>
                                        <CardDescription>{zone.start} - {zone.end}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-500">입장자</span>
                                            <span className="font-bold">{zone.visitedUsers}명</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-500">평균 체류</span>
                                            <span className="font-bold">{Math.round(zone.avgTime)} min</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-500">목표</span>
                                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                                {zone.goalMinutes > 0 ? `${zone.goalMinutes}분` : `${stats.globalGoal}분 (전체)`}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-500">휴게</span>
                                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">{zone.breaks.length}개 설정</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Zone Comparison</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.zoneStats}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="visitedUsers" fill="#8884d8" name="입장자 수" />
                                        <Bar dataKey="avgTime" fill="#82ca9d" name="평균 체류시간 (min)" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* 3. USERS TAB */}
                    <TabsContent value="users">
                        <Card>
                            <CardHeader>
                                <CardTitle>User Details</CardTitle>
                                <CardDescription>
                                    명찰 발급 완료자 {stats.totalBadgeIssued}명 기준 개인별 출결 현황
                                    (총 등록자 {stats.totalRegistered}명 중)
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>이름</TableHead>
                                            <TableHead>소속</TableHead>
                                            <TableHead>구분</TableHead>
                                            <TableHead>입장 상태</TableHead>
                                            <TableHead>수강 상태</TableHead>
                                            <TableHead className="text-right">누적 시간</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {stats.userStatsList
                                            .sort((a, b) => b.totalMinutes - a.totalMinutes)
                                            .map((user) => (
                                                <TableRow key={user.userId}>
                                                    <TableCell className="font-medium">{user.userName}</TableCell>
                                                    <TableCell className="text-sm text-gray-500">{user.affiliation || '—'}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={user.isExternal ? 'text-purple-600 border-purple-200' : 'text-blue-600 border-blue-200'}>
                                                            {user.isExternal ? '외부' : '등록'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={user.attendanceStatus === 'INSIDE' ? 'default' : 'secondary'}
                                                            className={user.attendanceStatus === 'INSIDE'
                                                                ? 'bg-green-500 hover:bg-green-600 animate-pulse'
                                                                : 'text-gray-500'}>
                                                            {user.attendanceStatus === 'INSIDE' ? '입장 중' : '퇴장'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {user.isCompliant ? (
                                                            <Badge className="bg-green-500 hover:bg-green-600">
                                                                <CheckCircle className="w-3 h-3 mr-1" /> 수강 완료
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-gray-500">
                                                                {user.totalMinutes > 0 ? '수강 중' : '미입장'}
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-lg">
                                                        {Math.floor(user.totalMinutes)}m
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
};

export default StatisticsPage;
