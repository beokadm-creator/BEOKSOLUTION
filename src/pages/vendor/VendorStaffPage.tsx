import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useVendor } from '../../hooks/useVendor';
import { getAuth } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Users, UserPlus, Mail, ShieldAlert, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function VendorStaffPage() {
    const { vendorId } = useParams<{ vendorId: string }>();
    const vendorLogic = useVendor(vendorId);

    const { vendor, loading, updateVendorProfile } = vendorLogic;
    const [newEmail, setNewEmail] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const auth = getAuth();
    const currentUserEmail = auth.currentUser?.email;

    // Only owner or adminEmail should manage staff (L3 Master check)
    const isMasterAdmin = currentUserEmail === vendor?.adminEmail;

    const handleAddStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vendor || !isMasterAdmin) return;

        const emailToAdd = newEmail.trim().toLowerCase();
        if (!emailToAdd) return;

        if (vendor.adminEmail === emailToAdd) {
            toast.error("메인 관리자 이메일은 스태프로 추가할 수 없습니다.");
            return;
        }

        const currentStaff = vendor.staffEmails || [];
        if (currentStaff.includes(emailToAdd)) {
            toast.error("이미 등록된 스태프입니다.");
            return;
        }

        setIsSaving(true);
        const newStaffList = [...currentStaff, emailToAdd];

        try {
            await updateVendorProfile({ staffEmails: newStaffList });
            setNewEmail('');
            // Optional: The hook toast might already fire, but it's okay.
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveStaff = async (emailToRemove: string) => {
        if (!vendor || !isMasterAdmin || isSaving) return;

        if (!window.confirm(`정말 ${emailToRemove} 스태프 권한을 삭제하시겠습니까?`)) {
            return;
        }

        setIsSaving(true);
        const currentStaff = vendor.staffEmails || [];
        const newStaffList = currentStaff.filter(email => email !== emailToRemove);

        try {
            await updateVendorProfile({ staffEmails: newStaffList });
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    if (loading && !vendor) {
        return <div className="p-8 text-center text-gray-500 flex justify-center"><LoadingSpinner /></div>;
    }

    if (!isMasterAdmin) {
        return (
            <div className="max-w-4xl mx-auto mt-10">
                <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl flex flex-col items-center justify-center text-center gap-4">
                    <ShieldAlert className="w-12 h-12 text-red-500" />
                    <div>
                        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
                        <p>스태프 조직 관리 기능은 메인 파트너 관리자(Admin)만 접근할 수 있습니다.</p>
                        <p className="text-sm mt-2 opacity-75">현재 로그인된 계정은 스태프 계정입니다.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
                    <p className="text-sm text-gray-500">대시보드 접근 및 스캐너를 사용할 서브 스태프 계정을 관리합니다.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Add Staff Form */}
                <Card className="md:col-span-1 shadow-sm h-fit">
                    <CardHeader className="bg-indigo-50 border-b border-indigo-100">
                        <CardTitle className="text-lg flex items-center gap-2 text-indigo-900">
                            <UserPlus className="w-5 h-5" /> 스태프 추가
                        </CardTitle>
                    </CardHeader>
                    <form onSubmit={handleAddStaff}>
                        <CardContent className="p-6 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">스태프 로그인 이메일</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    placeholder="staff@company.com"
                                    value={newEmail}
                                    onChange={e => setNewEmail(e.target.value)}
                                    className="bg-white"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    해당 이메일로 파트너스 포털에 로그인 시 대시보드와 스캐너 접근이 허용됩니다.
                                </p>
                            </div>
                            <Button
                                type="submit"
                                className="w-full bg-indigo-600 hover:bg-indigo-700"
                                disabled={isSaving || !newEmail.trim()}
                            >
                                {isSaving ? <LoadingSpinner text="추가 중..." /> : '권한 부여'}
                            </Button>
                        </CardContent>
                    </form>
                </Card>

                {/* Staff List */}
                <Card className="md:col-span-2 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Users className="w-5 h-5 text-gray-500" /> 등록된 조직 계정
                        </CardTitle>
                        <CardDescription>
                            파트너 포털에 접근 가능한 전체 스태프 목록입니다.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-gray-100">
                            {/* Master Admin */}
                            <div className="p-4 flex items-center justify-between bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700">
                                        <ShieldAlert className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 flex items-center gap-2">
                                            {vendor?.adminEmail}
                                            <span className="bg-indigo-100 text-indigo-800 text-[10px] uppercase px-2 py-0.5 rounded font-bold">Master</span>
                                        </p>
                                        <p className="text-xs text-gray-500">메인 관리자 (최고 권한)</p>
                                    </div>
                                </div>
                            </div>

                            {/* Staff List */}
                            {(!vendor?.staffEmails || vendor.staffEmails.length === 0) ? (
                                <div className="p-8 text-center text-gray-500 border-t border-gray-100">
                                    등록된 서브 스태프가 없습니다.
                                </div>
                            ) : (
                                vendor.staffEmails.map((email) => (
                                    <div key={email} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                                                <Mail className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{email}</p>
                                                <p className="text-xs text-gray-500">스태프</p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRemoveStaff(email)}
                                            disabled={isSaving}
                                            className="text-red-500 hover:bg-red-50 hover:text-red-600"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
