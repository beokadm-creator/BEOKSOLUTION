import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Building2, Plus, Edit, Trash2, Save } from 'lucide-react';
import { useSuperAdminSociety } from '../hooks/useSuperAdminSociety';
import { Society } from '@/types/schema';

interface SocietyTabProps {
    societies: Society[];
    refreshSocieties: () => Promise<void>;
    createSociety: (id: string, nameKo: string, nameEn: string, adminEmail: string) => Promise<boolean>;
}

export const SocietyTab: React.FC<SocietyTabProps> = ({ societies, refreshSocieties, createSociety }) => {
    const {
        socNameKo, setSocNameKo,
        socNameEn, setSocNameEn,
        socAdmin, setSocAdmin,
        socDomainCode, setSocDomainCode,
        editingSoc, setEditingSoc,
        editDescKo, setEditDescKo,
        editHomepage, setEditHomepage,
        editDomainCode, setEditDomainCode,
        editAliases, setEditAliases,
        deletingSocietyId,
        handleCreateSociety,
        handleUpdateSociety,
        handleDeleteSociety
    } = useSuperAdminSociety(refreshSocieties, createSociety);

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
