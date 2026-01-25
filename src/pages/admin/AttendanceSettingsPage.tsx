import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Plus, Trash2, Save, Clock, MapPin, AlertCircle, CalendarDays, Coffee, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import LoadingSpinner from '../../components/common/LoadingSpinner';

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
    goalMinutes: number; // 0 = Use Global
    autoCheckout: boolean;
    breaks: BreakTime[];
    points: number; // Points awarded for completing this zone
}

interface DailyRule {
    date: string;
    globalGoalMinutes: number;
    zones: ZoneRule[];
}

const AttendanceSettingsPage: React.FC = () => {
    const { cid } = useParams<{ cid: string }>();
    const [dates, setDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [rules, setRules] = useState<Record<string, DailyRule>>({}); // Key: Date
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // 1. Fetch Dates & Existing Rules
    useEffect(() => {
        if (!cid) return;

        const init = async () => {
            try {
                // A. Fetch Dates from Basic Settings
                const confRef = doc(db, 'conferences', cid);
                const confSnap = await getDoc(confRef);

                if (confSnap.exists()) {
                    const data = confSnap.data();
                    // Handle both old format (startDate/endDate) and new format (dates.start/dates.end)
                    const start = (data.dates?.start || data.startDate)?.toDate();
                    const end = (data.dates?.end || data.endDate)?.toDate();

                    if (start && end) {
                        const dateList = [];
                        const current = new Date(start);
                        while (current <= end) {
                            dateList.push(current.toISOString().split('T')[0]);
                            current.setDate(current.getDate() + 1);
                        }
                        setDates(dateList);
                        if (dateList.length > 0) setSelectedDate(dateList[0]);
                    }
                }

                // B. Fetch Existing Rules
                const rulesRef = doc(db, `conferences/${cid}/settings/attendance`);
                const rulesSnap = await getDoc(rulesRef);

                if (rulesSnap.exists()) {
                    setRules(rulesSnap.data().rules || {});
                }

            } catch (error) {
                console.error("Failed to load attendance settings:", error);
                toast.error("Failed to load settings.");
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [cid]);

    // Helper: Get current rule or default
    const getCurrentRule = (): DailyRule => {
        if (!selectedDate) return { date: '', globalGoalMinutes: 0, zones: [] };
        return rules[selectedDate] || {
            date: selectedDate,
            globalGoalMinutes: 240, // Default 4 hours
            zones: []
        };
    };

    const updateRule = (updated: DailyRule) => {
        setRules(prev => ({
            ...prev,
            [selectedDate]: updated
        }));
    };

    const handleSave = async () => {
        if (!cid) return;
        setSaving(true);
        try {
            const rulesRef = doc(db, `conferences/${cid}/settings/attendance`);
            await setDoc(rulesRef, { rules }, { merge: true });
            toast.success("Attendance rules saved!");
        } catch (error) {
            console.error("Save failed:", error);
            toast.error("Failed to save rules.");
        } finally {
            setSaving(false);
        }
    };

    // Zone Operations
    const addZone = () => {
        const current = getCurrentRule();
        const newZone: ZoneRule = {
            id: Date.now().toString(),
            name: 'New Zone',
            start: '09:00',
            end: '18:00',
            goalMinutes: 0,
            autoCheckout: true,
            breaks: [],
            points: 0
        };
        updateRule({ ...current, zones: [...current.zones, newZone] });
    };

    const removeZone = (zoneId: string) => {
        const current = getCurrentRule();
        updateRule({ ...current, zones: current.zones.filter(z => z.id !== zoneId) });
    };

    const updateZone = (zoneId: string, field: keyof ZoneRule, value: unknown) => {
        const current = getCurrentRule();
        const updatedZones = current.zones.map(z =>
            z.id === zoneId ? { ...z, [field]: value } : z
        );
        updateRule({ ...current, zones: updatedZones });
    };

    // Break Operations
    const addBreak = (zoneId: string) => {
        const current = getCurrentRule();
        const updatedZones = current.zones.map(z => {
            if (z.id === zoneId) {
                return {
                    ...z,
                    breaks: [...z.breaks, { label: 'Lunch', start: '12:00', end: '13:00' }]
                };
            }
            return z;
        });
        updateRule({ ...current, zones: updatedZones });
    };

    const removeBreak = (zoneId: string, breakIndex: number) => {
        const current = getCurrentRule();
        const updatedZones = current.zones.map(z => {
            if (z.id === zoneId) {
                const newBreaks = [...z.breaks];
                newBreaks.splice(breakIndex, 1);
                return { ...z, breaks: newBreaks };
            }
            return z;
        });
        updateRule({ ...current, zones: updatedZones });
    };

    const updateBreak = (zoneId: string, breakIndex: number, field: keyof BreakTime, value: string) => {
        const current = getCurrentRule();
        const updatedZones = current.zones.map(z => {
            if (z.id === zoneId) {
                const newBreaks = [...z.breaks];
                newBreaks[breakIndex] = { ...newBreaks[breakIndex], [field]: value };
                return { ...z, breaks: newBreaks };
            }
            return z;
        });
        updateRule({ ...current, zones: updatedZones });
    };

    if (loading) return (
        <div className="flex h-[50vh] items-center justify-center">
            <LoadingSpinner />
        </div>
    );

    if (dates.length === 0) return (
        <div className="flex h-[50vh] flex-col items-center justify-center gap-6 p-8">
            <div className="p-4 bg-slate-100 rounded-full">
                <CalendarDays className="w-10 h-10 text-slate-400" />
            </div>
            <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-slate-900">설정된 행사 일정이 없습니다</h2>
                <p className="text-slate-500 max-w-md mx-auto">
                    수강 설정을 진행하려면 먼저 행사 기본 설정에서 시작일과 종료일을 입력해야 합니다.
                </p>
            </div>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <a href={`/admin/conf/${cid}/settings`}>
                    행사 기본 설정으로 이동
                </a>
            </Button>
        </div>
    );

    const currentRule = getCurrentRule();

    return (
        <div className="w-full pb-32">
            {/* 1. Page Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-5 sticky top-0 z-20 shadow-sm flex justify-between items-center">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Clock className="w-6 h-6 text-slate-700" />
                        수강/이수 설정
                    </h1>
                    <p className="text-sm text-slate-500">일자별 이수 기준 시간과 출결 장소를 설정합니다.</p>
                </div>
                <Button onClick={handleSave} disabled={saving} size="lg" className="shadow-sm gap-2">
                    <Save className="w-4 h-4" />
                    {saving ? '저장 중...' : '변경사항 저장'}
                </Button>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

                <Tabs value={selectedDate} onValueChange={setSelectedDate} className="space-y-8">
                    {/* 2. Date Navigation */}
                    <TabsList className="bg-slate-50/50 p-1 rounded-xl flex-wrap gap-1 border border-slate-200">
                        {dates.map(date => (
                            <TabsTrigger
                                key={date}
                                value={date}
                                className="px-5 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm data-[state=active]:font-semibold text-slate-500 hover:text-slate-900 transition-all"
                            >
                                {date}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <TabsContent value={selectedDate} className="space-y-8 animate-in fade-in zoom-in-95 duration-200">

                        {/* 3. Global Settings for the Day */}
                        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            <div className="lg:col-span-4 space-y-2">
                                <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
                                    <Clock className="w-5 h-5 text-blue-600" />
                                    일일 표준 이수 기준
                                </div>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    해당 일자의 기본 이수 목표 시간을 설정합니다.<br />
                                    각 장소(Zone)에서 별도로 설정하지 않으면 이 값이 기본값으로 사용됩니다.
                                </p>
                            </div>
                            <div className="lg:col-span-8">
                                <Card className="border shadow-none ring-1 ring-slate-100 bg-white">
                                    <div className="p-6 flex items-start sm:items-center gap-6 flex-col sm:flex-row">
                                        <div className="flex-1 w-full relative">
                                            <Label className="text-slate-600 mb-1.5 block">일일 목표 시간 (분)</Label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    value={currentRule.globalGoalMinutes}
                                                    onChange={(e) => updateRule({ ...currentRule, globalGoalMinutes: Number(e.target.value) })}
                                                    className="pl-4 pr-16 h-12 text-lg font-medium border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">Minutes</span>
                                            </div>
                                            <p className="text-xs text-blue-600 mt-2 font-medium">
                                                💡 {Math.floor(currentRule.globalGoalMinutes / 60)}시간 {currentRule.globalGoalMinutes % 60}분
                                                {currentRule.globalGoalMinutes === 240 && " (평점 4점 기준)"}
                                            </p>
                                        </div>
                                        <div className="hidden sm:block h-12 w-px bg-slate-100 mx-2" />
                                        <div className="flex-1 w-full bg-slate-50 border border-slate-100 p-4 rounded-lg">
                                            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                                                <AlertCircle className="w-4 h-4" /> 참고사항
                                            </div>
                                            <p className="text-xs text-slate-400 leading-snug">
                                                이 설정은 '참석 증명서' 발급 조건을 계산할 때 사용되는 기준 시간입니다. 실제 출결 기록은 각 장소별로 누적됩니다.
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </section>

                        <hr className="border-slate-100" />

                        {/* 4. Zone Management */}
                        <section className="space-y-6">
                            <div className="flex justify-between items-end">
                                <div className="space-y-1">
                                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <MapPin className="w-5 h-5 text-green-600" />
                                        장소별 설정 (Zones)
                                    </h2>
                                    <p className="text-sm text-slate-500">
                                        실제 태깅이 이루어지는 장소와 운영 시간을 관리합니다.
                                    </p>
                                </div>
                                <Button onClick={addZone} className="bg-slate-900 hover:bg-slate-800 text-white shadow-sm">
                                    <Plus className="w-4 h-4 mr-2" /> 새 장소 추가
                                </Button>
                            </div>

                            {currentRule.zones.length === 0 ? (
                                <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center space-y-4 bg-slate-50/50">
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                                        <MapPin className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900">등록된 장소가 없습니다</h3>
                                        <p className="text-slate-500 text-sm mt-1">우측 상단의 버튼을 눌러 출결 체크를 진행할 장소를 추가해주세요.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-6">
                                    {currentRule.zones.map(zone => (
                                        <Card key={zone.id} className="border shadow-sm overflow-hidden group hover:border-blue-300 transition-all duration-200">
                                            <div className="h-1.5 w-full bg-slate-100">
                                                <div className={cn("h-full w-full", zone.goalMinutes > 0 ? "bg-blue-500" : "bg-slate-300")} />
                                            </div>
                                            <CardContent className="p-0">
                                                {/* Top Row: Basic Info */}
                                                <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                                                    {/* Zone Identity & Time */}
                                                    <div className="lg:col-span-4 space-y-4 border-r border-slate-100 pr-0 lg:pr-6">
                                                        <div className="space-y-2">
                                                            <Label className="text-slate-600">장소명</Label>
                                                            <Input
                                                                value={zone.name}
                                                                onChange={(e) => updateZone(zone.id, 'name', e.target.value)}
                                                                placeholder="예: Room A (Grand Ballroom)"
                                                                className="font-semibold text-slate-900 bg-slate-50/50"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-slate-600">운영 시간</Label>
                                                            <div className="flex items-center gap-2">
                                                                <Input
                                                                    type="time"
                                                                    value={zone.start}
                                                                    onChange={(e) => updateZone(zone.id, 'start', e.target.value)}
                                                                />
                                                                <ArrowRight className="w-4 h-4 text-slate-300" />
                                                                <Input
                                                                    type="time"
                                                                    value={zone.end}
                                                                    onChange={(e) => updateZone(zone.id, 'end', e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Goals & Points */}
                                                    <div className="lg:col-span-3 space-y-4 border-r border-slate-100 pr-0 lg:pr-6">
                                                        <div className="space-y-2">
                                                            <Label className="text-slate-600">이수 기준 (분)</Label>
                                                            <Input
                                                                type="number"
                                                                value={zone.goalMinutes || 0}
                                                                onChange={(e) => updateZone(zone.id, 'goalMinutes', Number(e.target.value))}
                                                                placeholder="0"
                                                            />
                                                            <p className="text-[11px] text-slate-400">
                                                                * 0 입력 시 전체 기준({currentRule.globalGoalMinutes}분) 적용
                                                            </p>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-slate-600">배정 평점/점수</Label>
                                                            <Input
                                                                type="number"
                                                                value={zone.points || 0}
                                                                onChange={(e) => updateZone(zone.id, 'points', Number(e.target.value))}
                                                                className="bg-blue-50 border-blue-100 text-blue-700 font-bold"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Options & Actions */}
                                                    <div className="lg:col-span-5 flex flex-col justify-between h-full space-y-4">

                                                        <div className="bg-orange-50/50 border border-orange-100 rounded-lg p-3">
                                                            <Label className="text-orange-900 font-semibold text-xs flex items-center gap-1.5 mb-2">
                                                                <Coffee className="w-3.5 h-3.5" />
                                                                휴식 시간 (Break Times) - 시간 계산 제외
                                                            </Label>
                                                            <div className="space-y-2 max-h-[120px] overflow-y-auto">
                                                                {zone.breaks.map((brk, idx) => (
                                                                    <div key={idx} className="flex gap-2 items-center">
                                                                        <Input
                                                                            className="h-7 text-xs w-24 bg-white"
                                                                            value={brk.label}
                                                                            onChange={(e) => updateBreak(zone.id, idx, 'label', e.target.value)}
                                                                            placeholder="Lunch"
                                                                        />
                                                                        <Input
                                                                            type="time"
                                                                            className="h-7 text-xs w-20 bg-white px-1"
                                                                            value={brk.start}
                                                                            onChange={(e) => updateBreak(zone.id, idx, 'start', e.target.value)}
                                                                        />
                                                                        <span className="text-slate-300 text-[10px]">-</span>
                                                                        <Input
                                                                            type="time"
                                                                            className="h-7 text-xs w-20 bg-white px-1"
                                                                            value={brk.end}
                                                                            onChange={(e) => updateBreak(zone.id, idx, 'end', e.target.value)}
                                                                        />
                                                                        <button
                                                                            onClick={() => removeBreak(zone.id, idx)}
                                                                            className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => addBreak(zone.id)}
                                                                    className="w-full h-7 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-100"
                                                                >
                                                                    + 휴식 시간 추가
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between pt-2">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="checkbox"
                                                                    id={`auto-checkout-${zone.id}`}
                                                                    checked={!!zone.autoCheckout}
                                                                    onChange={(e) => updateZone(zone.id, 'autoCheckout', e.target.checked)}
                                                                    className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                                                />
                                                                <label htmlFor={`auto-checkout-${zone.id}`} className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                                                                    자동 퇴장 처리 (Auto-Checkout)
                                                                </label>
                                                            </div>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => removeZone(zone.id)}
                                                                className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-100"
                                                            >
                                                                <Trash2 className="w-4 h-4 mr-1.5" /> 삭제
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </section>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default AttendanceSettingsPage;
