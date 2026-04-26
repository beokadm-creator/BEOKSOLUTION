import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { StatisticsData, ZoneStat } from '@/hooks/useStatistics';

interface StatsZonesTabProps {
    stats: StatisticsData;
}

const ZoneCard: React.FC<{ zone: ZoneStat; goalMinutes: number; completionMode: string }> = ({ zone, goalMinutes, completionMode }) => (
    <Card>
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
                    {zone.goalMinutes > 0 ? `${zone.goalMinutes}분` : `${goalMinutes}분 (${completionMode === 'CUMULATIVE' ? '누적' : '일일'})`}
                </span>
            </div>
            <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">휴게</span>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">{zone.breaks.length}개 설정</span>
            </div>
        </CardContent>
    </Card>
);

export const StatsZonesTab: React.FC<StatsZonesTabProps> = ({ stats }) => {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.zoneStats.map((zone) => (
                    <ZoneCard
                        key={zone.id}
                        zone={zone}
                        goalMinutes={stats.goalMinutes}
                        completionMode={stats.completionMode}
                    />
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
        </div>
    );
};
