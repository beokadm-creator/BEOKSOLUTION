import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FileText, Save, Loader2, Image as ImageIcon, Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';

export const CertificateSettingsPanel = ({ confId }: { confId: string }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [config, setConfig] = useState({
    enabled: false,
    title: '학술대회 참가확인서',
    societyName: '',
    conferenceName: '',
    dateStr: '',
    location: '',
    stampImageUrl: '',
    showPaymentAmount: true,
    showLicenseNumber: true
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, `conferences/${confId}/settings/certificate_config`));
        if (snap.exists()) {
          setConfig(prev => ({ ...prev, ...snap.data() }));
        }
      } catch (error) {
        console.error('Error fetching certificate config:', error);
      } finally {
        setLoading(false);
      }
    };
    if (confId) fetchConfig();
  }, [confId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `stamp_${Date.now()}.${fileExt}`;
    const storageRef = ref(storage, `conferences/${confId}/assets/${fileName}`);

    try {
      setUploading(true);
      toast.loading('직인 이미지 업로드 중...', { id: 'upload' });
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      
      setConfig(prev => ({ ...prev, stampImageUrl: url }));
      toast.success('업로드 완료', { id: 'upload' });
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('업로드 실패', { id: 'upload' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (config.enabled && (!config.societyName || !config.conferenceName)) {
      toast.error('활성화 시 학회명과 학술대회명은 필수입니다.');
      return;
    }
    
    setSaving(true);
    try {
      await setDoc(doc(db, `conferences/${confId}/settings/certificate_config`), config, { merge: true });
      toast.success('참가확인서 설정이 저장되었습니다.');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" /></div>;
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-600" />
              참가확인서 (이수증) 설정
            </CardTitle>
            <CardDescription>
              결제 및 현장 체크인이 완료된 참가자가 디지털 명찰에서 다운로드할 수 있는 증빙 서류 템플릿입니다.
            </CardDescription>
          </div>
          <Switch 
            checked={config.enabled}
            onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
          />
        </div>
      </CardHeader>
      
      {config.enabled && (
        <CardContent className="p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>증명서 제목</Label>
              <Input 
                value={config.title}
                onChange={e => setConfig({ ...config, title: e.target.value })}
                placeholder="예: 학술대회 참가확인서"
              />
            </div>
            <div className="space-y-2">
              <Label>주최 학회명 *</Label>
              <Input 
                value={config.societyName}
                onChange={e => setConfig({ ...config, societyName: e.target.value })}
                placeholder="예: 대한소아청소년과학회"
              />
            </div>
            <div className="space-y-2">
              <Label>학술대회 공식 명칭 *</Label>
              <Input 
                value={config.conferenceName}
                onChange={e => setConfig({ ...config, conferenceName: e.target.value })}
                placeholder="예: 2024 추계 학술대회"
              />
            </div>
            <div className="space-y-2">
              <Label>개최 일자 표기</Label>
              <Input 
                value={config.dateStr}
                onChange={e => setConfig({ ...config, dateStr: e.target.value })}
                placeholder="예: 2024년 10월 15일(토) ~ 16일(일)"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>개최 장소 표기</Label>
              <Input 
                value={config.location}
                onChange={e => setConfig({ ...config, location: e.target.value })}
                placeholder="예: 서울 코엑스 컨벤션 센터"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h4 className="font-semibold text-slate-800">디스플레이 옵션 및 직인</h4>
            
            <div className="flex gap-8">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={config.showPaymentAmount}
                  onChange={e => setConfig({ ...config, showPaymentAmount: e.target.checked })}
                  className="rounded text-blue-600 w-4 h-4"
                />
                결제 금액 표기
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={config.showLicenseNumber}
                  onChange={e => setConfig({ ...config, showLicenseNumber: e.target.checked })}
                  className="rounded text-blue-600 w-4 h-4"
                />
                면허번호 표기
              </label>
            </div>

            <div className="space-y-2 mt-4">
              <Label className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-slate-500" /> 학회 직인(도장) 이미지 (투명 PNG 권장)
              </Label>
              {config.stampImageUrl && (
                <div className="mb-3">
                  <img src={config.stampImageUrl} alt="직인" className="w-24 h-24 object-contain border rounded-lg p-2 bg-white" />
                </div>
              )}
              <Input 
                type="file" 
                accept="image/png, image/jpeg" 
                onChange={handleFileUpload} 
                disabled={uploading}
              />
            </div>
          </div>
        </CardContent>
      )}
      
      <div className="p-6 pt-0 flex justify-end">
        <Button onClick={handleSave} disabled={saving || uploading} className="bg-slate-900 hover:bg-slate-800">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          참가확인서 설정 저장
        </Button>
      </div>
    </Card>
  );
};