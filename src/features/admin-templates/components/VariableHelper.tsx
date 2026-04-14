import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Info } from 'lucide-react';
import { EVENT_TYPE_PRESETS, NotificationEventType } from '@/types/schema';

interface VariableHelperProps {
    eventType: NotificationEventType;
    onInsert: (key: string, eventType: NotificationEventType) => void;
}

export function VariableHelper({ eventType, onInsert }: VariableHelperProps) {
    const eventPresets = EVENT_TYPE_PRESETS;
    const currentVariables = eventPresets[eventType]?.variables || [];

    return (
        <Card className="border-none shadow-lg shadow-blue-100/50 bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-blue-50/50 border-b border-blue-100 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                        <Info className="w-5 h-5" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-bold text-slate-800">
                            {eventPresets[eventType].label.ko} 가용 변수
                        </CardTitle>
                        <CardDescription className="text-blue-600/80 font-medium">
                            템플릿 작성 시 사용할 수 있는 동적 데이터 변수 목록입니다.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6 bg-slate-50/30">
                <div className="flex flex-wrap gap-2">
                    {currentVariables.map(variable => (
                        <button
                            key={variable.key}
                            onClick={() => onInsert(variable.key, eventType)}
                            className="group flex items-center gap-2 px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 hover:shadow-sm transition-all shadow-sm"
                            title="Click to copy/insert"
                        >
                            <span className="font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">#{`{${variable.key}}`}</span>
                            <span className="text-xs font-medium text-slate-500 group-hover:text-blue-600">{variable.label}</span>
                        </button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
