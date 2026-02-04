import React, { useState, useEffect } from 'react';
import { useAdminStore } from '../../store/adminStore';
import { Sponsor, SponsorDoc, SponsorTier } from '../../types/schema';
import { Timestamp, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, deleteField } from 'firebase/firestore';
import { db } from '../../firebase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent } from '../../components/ui/card';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ImageUpload from '../../components/ui/ImageUpload';
import toast from 'react-hot-toast';
import { Plus, Save, Trash2, ArrowUp, ArrowDown, Building2, ExternalLink, Eye, EyeOff } from 'lucide-react';

const SponsorManager: React.FC = () => {
  const { selectedConferenceId: confId } = useAdminStore();

  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [selectedSponsorId, setSelectedSponsorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [form, setForm] = useState<Partial<SponsorDoc>>({
    isActive: true,
    // tier: undefined by default (no tier)
  });

  // Fetch sponsors
  const fetchSponsors = async () => {
    if (!confId) return;
    setLoading(true);
    try {
      const spRef = collection(db, `conferences/${confId}/sponsors`);
      const spSnap = await getDocs(spRef);
      const list = spSnap.docs.map(d => ({ id: d.id, ...d.data() } as Sponsor));
      list.sort((a, b) => (a.order || 999) - (b.order || 999));
      setSponsors(list);
    } catch (error) {
      console.error('Failed to fetch sponsors:', error);
      toast.error('스폰서 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSponsors();
  }, [confId]);

  // Reset form
  const resetForm = () => {
    setForm({
      isActive: true,
      order: sponsors.length > 0 ? Math.max(...sponsors.map(s => s.order || 0)) + 1 : 1,
      // tier: undefined by default (no tier)
    });
    setSelectedSponsorId(null);
  };

  // Select sponsor
  const selectSponsor = (sponsor: Sponsor) => {
    setSelectedSponsorId(sponsor.id);
    setForm({ ...sponsor });
  };

  // Save sponsor
  const handleSave = async () => {
    if (!confId) return toast.error('컨퍼런스를 선택해주세요.');
    if (!form.name?.trim()) return toast.error('스폰서명을 입력해주세요.');
    if (!form.logoUrl?.trim()) return toast.error('로고 이미지를 업로드해주세요.');
    if (!form.websiteUrl?.trim()) return toast.error('웹사이트 URL을 입력해주세요.');

    setLoading(true);
    try {
      const now = Timestamp.now();
      
      // Build data object without undefined fields (Firestore doesn't accept undefined)
      const data: Record<string, unknown> = {
        name: form.name.trim(),
        logoUrl: form.logoUrl.trim(),
        description: form.description?.trim() || '',
        websiteUrl: form.websiteUrl.trim(),
        order: form.order ?? sponsors.length + 1,
        isActive: form.isActive ?? true,
        createdAt: form.createdAt || now,
        updatedAt: now,
      };

      // Handle tier field: include if defined, delete if undefined/empty
      if (form.tier) {
        data.tier = form.tier;
      }

      if (selectedSponsorId) {
        // Update existing document
        const docRef = doc(db, `conferences/${confId}/sponsors`, selectedSponsorId);
        
        // Check if we need to remove the tier field
        const existingSponsor = sponsors.find(s => s.id === selectedSponsorId);
        if (existingSponsor && existingSponsor.tier && !form.tier) {
          // Tier exists in DB but being removed -> use deleteField()
          data.tier = deleteField();
        }
        
        await updateDoc(docRef, data);
        toast.success('스폰서 정보가 수정되었습니다.');
      } else {
        // Create new document
        const newRef = doc(collection(db, `conferences/${confId}/sponsors`));
        await setDoc(newRef, data);
        toast.success('새 스폰서가 추가되었습니다.');
      }

      await fetchSponsors();
      resetForm();
    } catch (error) {
      console.error('Failed to save sponsor:', error);
      toast.error('저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Delete sponsor
  const handleDelete = async (id: string) => {
    if (!window.confirm('정말 이 스폰서를 삭제하시겠습니까?')) return;

    setLoading(true);
    try {
      const docRef = doc(db, `conferences/${confId}/sponsors`, id);
      await deleteDoc(docRef);
      toast.success('스폰서가 삭제되었습니다.');

      if (selectedSponsorId === id) {
        resetForm();
      }

      await fetchSponsors();
    } catch (error) {
      console.error('Failed to delete sponsor:', error);
      toast.error('삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Reorder sponsor
  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sponsors.length) return;

    const sponsor1 = sponsors[index];
    const sponsor2 = sponsors[newIndex];

    // Swap orders
    const batch = writeBatch(db);
    const ref1 = doc(db, `conferences/${confId}/sponsors`, sponsor1.id);
    const ref2 = doc(db, `conferences/${confId}/sponsors`, sponsor2.id);

    batch.update(ref1, { order: sponsor2.order || newIndex });
    batch.update(ref2, { order: sponsor1.order || index });

    await batch.commit();
    toast.success('순서가 변경되었습니다.');
    await fetchSponsors();
  };

  if (!confId) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">컨퍼런스를 선택해주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">스폰서 관리</h2>
          <p className="text-slate-500">컨퍼런스 스폰서 정보를 관리합니다.</p>
        </div>
        <Button onClick={resetForm} className="gap-2">
          <Plus className="w-4 h-4" />
          새 스폰서 추가
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sponsor List */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-semibold text-slate-900">스폰서 목록 ({sponsors.length})</h3>

          {loading && sponsors.length === 0 ? (
            <LoadingSpinner />
          ) : sponsors.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-slate-500">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>등록된 스폰서가 없습니다.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sponsors.map((sponsor, index) => (
                <Card
                  key={sponsor.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedSponsorId === sponsor.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => selectSponsor(sponsor)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Logo */}
                      <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        {sponsor.logoUrl ? (
                          <img src={sponsor.logoUrl} alt={sponsor.name} className="max-w-full max-h-full object-contain" />
                        ) : (
                          <Building2 className="w-8 h-8 text-slate-300" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-slate-900 truncate">{sponsor.name}</h4>
                          {!sponsor.isActive && <EyeOff className="w-4 h-4 text-slate-400" />}
                        </div>
                        <p className="text-xs text-slate-500 mb-2">{sponsor.tier}</p>

                        {/* Reorder buttons */}
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReorder(index, 'up');
                            }}
                            disabled={index === 0}
                          >
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReorder(index, 'down');
                            }}
                            disabled={index === sponsors.length - 1}
                          >
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-red-600 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(sponsor.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Edit Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-slate-900 mb-6">
                {selectedSponsorId ? '스폰서 수정' : '새 스폰서 추가'}
              </h3>

              <div className="space-y-6">
                {/* Name */}
                <div>
                  <Label htmlFor="name">스폰서명 *</Label>
                  <Input
                    id="name"
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="예: ABC Company"
                  />
                </div>

                {/* Logo */}
                <div>
                  <Label>로고 이미지 *</Label>
                  <ImageUpload
                    path={`conferences/${confId}/sponsors`}
                    onUploadComplete={(url) => setForm({ ...form, logoUrl: url })}
                    previewUrl={form.logoUrl}
                    label="로고 이미지 업로드"
                  />
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor="description">한 줄 소개</Label>
                  <Textarea
                    id="description"
                    value={form.description || ''}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="스폰서에 대한 간단한 소개"
                    rows={2}
                  />
                </div>

                {/* Website URL */}
                <div>
                  <Label htmlFor="website">웹사이트 URL *</Label>
                  <Input
                    id="website"
                    type="url"
                    value={form.websiteUrl || ''}
                    onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>

                {/* Tier & Order */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tier">등급 (선택사항)</Label>
                    <select
                      id="tier"
                      value={form.tier || ''}
                      onChange={(e) => setForm({ ...form, tier: e.target.value === '' ? undefined : e.target.value as SponsorTier })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">등급 미지정</option>
                      <option value="PLATINUM">플래티넘</option>
                      <option value="GOLD">골드</option>
                      <option value="SILVER">실버</option>
                      <option value="BRONZE">브론즈</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">등급을 지정하지 않으면 모든 스폰서가 동일하게 표시됩니다.</p>
                  </div>

                  <div>
                    <Label htmlFor="order">표시 순서</Label>
                    <Input
                      id="order"
                      type="number"
                      value={form.order || ''}
                      onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 1 })}
                      min="1"
                    />
                  </div>
                </div>

                {/* Active */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={form.isActive ?? true}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <Label htmlFor="isActive" className="cursor-pointer">
                    활성화 (체크 해제 시 숨김)
                  </Label>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button onClick={handleSave} disabled={loading} className="flex-1 gap-2">
                    <Save className="w-4 h-4" />
                    {selectedSponsorId ? '수정' : '추가'}
                  </Button>
                  {selectedSponsorId && (
                    <Button variant="outline" onClick={resetForm} disabled={loading}>
                      취소
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SponsorManager;
