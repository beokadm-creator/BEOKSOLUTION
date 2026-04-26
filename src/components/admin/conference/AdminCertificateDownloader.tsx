import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

interface AdminCertificateDownloaderProps {
  confId: string;
  ui: {
    name: string;
    aff: string;
    license?: string;
    amount?: number;
    baseMinutes?: number;
  };
  certificateId: string;
  certificateNumber: string;
  verificationToken: string;
}

const VERIFICATION_BASE_URL =
  'https://us-central1-eregi-8fc1e.cloudfunctions.net/verifyCertificatePublic';

export const AdminCertificateDownloader: React.FC<AdminCertificateDownloaderProps> = ({ 
  confId, 
  ui, 
  certificateNumber, 
  verificationToken 
}) => {
  const [config, setConfig] = useState<Record<string, any> | null>(null);
  const [confInfo, setConfInfo] = useState<Record<string, any> | null>(null);
  const [societyName, setSocietyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const attendanceRef = useRef<HTMLDivElement>(null);
  const completionRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState<'attendance'|'completion'>('attendance');

  const verificationUrl = verificationToken ? `${VERIFICATION_BASE_URL}?token=${verificationToken}` : null;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [configSnap, confSnap] = await Promise.all([
          getDoc(doc(db, `conferences/${confId}/settings/certificate_config`)),
          getDoc(doc(db, 'conferences', confId))
        ]);
        
        if (configSnap.exists()) {
          setConfig(configSnap.data());
        }
        
        if (confSnap.exists()) {
          const cData = confSnap.data();
          setConfInfo(cData);
          if (cData.societyId) {
            const socSnap = await getDoc(doc(db, 'societies', cData.societyId));
            if (socSnap.exists()) {
              setSocietyName(socSnap.data().name?.ko || socSnap.data().name || '');
            }
          }
        }
      } catch (err) {
        console.error('Failed to load certificate data', err);
      } finally {
        setLoading(false);
      }
    };
    if (isOpen && !config) {
      fetchData();
    }
  }, [confId, isOpen, config]);

  useEffect(() => {
    if (config) {
      if (config.attendanceEnabled && !config.completionEnabled) setActiveTab('attendance');
      else if (!config.attendanceEnabled && config.completionEnabled) setActiveTab('completion');
    }
  }, [config]);

  const handleDownload = async (type: 'attendance' | 'completion') => {
    const targetRef = type === 'attendance' ? attendanceRef : completionRef;
    if (!targetRef.current) return;
    
    setGenerating(true);
    toast.loading('증명서를 생성하고 있습니다...', { id: 'admin-cert' });

    try {
      const canvas = await html2canvas(targetRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${ui.name}_${type === 'attendance' ? '참가확인서' : '수료증'}(관리자).pdf`);
      
      toast.success('다운로드가 완료되었습니다.', { id: 'admin-cert' });
    } catch (err) {
      console.error('Certificate generation failed', err);
      toast.error('생성에 실패했습니다.', { id: 'admin-cert' });
    } finally {
      setGenerating(false);
    }
  };

  const autoConferenceName = confInfo?.title?.ko || '';

  const formatDateString = (dateVal: any) => {
    if (!dateVal) return '';
    if (typeof dateVal === 'object' && dateVal.seconds !== undefined) {
      // Handle Firestore Timestamp or serialized Timestamp
      const d = new Date(dateVal.seconds * 1000);
      const offset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - offset).toISOString().split('T')[0];
    }
    if (typeof dateVal === 'string') {
      return dateVal.includes('T') ? dateVal.split('T')[0] : dateVal;
    }
    return String(dateVal);
  };

  const autoDateStr = (confInfo?.dates?.start && confInfo?.dates?.end) 
    ? `${formatDateString(confInfo.dates.start)} ~ ${formatDateString(confInfo.dates.end)}` 
    : '';
  const autoLocation = confInfo?.venue?.name?.ko || '';

  const renderCertificate = (type: 'attendance' | 'completion') => {
    const ref = type === 'attendance' ? attendanceRef : completionRef;
    const title = type === 'attendance' 
      ? (config?.attendanceTitle || config?.title || '참가확인서') 
      : (config?.completionTitle || '수료증');
    const bgUrl = type === 'attendance' 
      ? (config?.attendanceBgUrl || config?.backgroundImageUrl || '') 
      : (config?.completionBgUrl || '');

    return (
      <div className="bg-slate-100 p-4 sm:p-8 rounded-xl overflow-x-auto flex flex-col items-center gap-4">
        <div 
          ref={ref} 
          className={`bg-white w-[297mm] h-[210mm] shadow-sm relative flex flex-col justify-between ${bgUrl ? '' : 'p-[30mm]'}`}
          style={{
            minWidth: '297mm',
            minHeight: '210mm',
            backgroundImage: bgUrl ? `url(${bgUrl})` : 'radial-gradient(#f1f5f9 1px, transparent 1px)',
            backgroundSize: bgUrl ? 'cover' : '20px 20px',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          {!bgUrl && (
            <div className="absolute inset-4 border-[3px] border-double border-slate-300 pointer-events-none" />
          )}
          
          <div className={`relative z-10 flex flex-col h-full ${bgUrl ? 'p-[30mm]' : ''}`}>
            <div className="text-center mt-8">
              <h1 className="text-4xl font-black text-slate-900 tracking-[0.2em] mb-12">
                {title}
              </h1>
            </div>

            <div className="flex-1 flex flex-col justify-center px-12">
              <table className="w-full text-lg border-collapse mb-12">
                <tbody>
                  <tr>
                    <td className="w-32 py-4 font-bold text-slate-600 border-b border-slate-200">성명</td>
                    <td className="py-4 font-semibold text-slate-900 border-b border-slate-200 text-xl">{ui.name}</td>
                    <td className="w-32 py-4 font-bold text-slate-600 border-b border-slate-200">소속</td>
                    <td className="py-4 font-semibold text-slate-900 border-b border-slate-200 text-xl">{ui.aff}</td>
                  </tr>
                  {(config?.showLicenseNumber || config?.showPaymentAmount) && (
                    <tr>
                      {config?.showLicenseNumber && (
                        <>
                          <td className="w-32 py-4 font-bold text-slate-600 border-b border-slate-200">면허번호</td>
                          <td className="py-4 font-semibold text-slate-900 border-b border-slate-200">{ui.license && ui.license !== '-' ? ui.license : ''}</td>
                        </>
                      )}
                      {config?.showPaymentAmount && (
                        <>
                          <td className="w-32 py-4 font-bold text-slate-600 border-b border-slate-200">결제금액</td>
                          <td className="py-4 font-semibold text-slate-900 border-b border-slate-200">
                            {ui.amount ? `${ui.amount.toLocaleString()}원` : '무료 / 초청'}
                          </td>
                        </>
                      )}
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="text-center text-xl leading-relaxed text-slate-800">
                위 사람은 <span className="font-bold">{autoDateStr}</span> 개최된<br />
                <span className="font-bold text-2xl my-2 inline-block">「{autoConferenceName}」</span> 에<br />
                참석하였음을 증명합니다.
              </div>
            </div>

            <div className="text-center flex flex-col items-center justify-end pb-8">
              <div className="text-lg text-slate-600 mb-6">{autoLocation}</div>
              <div className="flex items-center justify-center gap-6 relative">
                <div className="text-3xl font-black text-slate-900 tracking-widest">{societyName || config?.societyName || ''}</div>
                {config?.stampImageUrl && (
                  <img 
                    src={config.stampImageUrl} 
                    alt="직인" 
                    className="w-24 h-24 object-contain absolute -right-16 -top-6 opacity-90 mix-blend-multiply"
                    crossOrigin="anonymous"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between px-4 pt-4 mt-4 border-t border-slate-200">
              <div className="text-xs text-slate-500">
                <div className="font-semibold text-slate-700">{certificateNumber}</div>
                {verificationUrl && (
                  <div className="mt-1 break-all">{verificationUrl}</div>
                )}
              </div>
              {verificationUrl && (
                <QRCodeSVG
                  value={verificationUrl}
                  size={64}
                  level="M"
                  includeMargin={false}
                />
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end w-full max-w-[297mm] gap-3">
          <Button variant="outline" onClick={() => setIsOpen(false)}>닫기</Button>
          <Button onClick={() => handleDownload(type)} disabled={generating} className="bg-blue-600 hover:bg-blue-700">
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            PDF 다운로드
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50">
          <Eye className="w-3.5 h-3.5" />
          보기 / 다운로드
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>증명서 미리보기 (관리자용)</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : !config ? (
          <div className="p-8 text-center text-slate-500">
            수료증/참가확인서 설정이 아직 저장되지 않았습니다.<br />
            [대회 관리] - [일반 설정]의 수료증 탭에서 기본 정보를 먼저 저장해주세요.
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="attendance" disabled={!config.attendanceEnabled && !config.enabled}>
                참가확인서
              </TabsTrigger>
              <TabsTrigger value="completion" disabled={!config.completionEnabled}>
                수료증
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="attendance">
              {renderCertificate('attendance')}
            </TabsContent>
            
            <TabsContent value="completion">
              {renderCertificate('completion')}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};