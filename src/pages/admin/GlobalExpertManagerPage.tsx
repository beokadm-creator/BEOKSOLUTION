import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/firebase';
import { GlobalExpert } from '@/types/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Plus, Pencil, Trash2, Search, Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

const GlobalExpertManagerPage = () => {
    const [experts, setExperts] = useState<GlobalExpert[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpert, setEditingExpert] = useState<Partial<GlobalExpert> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchExperts();
    }, []);

    const fetchExperts = async () => {
        try {
            setLoading(true);
            const querySnapshot = await getDocs(collection(db, 'global_experts'));
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GlobalExpert));
            // Sort by created date descending
            data.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
            setExperts(data);
        } catch (error) {
            console.error('Error fetching experts:', error);
            toast.error('연자 목록을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'cv') => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const storageRef = ref(storage, `experts/${type}/${fileName}`);

        try {
            toast.loading(`${type === 'photo' ? '사진' : 'CV'} 업로드 중...`, { id: 'upload' });
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);
            
            setEditingExpert(prev => ({
                ...prev,
                [type === 'photo' ? 'photoUrl' : 'cvUrl']: url
            }));
            
            toast.success('업로드 완료', { id: 'upload' });
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('업로드 실패', { id: 'upload' });
        }
    };

    const handleSave = async () => {
        if (!editingExpert?.name?.ko || !editingExpert?.email) {
            toast.error('이름(국문)과 이메일은 필수입니다.');
            return;
        }

        try {
            setIsSaving(true);
            const isNew = !editingExpert.id;
            const expertId = editingExpert.id || `expert_${Date.now()}`;
            const expertRef = doc(db, 'global_experts', expertId);

            const payload: any = {
                ...editingExpert,
                updatedAt: Timestamp.now()
            };

            if (isNew) {
                payload.id = expertId;
                payload.createdAt = Timestamp.now();
                payload.isPublic = payload.isPublic ?? false;
            }

            await setDoc(expertRef, payload, { merge: true });
            toast.success('저장되었습니다.');
            setIsModalOpen(false);
            fetchExperts();
        } catch (error) {
            console.error('Save error:', error);
            toast.error('저장에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('정말 이 연자 정보를 삭제하시겠습니까? 삭제해도 기존 학술대회에 복사된 정보는 유지됩니다.')) return;
        
        try {
            await deleteDoc(doc(db, 'global_experts', id));
            toast.success('삭제되었습니다.');
            setExperts(prev => prev.filter(e => e.id !== id));
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('삭제에 실패했습니다.');
        }
    };

    const filteredExperts = experts.filter(e => 
        e.name?.ko?.includes(searchQuery) || 
        e.name?.en?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.organization?.includes(searchQuery) ||
        e.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Users className="w-6 h-6 text-blue-600" />
                        글로벌 인명사전 (Experts Directory)
                    </h1>
                    <p className="text-slate-500 mt-1">
                        전체 학술대회에서 공통으로 사용할 연자/전문가 풀을 관리합니다.
                    </p>
                </div>
                <Button onClick={() => {
                    setEditingExpert({ name: { ko: '', en: '' }, isPublic: false });
                    setIsModalOpen(true);
                }}>
                    <Plus className="w-4 h-4 mr-2" />
                    새 연자 등록
                </Button>
            </div>

            <Card>
                <CardContent className="p-6">
                    <div className="flex gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input 
                                placeholder="이름, 소속, 이메일로 검색..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-12 text-slate-500">데이터를 불러오는 중입니다...</div>
                    ) : filteredExperts.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">등록된 연자가 없습니다.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-sm">
                                        <th className="p-4 font-semibold text-slate-600">이름</th>
                                        <th className="p-4 font-semibold text-slate-600">소속</th>
                                        <th className="p-4 font-semibold text-slate-600">연락처 / 이메일</th>
                                        <th className="p-4 font-semibold text-slate-600">외부 공개</th>
                                        <th className="p-4 font-semibold text-slate-600 text-right">관리</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredExperts.map(expert => (
                                        <tr key={expert.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                                                        {expert.photoUrl ? (
                                                            <img src={expert.photoUrl} alt="profile" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Users className="w-5 h-5 m-2.5 text-slate-400" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-slate-900">{expert.name?.ko}</div>
                                                        <div className="text-xs text-slate-500">{expert.name?.en}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-slate-700">{expert.organization || '-'}</td>
                                            <td className="p-4 text-sm">
                                                <div className="text-slate-900">{expert.email}</div>
                                                <div className="text-slate-500 text-xs">{expert.phone}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${expert.isPublic ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {expert.isPublic ? '공개' : '비공개'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => {
                                                        setEditingExpert(expert);
                                                        setIsModalOpen(true);
                                                    }}>
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(expert.id)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingExpert?.id ? '연자 정보 수정' : '새 연자 등록'}</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                        <div className="space-y-4">
                            <div>
                                <Label>이름 (국문) *</Label>
                                <Input 
                                    value={editingExpert?.name?.ko || ''} 
                                    onChange={e => setEditingExpert(prev => ({ ...prev, name: { ...prev?.name, ko: e.target.value } }))}
                                />
                            </div>
                            <div>
                                <Label>이름 (영문)</Label>
                                <Input 
                                    value={editingExpert?.name?.en || ''} 
                                    onChange={e => setEditingExpert(prev => ({ ...prev, name: { ...prev?.name, en: e.target.value } }))}
                                />
                            </div>
                            <div>
                                <Label>이메일 * (고유 식별자)</Label>
                                <Input 
                                    type="email"
                                    value={editingExpert?.email || ''} 
                                    onChange={e => setEditingExpert(prev => ({ ...prev, email: e.target.value }))}
                                />
                            </div>
                            <div>
                                <Label>연락처</Label>
                                <Input 
                                    value={editingExpert?.phone || ''} 
                                    onChange={e => setEditingExpert(prev => ({ ...prev, phone: e.target.value }))}
                                />
                            </div>
                            <div>
                                <Label>면허번호</Label>
                                <Input 
                                    value={editingExpert?.licenseNumber || ''} 
                                    onChange={e => setEditingExpert(prev => ({ ...prev, licenseNumber: e.target.value }))}
                                />
                            </div>
                            <div>
                                <Label>소속</Label>
                                <Input 
                                    value={editingExpert?.organization || ''} 
                                    onChange={e => setEditingExpert(prev => ({ ...prev, organization: e.target.value }))}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Label>주요 약력 (Bio)</Label>
                                <textarea 
                                    className="w-full mt-1 p-2 border rounded-md min-h-[100px]"
                                    value={editingExpert?.bio?.ko || ''}
                                    placeholder="국문 약력..."
                                    onChange={e => setEditingExpert(prev => ({ ...prev, bio: { ...prev?.bio, ko: e.target.value } }))}
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <Label className="block mb-2">프로필 사진</Label>
                                {editingExpert?.photoUrl && (
                                    <div className="mb-2">
                                        <img src={editingExpert.photoUrl} alt="Profile" className="w-24 h-24 object-cover rounded-lg border" />
                                    </div>
                                )}
                                <Input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'photo')} />
                            </div>

                            <div>
                                <Label className="block mb-2">CV (이력서) 파일</Label>
                                {editingExpert?.cvUrl && (
                                    <a href={editingExpert.cvUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline mb-2">
                                        <LinkIcon className="w-4 h-4" />
                                        현재 등록된 CV 보기
                                    </a>
                                )}
                                <Input type="file" accept=".pdf,.doc,.docx" onChange={e => handleFileUpload(e, 'cv')} />
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                <div>
                                    <Label className="text-base font-semibold">외부 API 공개 허용</Label>
                                    <p className="text-sm text-slate-500">타 시스템(상장 발급 등)에서 이 정보를 조회할 수 있습니다.</p>
                                </div>
                                <Switch 
                                    checked={editingExpert?.isPublic || false}
                                    onCheckedChange={checked => setEditingExpert(prev => ({ ...prev, isPublic: checked }))}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>취소</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? '저장 중...' : '저장하기'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default GlobalExpertManagerPage;