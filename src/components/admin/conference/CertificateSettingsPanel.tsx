import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FileText, Save, Loader2, Image as ImageIcon, Award, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export const CertificateSettingsPanel = ({ confId, data }: { confId: string, data?: any }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [societyName, setSocietyName] = useState('');

  const [config, setConfig] = useState({
    // Shared
    stampImageUrl: '',
    showPaymentAmount: true,
    showLicenseNumber: true,
    
    // Attendance
    attendanceEnabled: false,
    attendanceTitle: '참가확인서',
    attendanceBgUrl: '',
    
    // Completion
    completionEnabled: false,
    completionTitle: '수료증',
    completionBgUrl: '',
    completionRequiredMinutes: 0
  });

  useEffect(() => {
    if (data?.societyId) {
      getDoc(doc(db, 'societies', data.societyId)).then(snap => {
        if (snap.exists()) {
          setSocietyName(snap.data().name?.ko || snap.data().name || '');
        }
      }).catch(console.error);
    }
  }, [data?.societyId]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, `conferences/${confId}/settings/certificate_config`));
        if (snap.exists()) {
          const d = snap.data();
          setConfig(prev => ({
            ...prev,
            stampImageUrl: d.stampImageUrl ?? prev.stampImageUrl,
            showPaymentAmount: d.showPaymentAmount ?? prev.showPaymentAmount,
            showLicenseNumber: d.showLicenseNumber ?? prev.showLicenseNumber,
            
            attendanceEnabled: d.attendanceEnabled ?? d.enabled ?? prev.attendanceEnabled,
            attendanceTitle: d.attendanceTitle ?? d.title ?? prev.attendanceTitle,
            attendanceBgUrl: d.attendanceBgUrl ?? d.backgroundImageUrl ?? prev.attendanceBgUrl,
            
            completionEnabled: d.completionEnabled ?? prev.completionEnabled,
            completionTitle: d.completionTitle ?? prev.completionTitle,
            completionBgUrl: d.completionBgUrl ?? prev.completionBgUrl,
            completionRequiredMinutes: d.completionRequiredMinutes ?? prev.completionRequiredMinutes
          }));
        }
      } catch (error) {
        console.error('Error fetching certificate config:', error);
      } finally {
        setLoading(false);
      }
    };
    if (confId) fetchConfig();
  }, [confId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'stamp' | 'attendanceBg' | 'completionBg') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${type}_${Date.now()}.${fileExt}`;
    const storageRef = ref(storage, `conferences/${confId}/assets/${fileName}`);

    try {
      setUploading(true);
      toast.loading('이미지 업로드 중...', { id: 'upload' });
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      
      setConfig(prev => {
        if (type === 'stamp') return { ...prev, stampImageUrl: url };
        if (type === 'attendanceBg') return { ...prev, attendanceBgUrl: url };
        if (type === 'completionBg') return { ...prev, completionBgUrl: url };
        return prev;
      });
      toast.success('업로드 완료', { id: 'upload' });
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('업로드 실패', { id: 'upload' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saveData = {
        ...config,
        enabled: config.attendanceEnabled || config.completionEnabled
      };
      await setDoc(doc(db, `conferences/${confId}/settings/certificate_config`), saveData, { merge: true });
      toast.success('증명서 설정이 저장되었습니다.');
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

  const autoConferenceName = data?.title?.ko || '';
  const autoDateStr = (data?.dates?.start && data?.dates?.end) 
    ? `${data.dates.start.includes('T') ? data.dates.start.split('T')[0] : data.dates.start} ~ ${data.dates.end.includes('T') ? data.dates.end.split('T')[0] : data.dates.end}` 
    : '';
  const autoLocation = data?.venue?.name?.ko || '';

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-600" />
              증명서 발급 설정 (참가확인서 / 수료증)
            </CardTitle>
            <CardDescription>
              학술대회 참석자를 위한 참가확인서와 일정 수강시간을 충족한 사람을 위한 수료증을 분리하여 관리합니다.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-10">
        <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
          <h4 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-600" />
            자동 입력 정보 (읽기 전용)
          </h4>
          <p className="text-xs text-blue-700 mb-4">
            아래 정보는 학술대회 일반 설정에서 가져오며, 증명서에 자동으로 렌더링됩니다.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><span className="font-semibold text-slate-600">주최 학회명:</span> <span className="text-slate-900">{societyName || '-'}</span></div>
            <div><span className="font-semibold text-slate-600">학술대회 명칭:</span> <span className="text-slate-900">{autoConferenceName || '-'}</span></div>
            <div><span className="font-semibold text-slate-600">개최 일자:</span> <span className="text-slate-900">{autoDateStr || '-'}</span></div>
            <div><span className="font-semibold text-slate-600">개최 장소:</span> <span className="text-slate-900">{autoLocation || '-'}</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="border border-slate-200 rounded-xl p-5 space-y-5 bg-white">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" /> 참가확인서
                </h4>
                <p className="text-xs text-slate-500 mt-1">현장 체크인을 완료한 모든 등록자 대상</p>
              </div>
              <Switch 
                checked={config.attendanceEnabled}
                onCheckedChange={(checked) => setConfig({ ...config, attendanceEnabled: checked })}
              />
            </div>
            
            {config.attendanceEnabled && (
              <>
                <div className="space-y-2">
                  <Label>증명서 제목</Label>
                  <Input 
                    value={config.attendanceTitle}
                    onChange={e => setConfig({ ...config, attendanceTitle: e.target.value })}
                    placeholder="예: 참가확인서"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-slate-500" /> 배경 이미지 (A4 가로)
                  </Label>
                  {config.attendanceBgUrl && (
                    <div className="mb-3 relative inline-block">
                      <img src={config.attendanceBgUrl} alt="배경" className="w-48 h-32 object-cover border rounded-lg p-1 bg-slate-50" />
                      <Button variant="destructive" size="sm" className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full" onClick={() => setConfig({...config, attendanceBgUrl: ''})}>×</Button>
                    </div>
                  )}
                  <Input type="file" accept="image/png, image/jpeg" onChange={(e) => handleFileUpload(e, 'attendanceBg')} disabled={uploading} />
                </div>
              </>
            )}
          </div>

          <div className="border border-slate-200 rounded-xl p-5 space-y-5 bg-white">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                  <Award className="w-4 h-4 text-purple-600" /> 수료증 (이수증)
                </h4>
                <p className="text-xs text-slate-500 mt-1">지정된 수강 시간을 모두 충족한 참석자 대상</p>
              </div>
              <Switch 
                checked={config.completionEnabled}
                onCheckedChange={(checked) => setConfig({ ...config, completionEnabled: checked })}
              />
            </div>

            {config.completionEnabled && (
              <>
                <div className="space-y-2">
                  <Label>증명서 제목</Label>
                  <Input 
                    value={config.completionTitle}
                    onChange={e => setConfig({ ...config, completionTitle: e.target.value })}
                    placeholder="예: 연수교육 이수증"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-purple-700 font-semibold">필수 수강 시간 (분)</Label>
                  <Input 
                    type="number"
                    value={config.completionRequiredMinutes}
                    onChange={e => setConfig({ ...config, completionRequiredMinutes: parseInt(e.target.value) || 0 })}
                    placeholder="예: 120"
                    className="border-purple-200 bg-purple-50/30 focus-visible:ring-purple-500"
                  />
                  <p className="text-[10px] text-slate-400">누적 체류 시간이 이 기준을 넘어야 다운로드가 활성화됩니다.</p>
                </div>
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <Label className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-slate-500" /> 배경 이미지 (A4 가로)
                  </Label>
                  {config.completionBgUrl && (
                    <div className="mb-3 relative inline-block">
                      <img src={config.completionBgUrl} alt="배경" className="w-48 h-32 object-cover border rounded-lg p-1 bg-slate-50" />
                      <Button variant="destructive" size="sm" className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full" onClick={() => setConfig({...config, completionBgUrl: ''})}>×</Button>
                    </div>
                  )}
                  <Input type="file" accept="image/png, image/jpeg" onChange={(e) => handleFileUpload(e, 'completionBg')} disabled={uploading} />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-5">
          <h4 className="font-semibold text-slate-800">공통 디스플레이 옵션 및 직인</h4>
          <div className="flex gap-8 pb-4 border-b border-slate-200/60">
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
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-slate-500" /> 학회 직인(도장) 이미지 (투명 PNG 권장)
            </Label>
            {config.stampImageUrl && (
              <div className="mb-3 relative inline-block">
                <img src={config.stampImageUrl} alt="직인" className="w-24 h-24 object-contain border rounded-lg p-2 bg-white" />
                <Button variant="destructive" size="sm" className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full" onClick={() => setConfig({...config, stampImageUrl: ''})}>×</Button>
              </div>
            )}
            <Input type="file" accept="image/png, image/jpeg" onChange={(e) => handleFileUpload(e, 'stamp')} disabled={uploading} />
          </div>
        </div>

      </CardContent>
      
      <div className="p-6 pt-0 flex justify-end">
        <Button onClick={handleSave} disabled={saving || uploading} className="bg-slate-900 hover:bg-slate-800">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          증명서 설정 저장
        </Button>
      </div>
    </Card>
  );
};