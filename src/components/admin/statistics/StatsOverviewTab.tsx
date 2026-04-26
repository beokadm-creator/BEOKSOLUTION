import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { StatisticsData } from '@/hooks/useStatistics';

interface StatsOverviewTabProps {
    stats: StatisticsData;
}

export const StatsOverviewTab: React.FC<StatsOverviewTabProps> = ({ stats }) => {
    return (
        <div className="space-y-6">
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
                        <p className="text-xs text-gray-400 mt-1">
                            Target: {stats.goalMinutes} min ({stats.completionMode === 'CUMULATIVE' ? '누적' : '일일'})
                        </p>
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
        </div>
    );
};
