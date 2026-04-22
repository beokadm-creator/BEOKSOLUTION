import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { MessageSquare, Save, Loader2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export const QnASettingsPanel = ({ confId }: { confId: string }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    enabled: false,
    startTime: '',
    endTime: ''
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, `conferences/${confId}/settings/qna_config`));
        if (snap.exists()) {
          setConfig(snap.data() as any);
        }
      } catch (error) {
        console.error('Error fetching QnA config:', error);
      } finally {
        setLoading(false);
      }
    };
    if (confId) fetchConfig();
  }, [confId]);

  const handleSave = async () => {
    if (config.enabled && (!config.startTime || !config.endTime)) {
      toast.error('활성화 시 시작 시간과 종료 시간은 필수입니다.');
      return;
    }
    
    setSaving(true);
    try {
      await setDoc(doc(db, `conferences/${confId}/settings/qna_config`), config, { merge: true });
      toast.success('Q&A 설정이 저장되었습니다.');
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
    <Card className="border-blue-100 shadow-sm">
      <CardHeader className="bg-blue-50/50 border-b border-blue-50">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-blue-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              실시간 Q&A 운영 설정
            </CardTitle>
            <CardDescription>
              디지털 명찰에서 실시간 Q&A 기능을 언제 노출할지 설정합니다.
            </CardDescription>
          </div>
          <Switch 
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
          />
        </div>
      </CardHeader>
      
      {config.enabled && (
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" /> 시작 일시 (KST)
              </Label>
              <Input 
                type="datetime-local" 
                value={config.startTime}
                onChange={e => setConfig({ ...config, startTime: e.target.value })}
              />
              <p className="text-xs text-slate-500">이 시간 이후에만 질문 등록 폼이 나타납니다.</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" /> 종료 일시 (KST)
              </Label>
              <Input 
                type="datetime-local" 
                value={config.endTime}
                onChange={e => setConfig({ ...config, endTime: e.target.value })}
              />
              <p className="text-xs text-slate-500">이 시간이 지나면 질문 등록 폼이 닫힙니다.</p>
            </div>
          </div>
        </CardContent>
      )}
      
      <div className="p-6 pt-0 flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          설정 저장
        </Button>
      </div>
    </Card>
  );
};