import React, { useState } from 'react';
import { useSociety } from '../../hooks/useSociety';
import { functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Trash2, UserPlus, Link as LinkIcon, AlertTriangle, Shield, Users } from 'lucide-react';

export default function AdminUsersPage() {
    const { society, loading: societyLoading } = useSociety();
    const [modalOpen, setModalOpen] = useState(false);
    const [loadingAction, setLoadingAction] = useState(false);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [linkMode, setLinkMode] = useState<{ active: boolean; existingUser?: { uid: string; email: string } }>({ active: false });

    if (societyLoading) return (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">로딩 중...</div>
    );
    if (!society) return (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">학회 정보를 찾을 수 없습니다.</div>
    );

    const adminEmails: string[] = society.adminEmails || [];

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setName('');
        setLinkMode({ active: false });
        setModalOpen(false);
    };

    const handleCreateOrLink = async (forceLink = false) => {
        if (!email) return toast.error('이메일을 입력하세요');
        if (!forceLink && !password && !linkMode.active) return toast.error('신규 계정 생성 시 비밀번호가 필요합니다');

        setLoadingAction(true);
        const createFn = httpsCallable(functions, 'createSocietyAdminUser');

        try {
            const result = await createFn({
                email,
                password,
                name,
                societyId: society.id,
                forceLink: forceLink || linkMode.active,
            });

            const data = result.data as {
                success: boolean;
                code?: string;
                warning?: string;
                existingUser?: { uid: string; email: string };
            };

            if (data.success === false && data.code === 'auth/email-already-exists') {
                setLinkMode({ active: true, existingUser: data.existingUser });
                toast.error('이미 존재하는 계정입니다. 연결 여부를 확인하세요.');
                setLoadingAction(false);
                return;
            }

            if (data.warning) {
                toast('계정 생성 완료 (경고: ' + data.warning + ')', { icon: '⚠️' });
            } else {
                toast.success(forceLink || linkMode.active ? '기존 계정이 관리자로 연결되었습니다' : '관리자 계정이 생성되었습니다');
            }

            resetForm();
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : '계정 처리 중 오류가 발생했습니다');
        } finally {
            setLoadingAction(false);
        }
    };

    const handleRemove = async (targetEmail: string) => {
        if (!confirm(`${targetEmail} 의 관리자 권한을 제거하시겠습니까?`)) return;

        setLoadingAction(true);
        const removeFn = httpsCallable(functions, 'removeSocietyAdminUser');

        try {
            await removeFn({ email: targetEmail, societyId: society.id });
            toast.success('관리자 권한이 제거되었습니다');
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : '권한 제거 중 오류가 발생했습니다');
        } finally {
            setLoadingAction(false);
        }
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-[#003366]" />
                        관리자 계정 관리
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        이 학회의 관리자 권한을 가진 계정을 추가하거나 제거합니다.
                    </p>
                </div>
                <Button
                    onClick={() => setModalOpen(true)}
                    className="bg-[#003366] hover:bg-[#002244] text-white rounded-xl gap-2 transition-colors"
                >
                    <UserPlus className="w-4 h-4" />
                    관리자 추가
                </Button>
            </div>

            {/* Admin List Card */}
            <Card className="rounded-2xl shadow-sm shadow-slate-200/50 border border-[#c3daee]">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                                <Users className="w-4 h-4 text-[#003366]" />
                                관리자 목록
                            </CardTitle>
                            <CardDescription className="text-xs mt-0.5">
                                현재 이 학회에 관리자 권한이 부여된 계정입니다.
                            </CardDescription>
                        </div>
                        <Badge variant="secondary" className="text-xs bg-[#f0f5fa] text-[#003366] border-[#c3daee]">
                            {adminEmails.length}명
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-[#f0f5fa] hover:bg-[#f0f5fa]">
                                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider pl-6">이메일</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-right pr-6">작업</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {adminEmails.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center py-12 text-gray-400 text-sm">
                                        등록된 관리자가 없습니다.
                                    </TableCell>
                                </TableRow>
                            ) : adminEmails.map((adminEmail) => (
                                <TableRow key={adminEmail} className="hover:bg-[#f0f5fa]/50 transition-colors">
                                    <TableCell className="pl-6 py-4 text-sm font-medium text-gray-900">
                                        {adminEmail}
                                    </TableCell>
                                    <TableCell className="pr-6 py-4 text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                            onClick={() => handleRemove(adminEmail)}
                                            disabled={loadingAction}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Create / Link Dialog */}
            <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
                <DialogContent className="rounded-2xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold text-gray-900">
                            {linkMode.active ? '기존 계정 연결' : '관리자 계정 추가'}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-gray-500">
                            {linkMode.active
                                ? '이미 가입된 계정에 이 학회의 관리자 권한을 부여합니다.'
                                : '새 관리자 계정을 생성하거나 기존 계정을 연결합니다.'}
                        </DialogDescription>
                    </DialogHeader>

                    {linkMode.active ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-2">
                                <AlertTriangle className="w-4 h-4" />
                                이미 존재하는 계정
                            </div>
                            <p className="text-sm text-amber-700">
                                <strong>{email}</strong> 이메일로 가입된 계정이 있습니다.
                            </p>
                            <p className="text-sm text-amber-700 mt-1">
                                이 계정에 관리자 권한을 부여하시겠습니까?
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">이메일 *</Label>
                                <Input
                                    type="email"
                                    placeholder="admin@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="rounded-xl border-[#c3daee] focus:border-[#003366] focus:ring-[#003366]/20"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">이름</Label>
                                <Input
                                    type="text"
                                    placeholder="홍길동"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="rounded-xl border-[#c3daee] focus:border-[#003366] focus:ring-[#003366]/20"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">비밀번호 *</Label>
                                <Input
                                    type="password"
                                    placeholder="8자 이상"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="rounded-xl border-[#c3daee] focus:border-[#003366] focus:ring-[#003366]/20"
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 mt-2">
                        <Button
                            variant="outline"
                            onClick={resetForm}
                            disabled={loadingAction}
                            className="rounded-xl border-[#c3daee] text-gray-600 hover:bg-[#f0f5fa]"
                        >
                            취소
                        </Button>
                        {linkMode.active ? (
                            <Button
                                onClick={() => handleCreateOrLink(true)}
                                disabled={loadingAction}
                                className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white gap-2 transition-colors"
                            >
                                <LinkIcon className="w-4 h-4" />
                                권한 부여
                            </Button>
                        ) : (
                            <Button
                                onClick={() => handleCreateOrLink(false)}
                                disabled={loadingAction}
                                className="rounded-xl bg-[#003366] hover:bg-[#002244] text-white gap-2 transition-colors"
                            >
                                <UserPlus className="w-4 h-4" />
                                계정 생성
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
