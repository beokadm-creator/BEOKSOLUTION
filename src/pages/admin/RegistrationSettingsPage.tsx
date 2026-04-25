import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useSocietyGrades } from '../../hooks/useSocietyGrades';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Trash2, Plus, Save, FileText, Settings2 } from 'lucide-react';
import { normalizeFieldSettings, FIELD_LABELS } from '../../utils/registrationFieldSettings';
import type { RegistrationFieldSettings, RegistrationFieldKey } from '../../types/schema';


interface RegistrationPeriod {
    id: string;
    name: { ko: string; en?: string };
    type: 'EARLY' | 'REGULAR' | 'LATE' | 'ONSITE';
    startDate: Timestamp;
    endDate: Timestamp;
    prices: Record<string, number>; // Dynamic pricing based on Grade IDs
}

interface RegistrationSettings {
    paymentMode: 'TIERED' | 'FREE_ALL';
    periods: RegistrationPeriod[];
    refundPolicy: string;
    fieldSettings?: RegistrationFieldSettings;
}

const defaultSettings: RegistrationSettings = {
    paymentMode: 'TIERED',
    periods: [],
    refundPolicy: '',
    fieldSettings: normalizeFieldSettings()
};

const RegistrationSettingsPage: React.FC = () => {
    const { cid } = useParams<{ cid: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [settings, setSettings] = useState<RegistrationSettings>(defaultSettings);
    const [societyId, setSocietyId] = useState<string | null>(null);

    // Use useSocietyGrades hook for loading grades
    const { gradeMasterMap, loading: gradesLoading } = useSocietyGrades(societyId || undefined);

    // 1. Fetch Society ID from Conference (needed for grades)
    useEffect(() => {
        if (!cid) return;

        const fetchSocietyId = async () => {
            try {
                const confRef = doc(db, 'conferences', cid);
                const confSnap = await getDoc(confRef);
                if (confSnap.exists()) {
                    const sid = confSnap.data().societyId;
                    if (sid) {
                        setSocietyId(sid);
                    }
                }
            } catch (e) {
                console.error("Error fetching society ID:", e);
            }
        };
        fetchSocietyId();
    }, [cid]);

    // 2. Fetch Registration Settings
    useEffect(() => {
        if (!cid) {
            setError("사이드바에서 컨퍼런스를 선택해주세요.");
            setLoading(false);
            return;
        }

        const fetchSettings = async () => {
            try {
                const docRef = doc(db, `conferences/${cid}/settings/registration`);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setSettings({
                        paymentMode: data.paymentMode || 'TIERED',
                        periods: data.periods || [],
                        refundPolicy: data.refundPolicy || '',
                        fieldSettings: normalizeFieldSettings(data.fieldSettings)
                    });
                } else {
                    setSettings(defaultSettings);
                }
            } catch (err) {
                console.error("[RegistrationSettings] Fetch Error:", err);
                setError("설정을 불러오는 데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [cid]);

    const handleSave = async () => {
        if (!cid) return;

        for (const period of settings.periods) {
            if (!period.name.ko.trim()) {
                toast.error("모든 기간의 이름을 입력해주세요.");
                return;
            }
            if (period.startDate >= period.endDate) {
                toast.error("종료일은 시작일보다 늦어야 합니다.");
                return;
            }
        }

        try {
            setLoading(true);
            const docRef = doc(db, `conferences/${cid}/settings/registration`);
            await setDoc(docRef, settings, { merge: true });
            toast.success("등록 설정이 저장되었습니다!");
        } catch (err) {
            console.error(err);
            toast.error("설정 저장에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const addPeriod = () => {
        // Initialize prices for all current grades from gradeMasterMap
        const initialPrices: Record<string, number> = {};
        gradeMasterMap.forEach((name, code) => {
            initialPrices[code] = 0;
        });

        setSettings(prev => ({
            ...prev,
            periods: [...prev.periods, {
                id: Date.now().toString(),
                name: { ko: '새로운 기간', en: 'New Period' },
                type: 'REGULAR',
                startDate: Timestamp.fromDate(new Date()),
                endDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
                prices: initialPrices
            }]
        }));
    };

    const removePeriod = (index: number) => {
        setSettings(prev => {
            const newPeriods = [...prev.periods];
            newPeriods.splice(index, 1);
            return { ...prev, periods: newPeriods };
        });
    };

    const updatePeriod = <K extends keyof RegistrationPeriod>(index: number, field: K, value: RegistrationPeriod[K]) => {
        setSettings(prev => {
            const newPeriods = [...prev.periods];
            newPeriods[index] = { ...newPeriods[index], [field]: value };
            return { ...prev, periods: newPeriods };
        });
    };

    const updatePrice = (index: number, gradeId: string, value: number) => {
        setSettings(prev => {
            const newPeriods = [...prev.periods];
            // Ensure prices object exists
            if (!newPeriods[index].prices) newPeriods[index].prices = {};
            newPeriods[index].prices[gradeId] = value;
            return { ...prev, periods: newPeriods };
        });
    };

    const updateRefundPolicy = (value: string) => {
        setSettings(prev => ({ ...prev, refundPolicy: value }));
    };

    const toggleFieldSetting = (key: RegistrationFieldKey, field: 'visible' | 'required') => {
        setSettings(prev => {
            const currentFieldSettings = prev.fieldSettings || normalizeFieldSettings();
            const newValue = !currentFieldSettings[key][field];
            
            const updatedFieldSettings = {
                ...currentFieldSettings,
                [key]: {
                    ...currentFieldSettings[key],
                    [field]: newValue
                }
            };
            
            return {
                ...prev,
                fieldSettings: normalizeFieldSettings(updatedFieldSettings)
            };
        });
    };

    const timestampToDateString = (ts: Timestamp) => {
        const d = ts.toDate();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const dateStringToTimestamp = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        // Force KST midnight
        return Timestamp.fromDate(new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+09:00`));
    };

    if (loading) return <LoadingSpinner />;
    
    if (error) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <h2 className="text-red-800 font-semibold mb-2">오류가 발생했습니다</h2>
                    <p className="text-red-600">{error}</p>
                    <Button onClick={() => window.location.reload()} className="mt-4" variant="outline">새로고침</Button>
                </div>
            </div>
        );
    }

    if (!cid) {
        return (
            <div className="p-8 max-w-4xl mx-auto text-center">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 max-w-md mx-auto">
                    <h2 className="text-xl font-semibold text-blue-800 mb-4">컨퍼런스를 선택해주세요</h2>
                    <p className="text-blue-600">사이드바에서 관리할 컨퍼런스를 선택한 후 등록 설정을 관리할 수 있습니다.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">등록/요금 설정 (Registration Settings)</h1>
                    <p className="text-gray-500 mt-1">학술대회 등록 기간과 요금, 환불 정책을 관리합니다.</p>
                </div>
                <Button onClick={handleSave} disabled={loading || gradesLoading} className="bg-blue-600 hover:bg-blue-700">
                    <Save className="w-4 h-4 mr-2" />
                    저장하기 (Save)
                </Button>
            </div>

            <div className="space-y-8">
                {/* Payment Mode Selection */}
                <Card className="border-2 border-blue-100 shadow-sm">
                    <CardHeader className="bg-blue-50/50 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            결제 모드 (Payment Mode)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex flex-col gap-4">
                            <label className="flex items-start gap-3 cursor-pointer p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                                <input
                                    type="radio"
                                    name="paymentMode"
                                    value="TIERED"
                                    checked={settings.paymentMode === 'TIERED'}
                                    onChange={() => setSettings(prev => ({ ...prev, paymentMode: 'TIERED' }))}
                                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                    <div className="font-bold text-slate-900">등급별 유료 결제 (Tiered Pricing)</div>
                                    <p className="text-sm text-slate-500 mt-1">회원/비회원 등급별로 요금을 설정합니다. 참가자는 회원 인증 후 요금을 결제해야 합니다.</p>
                                </div>
                            </label>
                            
                            <label className="flex items-start gap-3 cursor-pointer p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                                <input
                                    type="radio"
                                    name="paymentMode"
                                    value="FREE_ALL"
                                    checked={settings.paymentMode === 'FREE_ALL'}
                                    onChange={() => setSettings(prev => ({ ...prev, paymentMode: 'FREE_ALL' }))}
                                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                    <div className="font-bold text-slate-900">전면 무료 (Free for All)</div>
                                    <p className="text-sm text-slate-500 mt-1">모든 참가자가 무료로 등록합니다. 회원 인증 없이 기본 정보만 입력하면 등록이 완료됩니다.</p>
                                </div>
                            </label>
                        </div>
                    </CardContent>
                </Card>

                {/* Field Settings Section */}
                <Card className="border-2 border-slate-100 shadow-sm">
                    <CardHeader className="bg-slate-50/50 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Settings2 className="w-5 h-5" />
                            등록 입력 항목 설정
                        </CardTitle>
                        <p className="text-sm text-slate-500">참가자 등록 폼에 표시될 항목과 필수 입력 여부를 설정합니다.</p>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4 font-semibold text-slate-700 border-b pb-2 px-2">
                                <div>항목명</div>
                                <div className="text-center">표시 여부</div>
                                <div className="text-center">필수 여부</div>
                            </div>
                            
                            {(Object.keys(FIELD_LABELS) as RegistrationFieldKey[]).map((key) => {
                                const setting = settings.fieldSettings?.[key] || normalizeFieldSettings()[key];
                                const isName = key === 'name';
                                
                                return (
                                    <div key={key} className={`grid grid-cols-3 gap-4 items-center py-3 px-2 rounded-lg ${isName ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
                                        <div className="font-medium text-slate-900">
                                            {FIELD_LABELS[key]}
                                            {isName && <span className="ml-2 text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded">기본값 (변경불가)</span>}
                                        </div>
                                        
                                        <div className="flex justify-center">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="sr-only peer"
                                                    checked={setting.visible}
                                                    disabled={isName}
                                                    onChange={() => toggleFieldSetting(key, 'visible')}
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
                                            </label>
                                        </div>
                                        
                                        <div className="flex justify-center">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="sr-only peer"
                                                    checked={setting.required}
                                                    disabled={isName || !setting.visible}
                                                    onChange={() => toggleFieldSetting(key, 'required')}
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
                                            </label>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                <div>
                    <h2 className="text-xl font-semibold mb-4 flex items-center">
                        <Plus className="w-5 h-5 mr-2" /> 등록 기간 및 가격
                    </h2>
                    <div className="space-y-4">
                        {settings.periods.map((period, idx) => (
                            <Card key={period.id}>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-lg font-medium">
                                        <div className="flex items-center gap-4">
                                            <Input 
                                                value={period.name.ko} 
                                                onChange={(e) => updatePeriod(idx, 'name', { ...period.name, ko: e.target.value })} 
                                                className="font-bold text-lg w-48"
                                                placeholder="기간명 (예: 조기등록)"
                                            />
                                            <select 
                                                value={period.type}
                                                onChange={(e) => updatePeriod(idx, 'type', e.target.value as RegistrationPeriod['type'])}
                                                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                                            >
                                                <option value="EARLY">조기등록</option>
                                                <option value="REGULAR">일반등록</option>
                                                <option value="ONSITE">현장등록</option>
                                            </select>
                                        </div>
                                    </CardTitle>
                                    <Button variant="ghost" size="sm" onClick={() => removePeriod(idx)} className="text-red-500 hover:text-red-700">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <Label>시작일</Label>
                                            <Input 
                                                type="date" 
                                                value={timestampToDateString(period.startDate)} 
                                                onChange={(e) => updatePeriod(idx, 'startDate', dateStringToTimestamp(e.target.value))} 
                                            />
                                        </div>
                                        <div>
                                            <Label>종료일</Label>
                                            <Input 
                                                type="date" 
                                                value={timestampToDateString(period.endDate)} 
                                                onChange={(e) => updatePeriod(idx, 'endDate', dateStringToTimestamp(e.target.value))} 
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="bg-slate-50 p-4 rounded-md">
                                        <Label className="mb-3 block font-semibold text-slate-700">
                                            가격 매트릭스 (KRW) - 회원 등급별 설정
                                        </Label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {Array.from(gradeMasterMap.entries()).map(([code, nameObj]) => (
                                                <div key={code}>
                                                    <Label className="text-xs text-slate-500 mb-1 block">
                                                        {nameObj.ko}
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        value={period.prices?.[code] || 0}
                                                        onChange={(e) => updatePrice(idx, code, Number(e.target.value))}
                                                        placeholder="0"
                                                        disabled={settings.paymentMode === 'FREE_ALL'}
                                                    />
                                                </div>
                                            ))}
                                            {gradeMasterMap.size === 0 && !gradesLoading && (
                                                <div className="col-span-4 text-center text-sm text-gray-500 py-4">
                                                    회원 등급 설정이 없습니다. 학회 설정에서 등급을 먼저 추가해주세요.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        <Button variant="outline" onClick={addPeriod} className="w-full border-dashed py-6">
                            <Plus className="w-4 h-4 mr-2" /> 등록 기간 추가
                        </Button>
                    </div>
                </div>

                <div>
                    <h2 className="text-xl font-semibold mb-4 flex items-center">
                        <FileText className="w-5 h-5 mr-2" /> 환불 정책
                    </h2>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="space-y-2">
                                <Label>취소 및 환불 규정</Label>
                                <Textarea 
                                    value={settings.refundPolicy} 
                                    onChange={(e) => updateRefundPolicy(e.target.value)} 
                                    rows={8}
                                    placeholder="환불 정책을 입력해주세요..."
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default RegistrationSettingsPage;
