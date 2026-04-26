import React from 'react';
import { useParams } from 'react-router-dom';
import { useAdminStore } from '../../store/adminStore';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Loader2, Download } from 'lucide-react';
import { useStatistics } from '../../hooks/useStatistics';
import { StatsOverviewTab } from '../../components/admin/statistics/StatsOverviewTab';
import { StatsZonesTab } from '../../components/admin/statistics/StatsZonesTab';
import { StatsUsersTab } from '../../components/admin/statistics/StatsUsersTab';

const StatisticsPage: React.FC = () => {
    const { cid } = useParams<{ cid: string }>();
    const { selectedConferenceId } = useAdminStore();
    const confId = cid || selectedConferenceId;

    const {
        loading,
        dates,
        selectedDate,
        setSelectedDate,
        stats,
        currentRuleForRender,
        handleExportExcel,
    } = useStatistics(confId);

    if (loading) return <div className="flex h-[50vh] justify-center items-center"><Loader2 className="animate-spin w-10 h-10 text-blue-500" /></div>;

    if (!selectedDate) return (
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

                    <TabsContent value="overview">
                        <StatsOverviewTab stats={stats} />
                    </TabsContent>

                    <TabsContent value="zones">
                        <StatsZonesTab stats={stats} />
                    </TabsContent>

                    <TabsContent value="users">
                        <StatsUsersTab stats={stats} currentRuleForRender={currentRuleForRender} />
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
};

export default StatisticsPage;
