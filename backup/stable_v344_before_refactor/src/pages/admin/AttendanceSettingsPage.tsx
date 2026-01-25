import React, { useState, useEffect } from 'react';
import { useAdminStore } from '../../store/adminStore';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Plus, Trash2, Save, Clock, MapPin, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';

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
    const { selectedConferenceId } = useAdminStore();
    const [dates, setDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [rules, setRules] = useState<Record<string, DailyRule>>({}); // Key: Date
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // 1. Fetch Dates & Existing Rules
    useEffect(() => {
        if (!selectedConferenceId) return;

        const init = async () => {
            try {
                // A. Fetch Dates from Basic Settings
                const confRef = doc(db, 'conferences', selectedConferenceId);
                const confSnap = await getDoc(confRef);
                
                if (confSnap.exists()) {
                    const data = confSnap.data();
                    const start = data.startDate?.toDate();
                    const end = data.endDate?.toDate();
                    
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
                const rulesRef = doc(db, `conferences/${selectedConferenceId}/settings/attendance`);
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
    }, [selectedConferenceId]);

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
        if (!selectedConferenceId) return;
        setSaving(true);
        try {
            const rulesRef = doc(db, `conferences/${selectedConferenceId}/settings/attendance`);
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

    const updateZone = (zoneId: string, field: keyof ZoneRule, value: any) => {
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

    if (loading) return <div className="p-8">Loading settings...</div>;
    if (dates.length === 0) return <div className="p-8">Please configure conference dates first in Basic Settings.</div>;

    const currentRule = getCurrentRule();

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">수강/이수 설정 (Attendance Rules)</h1>
                    <p className="text-gray-500 mt-2">일자별 이수 기준 시간과 출결 장소(Zone)를 설정하세요.</p>
                </div>
                <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Rules'}
                </Button>
            </div>

            <Tabs value={selectedDate} onValueChange={setSelectedDate}>
                <TabsList className="mb-6 flex-wrap h-auto">
                    {dates.map(date => (
                        <TabsTrigger key={date} value={date} className="px-6 py-2">
                            {date}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value={selectedDate} className="space-y-6">
                    {/* Global Daily Settings */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-blue-600" />
                                <CardTitle>Daily Global Settings ({selectedDate})</CardTitle>
                            </div>
                            <CardDescription>
                                This is the default required time for this day. Zones can override this.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="max-w-xs">
                                <Label>Daily Goal (Minutes)</Label>
                                <Input 
                                    type="number" 
                                    value={currentRule.globalGoalMinutes}
                                    onChange={(e) => updateRule({ ...currentRule, globalGoalMinutes: Number(e.target.value) })}
                                />
                                <p className="text-xs text-gray-500 mt-1">e.g., 240 minutes = 4 hours (4 평점)</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Zone List */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <MapPin className="w-5 h-5" />
                                Zone Specific Rules
                            </h3>
                            <Button variant="outline" size="sm" onClick={addZone}>
                                <Plus className="w-4 h-4 mr-2" /> Add Zone
                            </Button>
                        </div>

                        {currentRule.zones.length === 0 && (
                            <div className="p-8 border-2 border-dashed rounded-lg text-center text-gray-400">
                                No zones configured. All attendance will use the global goal.
                            </div>
                        )}

                        {currentRule.zones.map(zone => (
                            <Card key={zone.id} className="border-l-4 border-l-blue-500">
                                <CardContent className="pt-6 space-y-6">
                                    <div className="flex justify-between items-start">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                                            <div className="space-y-2">
                                                <Label>Zone Name</Label>
                                                <Input 
                                                    value={zone.name} 
                                                    onChange={(e) => updateZone(zone.id, 'name', e.target.value)}
                                                    placeholder="Room A"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Operating Hours</Label>
                                                <div className="flex gap-2 items-center">
                                                    <Input 
                                                        type="time" 
                                                        value={zone.start} 
                                                        onChange={(e) => updateZone(zone.id, 'start', e.target.value)}
                                                    />
                                                    <span>~</span>
                                                    <Input 
                                                        type="time" 
                                                        value={zone.end} 
                                                        onChange={(e) => updateZone(zone.id, 'end', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                {/* Inside the Zone Card */}
                                                <div className="flex gap-4 mb-4">
                                                    <div className="flex-1">
                                                        <Label className="block text-sm font-medium mb-1">이수 기준 (분)</Label>
                                                        <Input 
                                                            type="number" 
                                                            value={zone.goalMinutes || 0} 
                                                            onChange={(e) => updateZone(zone.id, 'goalMinutes', Number(e.target.value))}
                                                            className="w-full border p-2 rounded"
                                                            placeholder="0 = Use Global"
                                                        />
                                                        <p className="text-xs text-gray-500 mt-1">Set 0 to use Daily Goal ({currentRule.globalGoalMinutes}m)</p>
                                                    </div>
                                                    <div className="flex-1">
                                                        <Label className="block text-sm font-medium mb-1 text-blue-700">배정 점수 (Points)</Label>
                                                        <Input 
                                                            type="number" 
                                                            value={zone.points || 0} 
                                                            onChange={(e) => updateZone(zone.id, 'points', Number(e.target.value))}
                                                            className="w-full border p-2 rounded bg-blue-50 border-blue-200"
                                                            placeholder="예: 2"
                                                        />
                                                    </div>
                                                </div>
                                                
                                                {/* FORCE INJECT AUTO-CHECKOUT CHECKBOX */}
                                                <div className="flex items-center mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                                                    <input 
                                                        type="checkbox"
                                                        id={`auto-checkout-${zone.id}`}
                                                        checked={!!zone.autoCheckout}
                                                        onChange={(e) => updateZone(zone.id, 'autoCheckout', e.target.checked)}
                                                        className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                    />
                                                    <label htmlFor={`auto-checkout-${zone.id}`} className="ml-2 text-sm font-medium text-gray-900 cursor-pointer">
                                                        [옵션] 운영 종료 시 자동 일괄 퇴장 처리 (Auto-Checkout)
                                                    </label>
                                                </div>
                                            </div>
                                            {/* Removed duplicate render location */}
                                        </div>
                                        <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50 ml-4" onClick={() => removeZone(zone.id)}>
                                            <Trash2 className="w-5 h-5" />
                                        </Button>
                                    </div>

                                    {/* Breaks */}
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        <div className="flex justify-between items-center mb-2">
                                            <Label className="text-xs font-bold uppercase text-gray-500">Break Times (Excluded from calculation)</Label>
                                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => addBreak(zone.id)}>
                                                + Add Break
                                            </Button>
                                        </div>
                                        {zone.breaks.map((brk, idx) => (
                                            <div key={idx} className="flex gap-2 items-center mb-2">
                                                <Input 
                                                    className="h-8 w-32" 
                                                    value={brk.label} 
                                                    onChange={(e) => updateBreak(zone.id, idx, 'label', e.target.value)}
                                                    placeholder="Lunch"
                                                />
                                                <Input 
                                                    type="time" 
                                                    className="h-8 w-24" 
                                                    value={brk.start} 
                                                    onChange={(e) => updateBreak(zone.id, idx, 'start', e.target.value)}
                                                />
                                                <span>~</span>
                                                <Input 
                                                    type="time" 
                                                    className="h-8 w-24" 
                                                    value={brk.end} 
                                                    onChange={(e) => updateBreak(zone.id, idx, 'end', e.target.value)}
                                                />
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => removeBreak(zone.id, idx)}>
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        ))}
                                        {zone.breaks.length === 0 && <p className="text-xs text-gray-400 italic">No break times defined.</p>}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default AttendanceSettingsPage;
