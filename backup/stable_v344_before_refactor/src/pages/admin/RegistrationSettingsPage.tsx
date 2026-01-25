import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Trash2, Plus, Save, FileText } from 'lucide-react';
import { useAdminStore } from '../../store/adminStore';

interface RegistrationPeriod {
    id: string;
    name: { ko: string; en?: string };
    type: 'EARLY' | 'REGULAR' | 'ONSITE';
    startDate: Timestamp;
    endDate: Timestamp;
    prices: Record<string, number>; // Dynamic pricing based on Grade IDs
}

interface RegistrationSettings {
    periods: RegistrationPeriod[];
    refundPolicy: string;
}

interface Grade {
    id: string;
    name: string;
}

const RegistrationSettingsPage: React.FC = () => {
    const { selectedConferenceId: confId } = useAdminStore();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [settings, setSettings] = useState<RegistrationSettings>({
        periods: [],
        refundPolicy: ''
    });
    const [grades, setGrades] = useState<Grade[]>([]);

    // 1. Fetch Grades first
    useEffect(() => {
        if (!confId) return;

        const fetchGrades = async () => {
            try {
                // Get Society ID from Conference
                const confRef = doc(db, 'conferences', confId);
                const confSnap = await getDoc(confRef);
                if (!confSnap.exists()) return;
                
                const societyId = confSnap.data().societyId;
                if (!societyId) return;

                // Get Grades from Society Settings (Subcollection)
                const gradesColRef = collection(db, `societies/${societyId}/settings/grades/list`);
                const gradesSnap = await getDocs(gradesColRef);
                
                if (!gradesSnap.empty) {
                    const list = gradesSnap.docs.map(d => ({
                        id: d.id,
                        name: d.data().name,
                        // code might be the id or a field
                    }));
                    setGrades(list);
                } else {
                    // Fallback defaults if no grades defined
                    setGrades([
                        { id: 'MEMBER', name: 'Member (정회원)' },
                        { id: 'NON_MEMBER', name: 'Non-Member (비회원)' },
                        { id: 'STUDENT', name: 'Student (학생/전공의)' }
                    ]);
                }
            } catch (e) {
                console.error("Error fetching grades:", e);
            }
        };
        fetchGrades();
    }, [confId]);

    // 2. Fetch Registration Settings
    useEffect(() => {
        if (!confId) {
            setError("사이드바에서 컨퍼런스를 선택해주세요.");
            setLoading(false);
            return;
        }
        
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, `conferences/${confId}/settings/registration`);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    setSettings(docSnap.data() as RegistrationSettings);
                } else {
                    setSettings({
                        periods: [],
                        refundPolicy: ''
                    });
                }
            } catch (err) {
                console.error("[RegistrationSettings] Fetch Error:", err);
                setError("설정을 불러오는 데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };
        
        fetchSettings();
    }, [confId]);

    const handleSave = async () => {
        if (!confId) return;
        
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
            const docRef = doc(db, `conferences/${confId}/settings/registration`);
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
        // Initialize prices for all current grades
        const initialPrices: Record<string, number> = {};
        grades.forEach(g => initialPrices[g.id] = 0);

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

    const timestampToDateString = (ts: Timestamp) => {
        const d = ts.toDate();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const dateStringToTimestamp = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return Timestamp.fromDate(new Date(year, month - 1, day));
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

    if (!confId) {
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
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">등록 설정 관리</h1>
                <Button onClick={handleSave} disabled={loading}>
                    <Save className="w-4 h-4 mr-2" />
                    {loading ? '저장 중...' : '변경사항 저장'}
                </Button>
            </div>

            <div className="space-y-8">
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
                                            {grades.map(grade => (
                                                <div key={grade.id}>
                                                    <Label className="text-xs text-slate-500 mb-1 block">
                                                        {grade.name}
                                                    </Label>
                                                    <Input 
                                                        type="number" 
                                                        value={period.prices?.[grade.id] || 0} 
                                                        onChange={(e) => updatePrice(idx, grade.id, Number(e.target.value))} 
                                                        placeholder="0"
                                                    />
                                                </div>
                                            ))}
                                            {grades.length === 0 && (
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
