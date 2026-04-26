import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StatisticsData, UserStat, ZoneRule } from '@/hooks/useStatistics';

interface StatsUsersTabProps {
    stats: StatisticsData;
    currentRuleForRender: { zones: ZoneRule[] };
}

const CompletionCell: React.FC<{ user: UserStat; zones: ZoneRule[] }> = ({ user, zones }) => {
    if (zones.length <= 1) {
        return user.isCompliant ? (
            <Badge className="bg-green-500 hover:bg-green-600">
                <CheckCircle className="w-3 h-3 mr-1" /> 수강 완료
            </Badge>
        ) : (
            <Badge variant="outline" className="text-gray-500">
                {user.totalMinutes > 0 ? '수강 중' : '미입장'}
            </Badge>
        );
    }

    return (
        <div className="flex flex-wrap gap-1">
            {zones.map(z => {
                const done = user.zoneComp?.[z.id] || false;
                const mins = user.zones?.[z.id] || 0;
                return (
                    <span key={z.id} className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-medium",
                        done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                    )}>
                        {z.name.slice(0, 3)}{done ? '✓' : `${mins}m`}
                    </span>
                );
            })}
        </div>
    );
};

export const StatsUsersTab: React.FC<StatsUsersTabProps> = ({ stats, currentRuleForRender }) => {
    return (
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
                            <TableHead className="text-right">오늘</TableHead>
                            <TableHead className="text-right">누적 시간</TableHead>
                            <TableHead className="text-right">남은</TableHead>
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
                                        <CompletionCell user={user} zones={currentRuleForRender.zones} />
                                    </TableCell>
                                    <TableCell className="text-right font-bold">
                                        {Math.floor(user.todayMinutes || 0)}m
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-lg">
                                        {Math.floor(user.totalMinutes)}m
                                    </TableCell>
                                    <TableCell className="text-right font-bold">
                                        {Math.floor(user.remainingMinutes || 0)}m
                                    </TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};
