import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, CheckCircle } from 'lucide-react';
import { DailyRule, ZoneRule } from '../types';

interface AttendanceStatsProps {
    rules: DailyRule | null;
    zones: ZoneRule[];
}

export const AttendanceStats: React.FC<AttendanceStatsProps> = ({ rules, zones }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="shadow-sm border-slate-200 bg-white">
                <CardContent className="p-4 flex items-center justify-between">
                    <div className="space-y-1">
                        <span className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            일일 목표 시간
                        </span>
                        <div className="text-2xl font-bold text-slate-900">
                            {rules?.globalGoalMinutes || 0} <span className="text-sm font-normal text-slate-400">분</span>
                        </div>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5" />
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200 bg-white">
                <CardContent className="p-4">
                    <span className="text-sm font-medium text-slate-500 flex items-center gap-1.5 mb-2">
                        <MapPin className="w-4 h-4" />
                        입장 가능 Zone ({zones.length})
                    </span>
                    <div className="flex gap-2 flex-wrap">
                        {zones.length === 0 && <span className="text-xs text-slate-400">설정된 Zone이 없습니다.</span>}
                        {zones.map(z => (
                            <Badge key={z.id} variant="secondary" className="bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 font-normal">
                                <span className="font-semibold">{z.name}</span>
                                <span className="mx-1.5 text-slate-300">|</span>
                                {z.start}~{z.end}
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
