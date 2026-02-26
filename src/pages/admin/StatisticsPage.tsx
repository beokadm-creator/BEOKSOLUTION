import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAdminStore } from '../../store/adminStore';
import { useRegistrations } from '../../hooks/useRegistrations';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { calculateStayTime } from '../../utils/attendance';
import { AccessLog } from '../../types/schema';
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

const StatisticsPage: React.FC = () => {
    const { selectedConferenceId } = useAdminStore();
    const { registrations, loading: regLoading } = useRegistrations(selectedConferenceId || '');

    const [logs, setLogs] = useState<AccessLog[]>([]);
    const [rules, setRules] = useState<Record<string, DailyRule>>({});
    const [dates, setDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // --- 1. Fetch Data (Settings & Logs) ---
    const fetchData = useCallback(async () => {
        if (!selectedConferenceId) return;
        setLoading(true);
        try {
            // A. Fetch Settings
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

            // B. Fetch All Access Logs (Optimize in Prod: Query by date range if possible)
            // Since AccessLog doesn't strictly enforce date field, we filter in memory for now.
            const logsRef = collection(db, `conferences/${selectedConferenceId}/access_logs`);
            const logsSnap = await getDocs(logsRef);
            const fetchedLogs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() } as AccessLog));
            setLogs(fetchedLogs);

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
    const stats = useMemo(() => {
        if (!selectedDate || !rules[selectedDate]) return null;

        const currentRule = rules[selectedDate];
        const globalGoal = currentRule.globalGoalMinutes;

        // Filter logs for the selected date
        // Note: AccessLog timestamp is UTC. Convert to KST for date matching.
        const dayStartKST = new Date(`${selectedDate}T00:00:00+09:00`);
        const dayEndKST = new Date(`${selectedDate}T23:59:59+09:00`);
        const now = new Date();
        const effectiveSessionEnd = new Date(Math.min(now.getTime(), dayEndKST.getTime()));

        const dayLogs = logs.filter(log => {
            const t = log.timestamp.toDate();
            return t >= dayStartKST && t <= dayEndKST;
        });

        // Group logs by User (badgeQr) and Zone (locationId)
        const userStats: Record<string, {
            userId: string;
            userName: string;
            zones: Record<string, number>; // zoneId -> minutes
            totalMinutes: number;
            isCompliant: boolean;
            logs: AccessLog[];
        }> = {};

        registrations.forEach(reg => {
            if (!reg.badgeQr) return; // Skip if no badge
            userStats[reg.badgeQr] = {
                userId: reg.userId,
                userName: reg.userName || 'Unknown',
                zones: {},
                totalMinutes: 0,
                isCompliant: false,
                logs: []
            };
        });

        // Distribute logs to users
        dayLogs.forEach(log => {
            if (userStats[log.scannedQr]) {
                userStats[log.scannedQr].logs.push(log);
            }
        });

        // Calculate Times
        Object.values(userStats).forEach(stat => {
            // Group logs by zone
            const zoneLogs: Record<string, AccessLog[]> = {};
            stat.logs.forEach(l => {
                const zoneId = l.locationId || 'default';
                if (!zoneLogs[zoneId]) zoneLogs[zoneId] = [];
                zoneLogs[zoneId].push(l);
            });

            let total = 0;
            currentRule.zones.forEach(zone => {
                const zLogs = zoneLogs[zone.id];
                if (zLogs) {
                    const minutes = calculateStayTime(zLogs, zone.breaks, effectiveSessionEnd);
                    stat.zones[zone.id] = minutes;
                    total += minutes;
                }
            });

            // Handle logs without explicit zone (or unknown zone)
            // If there are logs with locationId not in currentRule.zones, we might need a fallback.
            // For now, ignore unknown zones or treat as no-break?
            // Let's assume strict zone matching for now.

            stat.totalMinutes = total;

            const reg = registrations.find(r => r.userId === stat.userId);
            if (currentRule.completionMode === 'CUMULATIVE') {
                stat.isCompliant = (reg as any)?.isCompleted || false;
            } else {
                stat.isCompliant = total >= globalGoal;
            }
        });

        // Aggregates
        const totalUsers = registrations.length;
        const activeUsers = Object.values(userStats).filter(u => u.totalMinutes > 0).length;

        // [Fixed] Count compliant users correctly based on the updated logic evaluating goal vs exact minutes
        const compliantUsers = Object.values(userStats).filter(u => u.isCompliant).length;

        const complianceRate = totalUsers > 0 ? (compliantUsers / totalUsers) * 100 : 0;
        const avgStayTime = activeUsers > 0
            ? Object.values(userStats).reduce((acc, u) => acc + u.totalMinutes, 0) / activeUsers
            : 0;

        // Zone Stats
        const zoneStats = currentRule.zones.map(z => {
            const visitedUsers = Object.values(userStats).filter(u => (u.zones[z.id] || 0) > 0).length;
            const avgTime = visitedUsers > 0
                ? Object.values(userStats).reduce((acc, u) => acc + (u.zones[z.id] || 0), 0) / visitedUsers
                : 0;
            return {
                ...z,
                visitedUsers,
                avgTime
            };
        });

        // Pie chart data (fix: prevent negative values)
        const incompleteUsers = Math.max(0, activeUsers - compliantUsers);

        return {
            userStats: Object.values(userStats),
            totalUsers,
            activeUsers,
            compliantUsers,
            incompleteUsers,
            complianceRate,
            avgStayTime,
            zoneStats,
            globalGoal
        };

    }, [selectedDate, rules, logs, registrations]);

    const handleExportExcel = () => {
        if (!stats) return;

        try {
            const data = stats.userStats.map(u => ({
                Name: u.userName,
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

    if (loading || regLoading) return <div className="flex h-screen justify-center items-center"><Loader2 className="animate-spin w-10 h-10 text-blue-500" /></div>;

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
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-500">Total Registrations</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats.totalUsers}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-500">Active Today</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats.activeUsers}</div>
                                    <p className="text-xs text-gray-500">{((stats.activeUsers / stats.totalUsers) * 100).toFixed(1)}% participation</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-500">Compliance Rate</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats.complianceRate.toFixed(1)}%</div>
                                    <p className="text-xs text-gray-500">{stats.compliantUsers} completed</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-500">Avg. Stay Time</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{Math.round(stats.avgStayTime)} min</div>
                                    <p className="text-xs text-gray-500">Target: {stats.globalGoal} min</p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Completion Status</CardTitle>
                                </CardHeader>
                                <CardContent className="h-[300px] flex justify-center items-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: 'Completed', value: stats.compliantUsers },
                                                    { name: 'Incomplete', value: stats.incompleteUsers },
                                                    { name: 'No Show', value: stats.totalUsers - stats.activeUsers }
                                                ]}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                fill="#8884d8"
                                                paddingAngle={5}
                                                dataKey="value"
                                                label
                                            >
                                                <Cell fill="#00C49F" />
                                                <Cell fill="#FFBB28" />
                                                <Cell fill="#E5E7EB" />
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Hourly Traffic (Estimate)</CardTitle>
                                    <CardDescription>Based on entry times</CardDescription>
                                </CardHeader>
                                <CardContent className="h-[300px]">
                                    {/* Placeholder for Hourly Chart - complex to calc perfectly from intervals */}
                                    <div className="flex items-center justify-center h-full text-gray-400">
                                        Hourly Traffic Chart Coming Soon
                                    </div>
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
                                            <span className="text-sm text-gray-500">Visitors</span>
                                            <span className="font-bold">{zone.visitedUsers}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-500">Avg. Time</span>
                                            <span className="font-bold">{Math.round(zone.avgTime)} min</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-500">Breaks</span>
                                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">{zone.breaks.length} defined</span>
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
                                        <Bar dataKey="visitedUsers" fill="#8884d8" name="Visitors" />
                                        <Bar dataKey="avgTime" fill="#82ca9d" name="Avg Time (min)" />
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
                                <CardDescription>Individual attendance records</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Total Time</TableHead>
                                            {stats.zoneStats.map(z => (
                                                <TableHead key={z.id} className="text-right hidden md:table-cell">{z.name}</TableHead>
                                            ))}
                                            <TableHead className="text-center">Details</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {stats.userStats
                                            .sort((a, b) => b.totalMinutes - a.totalMinutes)
                                            .map((user) => (
                                                <TableRow key={user.userId}>
                                                    <TableCell className="font-medium">{user.userName}</TableCell>
                                                    <TableCell>
                                                        {user.isCompliant ? (
                                                            <Badge className="bg-green-500 hover:bg-green-600">
                                                                <CheckCircle className="w-3 h-3 mr-1" /> Completed
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-gray-500">
                                                                Incomplete
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-lg">
                                                        {Math.floor(user.totalMinutes)}m
                                                    </TableCell>
                                                    {stats.zoneStats.map(z => (
                                                        <TableCell key={z.id} className="text-right hidden md:table-cell">
                                                            {Math.floor(user.zones[z.id] || 0)}m
                                                        </TableCell>
                                                    ))}
                                                    <TableCell className="text-center">
                                                        {/* Expandable details could go here */}
                                                        <span className="text-xs text-gray-400">{user.logs.length} logs</span>
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
