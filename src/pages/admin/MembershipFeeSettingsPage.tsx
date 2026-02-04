import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAdminStore } from '../../store/adminStore';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import {
    Plus,
    Trash2,
    CreditCard,
    Calendar,
    Save,
    Pencil
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// Types
interface Grade {
    id: string;
    name: string;
    code: string;
}

interface MembershipFeeTier {
    id: string;
    name: string;
    code: string;
    amount: number;
    validityMonths?: number;
    validityYears?: number;
    isActive: boolean;
}

// Form state for new/edit tier
interface TierForm {
    gradeCode: string;
    amount: string;
    validityMonths: string;
    validityYears: string;
    validityPeriodType: 'MONTHS' | 'YEARS';
}

export default function MembershipFeeSettingsPage() {
    const { selectedSocietyId } = useAdminStore();

    // State
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [feeTiers, setFeeTiers] = useState<MembershipFeeTier[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);

    // New tier form
    const [newTier, setNewTier] = useState<TierForm>({
        gradeCode: '',
        amount: '',
        validityMonths: '12',
        validityYears: '',
        validityPeriodType: 'MONTHS'
    });

    // Edit tier dialog
    const [editingTier, setEditingTier] = useState<MembershipFeeTier | null>(null);
    const [editForm, setEditForm] = useState<TierForm>({
        gradeCode: '',
        amount: '',
        validityMonths: '',
        validityYears: '',
        validityPeriodType: 'MONTHS'
    });

    // Determine Society ID
    const getSocietyId = () => {
        if (selectedSocietyId) return selectedSocietyId;
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') return parts[0];
        if (hostname === 'localhost' || hostname === '127.0.0.1') return 'kap';
        return null;
    };

    const targetId = getSocietyId();

    // Fetch grades from settings/grades/list
    const fetchGrades = useCallback(async () => {
        if (!targetId) return;
        try {
            const colRef = collection(db, 'societies', targetId, 'settings', 'grades', 'list');
            const snapshot = await getDocs(colRef);

            if (!snapshot.empty) {
                const list = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: data.code || doc.id,
                        name: typeof data.name === 'object' ? data.name.ko : data.name,
                        code: data.code || doc.id
                    };
                });
                setGrades(list);
            } else {
                setGrades([]);
            }
        } catch (error) {
            console.error("Error fetching grades:", error);
            toast.error("등급 정보를 불러오는데 실패했습니다.");
        }
    }, [targetId]);

    // Fetch fee tiers from settings/membership-fees
    const fetchFeeTiers = useCallback(async () => {
        if (!targetId) return;
        setLoading(true);
        try {
            const docRef = doc(db, 'societies', targetId, 'settings', 'membership-fees');
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const tiers = docSnap.data().membershipFeeTiers || [];
                setFeeTiers(tiers as MembershipFeeTier[]);
            } else {
                setFeeTiers([]);
            }
        } catch (error) {
            console.error("Error fetching fee tiers:", error);
            toast.error("회비 설정을 불러오는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    }, [targetId]);

    // Load data on mount
    useEffect(() => {
        if (targetId) {
            fetchGrades();
            fetchFeeTiers();
        }
    }, [targetId, fetchGrades, fetchFeeTiers]);

    // Get grade name by code
    const getGradeName = (code: string) => {
        const grade = grades.find(g => g.code === code);
        return grade ? grade.name : code;
    };

    // Add new fee tier
    const handleAddTier = async () => {
        // Basic validation depending on period type
        const amount = parseInt(newTier.amount);
        let validityMonths: number | undefined;
        let validityYears: number | undefined;
        if (newTier.validityPeriodType === 'MONTHS') {
            validityMonths = parseInt(newTier.validityMonths);
            if (!newTier.gradeCode || !newTier.amount || isNaN(amount) || isNaN(validityMonths) || validityMonths <= 0) {
                toast.error('모든 필드를 입력해주세요. (월수 유효기간)');
                return;
            }
        } else {
            validityYears = parseInt(newTier.validityYears);
            if (!newTier.gradeCode || !newTier.amount || isNaN(amount) || isNaN(validityYears) || validityYears <= 0) {
                toast.error('모든 필드를 입력해주세요. (년수 유효기간)');
                return;
            }
        }

        // Check if tier already exists for this grade
        const existingTier = feeTiers.find(t => t.code === newTier.gradeCode);
        if (existingTier) {
            toast.error('이 등급의 회비 설정이 이미 존재합니다.');
            return;
        }

        const grade = grades.find(g => g.code === newTier.gradeCode);
        if (!grade) {
            toast.error('유효하지 않은 등급입니다.');
            return;
        }

        setSaving(true);
        try {
            const newTierObj: { id: string; code: string; name: string; amount: number; isActive: boolean; validityMonths?: number; validityYears?: number } = {
                id: `tier_${Date.now()}`,
                code: newTier.gradeCode,
                name: grade.name,
                amount,
                isActive: true
            };
            if (newTier.validityPeriodType === 'MONTHS') {
                newTierObj.validityMonths = validityMonths;
            } else {
                newTierObj.validityYears = validityYears;
            }

            const newTiers = [
                ...feeTiers,
                newTierObj
            ];

            const docRef = doc(db, 'societies', targetId, 'settings', 'membership-fees');
            await setDoc(docRef, { membershipFeeTiers: newTiers });

            setFeeTiers(newTiers);
            setNewTier({ gradeCode: '', amount: '', validityMonths: '12', validityYears: '', validityPeriodType: 'MONTHS' });
            toast.success('회비 설정이 추가되었습니다.');
        } catch (error) {
            console.error("Error adding tier:", error);
            toast.error('추가 실패');
        } finally {
            setSaving(false);
        }
    };

    // Delete fee tier
    const handleDeleteTier = async (tierId: string) => {
        if (!window.confirm('이 회비 설정을 삭제하시겠습니까?')) return;

        try {
            const newTiers = feeTiers.filter(t => t.id !== tierId);

            const docRef = doc(db, 'societies', targetId, 'settings', 'membership-fees');
            await setDoc(docRef, { membershipFeeTiers: newTiers });

            setFeeTiers(newTiers);
            toast.success('삭제되었습니다.');
        } catch (error) {
            console.error("Error deleting tier:", error);
            toast.error('삭제 실패');
        }
    };

    // Toggle active status
    const handleToggleActive = async (tierId: string) => {
        const tier = feeTiers.find(t => t.id === tierId);
        if (!tier) return;

        try {
            const newTiers = feeTiers.map(t =>
                t.id === tierId ? { ...t, isActive: !t.isActive } : t
            );

            const docRef = doc(db, 'societies', targetId, 'settings', 'membership-fees');
            await setDoc(docRef, { membershipFeeTiers: newTiers });

            setFeeTiers(newTiers);
            toast.success('상태가 변경되었습니다.');
        } catch (error) {
            console.error("Error toggling active:", error);
            toast.error('상태 변경 실패');
        }
    };

    // Edit tier - open dialog
    const handleEditClick = (tier: MembershipFeeTier) => {
        setEditingTier(tier);
        setEditForm({
            gradeCode: tier.code,
            amount: tier.amount.toString(),
            validityMonths: tier.validityMonths?.toString() ?? '',
            validityYears: tier.validityYears?.toString() ?? '',
            validityPeriodType: tier.validityYears != null ? 'YEARS' : 'MONTHS'
        });
    };

    // Save edited tier
    const handleEditSave = async () => {
        if (!editingTier) return;

        const amount = parseInt(editForm.amount);
        const validityMonths = parseInt(editForm.validityMonths);
        const validityYears = parseInt(editForm.validityYears);

        if (isNaN(amount) || (editForm.validityPeriodType === 'MONTHS' && (isNaN(validityMonths) || validityMonths <= 0)) || (editForm.validityPeriodType === 'YEARS' && (isNaN(validityYears) || validityYears <= 0))) {
            toast.error('금액과 유효기간은 양수여야 합니다.');
            return;
        }

        try {
            const newTiers = feeTiers.map(t => {
                if (t.id !== editingTier.id) return t;
                const updated: { id: string; code: string; name: string; amount: number; isActive: boolean; validityMonths?: number; validityYears?: number } = { ...t, amount };
                if (editForm.validityPeriodType === 'MONTHS') {
                    updated.validityMonths = validityMonths;
                    updated.validityYears = undefined;
                } else {
                    updated.validityYears = validityYears;
                    updated.validityMonths = undefined;
                }
                return updated;
            });

            const docRef = doc(db, 'societies', targetId, 'settings', 'membership-fees');
            await setDoc(docRef, { membershipFeeTiers: newTiers });

            setFeeTiers(newTiers);
            setEditingTier(null);
            toast.success('수정되었습니다.');
        } catch (error) {
            console.error("Error saving tier:", error);
            toast.error('수정 실패');
        }
    };

    if (!targetId) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <LoadingSpinner />
        </div>
    );

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <LoadingSpinner />
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-24 p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50">Admin Console</Badge>
                        <span className="text-slate-300">|</span>
                        <span className="text-sm font-medium text-slate-500 uppercase tracking-wide">Society Settings</span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">학회 회비 설정</h1>
                    <p className="text-slate-500 mt-2 font-medium">회원 등급별 납부 금액과 유효기간을 설정합니다.</p>
                </div>
            </div>

            {/* Add New Tier */}
            <Card className="border-none shadow-lg shadow-slate-200/50 overflow-hidden bg-white rounded-2xl max-w-4xl mx-auto">
                <CardHeader className="bg-indigo-50/50 border-b border-indigo-100 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-600">
                            <Plus className="w-5 h-5" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-bold text-slate-800">새 회비 등급 추가</CardTitle>
                            <CardDescription className="text-indigo-600/80 font-medium mt-0.5">등급별 금액과 유효기간 설정</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-400 uppercase">회원 등급</Label>
                            <select
                                className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white transition-colors appearance-none cursor-pointer"
                                value={newTier.gradeCode}
                                onChange={e => setNewTier({
                                    ...newTier,
                                    gradeCode: e.target.value,
                                    validityMonths: newTier.validityMonths,
                                    validityYears: newTier.validityYears,
                                    validityPeriodType: newTier.validityPeriodType
                                })}
                            >
                                <option value="">등급 선택...</option>
                                {grades.map(g => (
                                    <option key={g.id} value={g.code}>{g.name} ({g.code})</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-400 uppercase">회비 금액 (원)</Label>
                            <Input
                                type="number"
                                value={newTier.amount}
                                onChange={e => setNewTier({
                                    ...newTier,
                                    amount: e.target.value,
                                    validityMonths: newTier.validityMonths,
                                    validityYears: newTier.validityYears,
                                    validityPeriodType: newTier.validityPeriodType
                                })}
                                placeholder="50000"
                                className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-4 mb-2">
                                <span className="text-xs font-bold text-slate-400 uppercase">유효기간 형식</span>
                                <label className="flex items-center space-x-2">
                                    <input type="radio" name="periodType" checked={newTier.validityPeriodType === 'MONTHS'} onChange={() => setNewTier({ ...newTier, validityPeriodType: 'MONTHS' })} />
                                    <span>개월</span>
                                </label>
                                <label className="flex items-center space-x-2 ml-4">
                                    <input type="radio" name="periodType" checked={newTier.validityPeriodType === 'YEARS'} onChange={() => setNewTier({ ...newTier, validityPeriodType: 'YEARS' })} />
                                    <span>년</span>
                                </label>
                            </div>
                            {newTier.validityPeriodType === 'MONTHS' ? (
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-400 uppercase">유효기간 (개월)</Label>
                                    <Input
                                        type="number"
                                value={newTier.validityMonths}
                                onChange={e => setNewTier({
                                    ...newTier,
                                    validityMonths: e.target.value,
                                    validityYears: newTier.validityYears,
                                    validityPeriodType: newTier.validityPeriodType
                                })}
                                        placeholder="12"
                                        className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                                    />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-400 uppercase">유효기간 (년)</Label>
                                    <Input
                                        type="number"
                                        value={newTier.validityYears}
                                        onChange={e => setNewTier({ ...newTier, validityYears: e.target.value })}
                                        placeholder="1"
                                        className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <Button
                        onClick={handleAddTier}
                        disabled={saving || !newTier.gradeCode || !newTier.amount}
                        size="lg"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200/50 mt-4 rounded-xl"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        {saving ? '저장 중...' : '회비 등급 추가'}
                    </Button>
                </CardContent>
            </Card>

            {/* Fee Tiers List */}
            <Card className="border-none shadow-lg shadow-slate-200/50 bg-white rounded-2xl max-w-5xl mx-auto">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-bold text-slate-800">설정된 회비 등급</CardTitle>
                            <CardDescription className="text-slate-500 font-medium mt-0.5">
                                총 {feeTiers.length}개 등급 설정됨
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {feeTiers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <CreditCard className="w-16 h-16 text-slate-300 mb-4" />
                            <p className="text-slate-400 font-medium">설정된 회비 등급이 없습니다.</p>
                            <p className="text-sm text-slate-300 mt-2">위 폼에서 새 등급을 추가해주세요.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="font-bold text-slate-600 pl-6">회원 등급</TableHead>
                                    <TableHead className="font-bold text-slate-600">회비 금액</TableHead>
                                    <TableHead className="font-bold text-slate-600">유효기간</TableHead>
                                    <TableHead className="font-bold text-slate-600">상태</TableHead>
                                    <TableHead className="text-right font-bold text-slate-600 pr-6">관리</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {feeTiers.map(tier => (
                                    <TableRow key={tier.id} className="hover:bg-slate-50/50 transition-colors">
                                        <TableCell className="pl-6">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-600">
                                                    {tier.code}
                                                </Badge>
                                                <span className="font-medium">{getGradeName(tier.code)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-sm text-slate-700">
                                            ₩{tier.amount.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                                {tier.validityYears != null
                                                    ? `${tier.validityYears}년`
                                                    : `${tier.validityMonths ?? 0}개월`}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={tier.isActive ? 'default' : 'secondary'}
                                                className={tier.isActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}
                                                onClick={() => handleToggleActive(tier.id)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                {tier.isActive ? '활성' : '비활성'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <div className="flex justify-end items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEditClick(tier)}
                                                    className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                                    title="수정"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteTier(tier.id)}
                                                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                    title="삭제"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={!!editingTier} onOpenChange={(open) => !open && setEditingTier(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>회비 등급 수정</DialogTitle>
                        <DialogDescription>금액과 유효기간을 수정합니다.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-bold text-slate-700">회원 등급</Label>
                            <Input
                                disabled
                                value={editForm.gradeCode}
                                className="h-11 bg-slate-50"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-bold text-slate-700">회비 금액 (원)</Label>
                            <Input
                                type="number"
                                value={editForm.amount}
                                onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                                className="h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-4 mb-2">
                                <span className="text-sm font-bold text-slate-700">유효기간 형식</span>
                                <label className="flex items-center space-x-2">
                                    <input type="radio" name="editPeriodType" checked={editForm.validityPeriodType === 'MONTHS'} onChange={() => setEditForm({ ...editForm, validityPeriodType: 'MONTHS' })} />
                                    <span>개월</span>
                                </label>
                                <label className="flex items-center space-x-2 ml-4">
                                    <input type="radio" name="editPeriodType" checked={editForm.validityPeriodType === 'YEARS'} onChange={() => setEditForm({ ...editForm, validityPeriodType: 'YEARS' })} />
                                    <span>년</span>
                                </label>
                            </div>
                            {editForm.validityPeriodType === 'MONTHS' ? (
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold text-slate-700">유효기간 (개월)</Label>
                                    <Input
                                        type="number"
                                        value={editForm.validityMonths}
                                        onChange={e => setEditForm({ ...editForm, validityMonths: e.target.value })}
                                        className="h-11"
                                    />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold text-slate-700">유효기간 (년)</Label>
                                    <Input
                                        type="number"
                                        value={editForm.validityYears}
                                        onChange={e => setEditForm({ ...editForm, validityYears: e.target.value })}
                                        className="h-11"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingTier(null)}>
                            취소
                        </Button>
                        <Button onClick={handleEditSave} className="bg-indigo-600 hover:bg-indigo-700">
                            <Save className="w-4 h-4 mr-2" />
                            저장
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
