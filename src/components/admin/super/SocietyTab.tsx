import React, { useState } from 'react';
import { doc, updateDoc, getDoc, getDocs, collection, query, where, limit, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import toast from 'react-hot-toast';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../ui/card';
import { Building2, Plus, Edit, Trash2, Save } from 'lucide-react';
import { useSuperAdmin } from '../../../hooks/useSuperAdmin';

export const SocietyTab: React.FC = () => {
    const { societies, createSociety, refreshSocieties } = useSuperAdmin();

    const [socNameKo, setSocNameKo] = useState('');
    const [socNameEn, setSocNameEn] = useState('');
    const [socAdmin, setSocAdmin] = useState('');
    const [socDomainCode, setSocDomainCode] = useState('');

    const [editingSoc, setEditingSoc] = useState<{ id: string; name: { ko: string; en?: string }; description?: { ko?: string }; homepageUrl?: string; adminEmails?: string[]; domainCode?: string; aliases?: string[] } | null>(null);
    const [editDescKo, setEditDescKo] = useState('');
    const [editHomepage, setEditHomepage] = useState('');
    const [editDomainCode, setEditDomainCode] = useState('');
    const [editAliases, setEditAliases] = useState('');
    const [deletingSocietyId, setDeletingSocietyId] = useState<string | null>(null);

    const handleCreateSociety = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!socNameKo) return toast.error("사회명 (한글) 필수");
        if (!socAdmin) return toast.error("관리자 이메일 필수");
        if (!socNameEn) return toast.error("사회명 (영어) 필수");

        const toastId = toast.loading("Creating society...");
        const computedId = socNameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const societyId = (socDomainCode || computedId).toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
        if (!societyId) {
            toast.error("유효한 학회 도메인 코드(sid)를 입력하세요.", { id: toastId });
            return;
        }
        try {
            await createSociety(societyId, socNameKo, socNameEn, socAdmin);
            toast.success("Society created.", { id: toastId });
            setSocNameKo('');
            setSocNameEn('');
            setSocAdmin('');
            setSocDomainCode('');
        } catch (e) {
            console.error("Create Society Error:", e);
            toast.error(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: toastId });
        }
    };

    const handleUpdateSociety = async (societyId: string) => {
        const toastId = toast.loading("Updating society...");
        try {
            const societyRef = doc(db, 'societies', societyId);
            await updateDoc(societyRef, {
                name: { ko: editDescKo },
                description: { ko: editDescKo },
                homepageUrl: editHomepage,
                domainCode: (editDomainCode || societyId).toLowerCase().trim(),
                aliases: Array.from(
                    new Set(
                        editAliases
                            .split(',')
                            .map((a) => a.trim().toLowerCase())
                            .filter(Boolean)
                    )
                )
            });
            toast.success("Updated.", { id: toastId });
            setEditingSoc(null);
            setEditDescKo('');
            setEditHomepage('');
            setEditDomainCode('');
            setEditAliases('');
            await refreshSocieties();
        } catch (e) {
            console.error("Update Society Error:", e);
            toast.error(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: toastId });
        }
    };

    const handleDeleteSociety = async (societyId: string, societyName: string) => {
        const safetyCode = `DELETE ${societyId}`;
        const confirmed = window.confirm(
            `"${societyName}" 학회를 삭제하시겠습니까?\n\n주의: 삭제 후 복구할 수 없습니다.\n연결 데이터가 없는 경우에만 삭제됩니다.`
        );
        if (!confirmed) return;
        const typed = window.prompt(`2차 확인: 아래 문구를 정확히 입력하세요.\n${safetyCode}`);
        if (typed !== safetyCode) {
            toast.error('2차 확인 문구가 일치하지 않아 삭제를 취소했습니다.');
            return;
        }

        setDeletingSocietyId(societyId);
        const toastId = toast.loading("학회 삭제 준비 중...");
        try {
            const societySnap = await getDoc(doc(db, 'societies', societyId));
            const societyData = societySnap.exists() ? societySnap.data() as { domainCode?: string } : {};
            const domainCode = (societyData.domainCode || societyId).toLowerCase();
            const societyKeys = Array.from(new Set([societyId, domainCode].filter(Boolean)));
            const confSnap = await getDocs(
                societyKeys.length === 1
                    ? query(collection(db, 'conferences'), where('societyId', '==', societyKeys[0]), limit(1))
                    : query(collection(db, 'conferences'), where('societyId', 'in', societyKeys.slice(0, 10)), limit(1))
            );
            if (!confSnap.empty) {
                toast.error('연결된 학술대회가 있어 삭제할 수 없습니다. 먼저 학술대회 정리 후 다시 시도하세요.', { id: toastId });
                setDeletingSocietyId(null);
                return;
            }

            const codeSnap = await getDocs(collection(db, 'societies', societyId, 'verification_codes'));
            if (!codeSnap.empty) {
                await Promise.all(codeSnap.docs.map((d) => deleteDoc(d.ref)));
            }

            await deleteDoc(doc(db, 'societies', societyId));
            if (editingSoc?.id === societyId) {
                setEditingSoc(null);
            }
            await refreshSocieties();
            toast.success('학회가 삭제되었습니다.', { id: toastId });
        } catch (e) {
            console.error("Delete Society Error:", e);
            toast.error(`삭제 실패: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: toastId });
        } finally {
            setDeletingSocietyId(null);
        }
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-t-4 border-t-[#fbbf24]">
                <CardHeader className="pb-4">
                    <CardTitle className="text-xl flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-[#fbbf24]" /> Create Society
                    </CardTitle>
                    <CardDescription>Add new professional societies to the platform</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <form onSubmit={handleCreateSociety} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">사회명 (한글)</Label>
                                <Input value={socNameKo} onChange={e => setSocNameKo(e.target.value)} className="bg-white border-slate-300 focus:border-[#fbbf24]" placeholder="예: 한국기계정보학회" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">사회명 (영어)</Label>
                                <Input value={socNameEn} onChange={e => setSocNameEn(e.target.value)} className="bg-white border-slate-300 focus:border-[#fbbf24]" placeholder="Optional: Korea Association..." />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">관리자 이메일</Label>
                                <Input type="email" value={socAdmin} onChange={e => setSocAdmin(e.target.value)} className="bg-white border-slate-300 focus:border-[#fbbf24]" placeholder="admin@society.org" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">학회 도메인 코드 (sid)</Label>
                                <Input
                                    value={socDomainCode}
                                    onChange={e => setSocDomainCode(e.target.value.toLowerCase())}
                                    className="bg-white border-slate-300 focus:border-[#fbbf24]"
                                    placeholder="예: kaid"
                                />
                            </div>
                        </div>
                        <Button type="submit" className="w-full bg-[#fbbf24] hover:bg-[#e0a520] text-black font-bold">
                            <Plus className="w-4 h-4 mr-2" /> Create Society
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Existing Societies</CardTitle>
                    <CardDescription>Manage professional societies</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {societies.map(s => (
                            <div key={s.id} className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                                <div className="flex-1">
                                    <div className="font-semibold text-slate-900">{s.name.ko}</div>
                                    <div className="text-xs text-slate-500">ID: {s.id} / Domain: {(s as { domainCode?: string }).domainCode || '-'}</div>
                                    <div className="text-xs text-slate-500">{s.adminEmails.join(', ')}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900" onClick={() => {
                                        setEditingSoc({ id: s.id, name: s.name, description: s.description, homepageUrl: s.homepageUrl, adminEmails: s.adminEmails, domainCode: (s as { domainCode?: string }).domainCode, aliases: (s as { aliases?: string[] }).aliases });
                                        setEditDescKo(s.name.ko);
                                        setEditHomepage(s.homepageUrl || '');
                                        setEditDomainCode(((s as { domainCode?: string }).domainCode || s.id).toLowerCase());
                                        setEditAliases(((s as { aliases?: string[] }).aliases || []).join(', '));
                                    }}>
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-400 hover:text-red-300"
                                        disabled={deletingSocietyId === s.id}
                                        onClick={() => handleDeleteSociety(s.id, s.name.ko)}
                                        title="Delete Society"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {societies.length === 0 && (
                            <div className="text-center py-12 text-slate-500">
                                <Building2 className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                <p>No societies yet. Create one above.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {editingSoc && (
                <Card className="shadow-lg border-t-4 border-t-blue-600">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Edit className="w-5 h-5 text-blue-600" /> Edit Society
                        </CardTitle>
                        <CardDescription>Update society details</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">사회명</Label>
                                <Input value={editDescKo} onChange={e => setEditDescKo(e.target.value)} className="bg-white" placeholder="사회명 입력" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">홈페이지 URL</Label>
                                <Input value={editHomepage} onChange={e => setEditHomepage(e.target.value)} className="bg-white" placeholder="https://..." />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">Domain Code (sid)</Label>
                                <Input value={editDomainCode} onChange={e => setEditDomainCode(e.target.value.toLowerCase())} className="bg-white" placeholder="예: kaid" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">Aliases (comma separated)</Label>
                                <Input value={editAliases} onChange={e => setEditAliases(e.target.value)} className="bg-white" placeholder="예: kaid, k-a-i-d" />
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={() => handleUpdateSociety(editingSoc.id)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex-1">
                                    <Save className="w-4 h-4 mr-2" /> Save Changes
                                </Button>
                                <Button onClick={() => { setEditingSoc(null); setEditDomainCode(''); setEditAliases(''); }} variant="outline">
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
