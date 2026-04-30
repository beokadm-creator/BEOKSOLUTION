import React, { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Download, Loader2, FileCheck, Award } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { BadgeUiState } from "@/types/badge";

interface CertificateMeta {
  certificateId: string;
  certificateNumber: string;
  verificationToken: string;
}

interface CertificateDownloaderProps {
  confId: string;
  ui: BadgeUiState;
  badgeLang: "ko" | "en";
  badgeToken?: string;
  allowBeforeCheckIn?: boolean;
}

const VERIFICATION_BASE_URL =
  'https://us-central1-eregi-8fc1e.cloudfunctions.net/verifyCertificatePublic';

export const CertificateDownloader: React.FC<CertificateDownloaderProps> = ({ confId, ui, badgeLang, badgeToken, allowBeforeCheckIn }) => {
  const [config, setConfig] = useState<Record<string, any> | null>(null);
  const [confInfo, setConfInfo] = useState<Record<string, any> | null>(null);
  const [societyName, setSocietyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [certMeta, setCertMeta] = useState<CertificateMeta | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'attendance' | 'completion'>('attendance');
  
  const attendanceRef = useRef<HTMLDivElement>(null);
  const completionRef = useRef<HTMLDivElement>(null);
  const issuanceAttempted = useRef(false);

  const t = useCallback((ko: string, en: string) => (badgeLang === "ko" ? ko : en), [badgeLang]);

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
        console.error('Failed to load certificate config', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [confId]);

  const isAttendanceEnabled = config?.attendanceEnabled ?? config?.enabled ?? false;
  const isCompletionEnabled = config?.completionEnabled ?? false;
  
  const canDownloadAttendance = isAttendanceEnabled && (!!ui.isCheckedIn || !!allowBeforeCheckIn);
  const canDownloadCompletion = isCompletionEnabled && !!ui.isCheckedIn && (ui.baseMinutes || 0) >= (config?.completionRequiredMinutes || 0);

  const showButton = isAttendanceEnabled || isCompletionEnabled;

  useEffect(() => {
    if (config) {
      if (canDownloadAttendance && !canDownloadCompletion) setActiveTab('attendance');
      else if (!canDownloadAttendance && canDownloadCompletion) setActiveTab('completion');
      else if (isAttendanceEnabled) setActiveTab('attendance');
      else if (isCompletionEnabled) setActiveTab('completion');
    }
  }, [config, canDownloadAttendance, canDownloadCompletion, isAttendanceEnabled, isCompletionEnabled]);

  const ensureCertificateIssued = useCallback(async () => {
    if (issuanceAttempted.current || issuing) return;
    issuanceAttempted.current = true;
    setIssuing(true);
    try {
      const issueFn = httpsCallable<{ confId: string; regId: string; badgeToken?: string; allowBeforeCheckIn?: boolean }, { success: boolean; certificateId: string; certificateNumber: string; verificationToken: string; message?: string }>(
        functions,
        'issueCertificate'
      );
      const result = await issueFn({
        confId,
        regId: ui.id,
        ...(allowBeforeCheckIn ? { allowBeforeCheckIn: true } : {}),
        ...(badgeToken ? { badgeToken } : {}),
      });
      if (result.data.success) {
        setCertMeta({
          certificateId: result.data.certificateId,
          certificateNumber: result.data.certificateNumber,
          verificationToken: result.data.verificationToken,
        });
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'failed-precondition') {
        toast.error(t("현장 체크인이 필요합니다.", "On-site check-in required."));
      } else if (code && code !== 'permission-denied') {
        console.error('Certificate issuance failed:', err);
        toast.error(t("증명서 발급에 실패했습니다.", "Certificate issuance failed."));
      }
    } finally {
      setIssuing(false);
    }
  }, [confId, ui.id, badgeToken, issuing, t, allowBeforeCheckIn]);

  useEffect(() => {
    if (isOpen && (canDownloadAttendance || canDownloadCompletion) && !certMeta) {
      ensureCertificateIssued();
    }
  }, [isOpen, canDownloadAttendance, canDownloadCompletion, certMeta, ensureCertificateIssued]);

  if (loading || !config || !showButton) return null;

  const verificationUrl = certMeta?.verificationToken
    ? `${VERIFICATION_BASE_URL}?token=${certMeta.verificationToken}`
    : null;

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

  const handleDownload = async (type: 'attendance' | 'completion') => {
    const targetRef = type === 'attendance' ? attendanceRef : completionRef;
    if (!targetRef.current) return;

    setGenerating(true);
    toast.loading(t("증명서를 생성하고 있습니다...", "Generating certificate..."), { id: 'cert' });

    try {
      // Dynamic import heavy print libraries
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ]);

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
      pdf.save(`${ui.name}_${type === 'attendance' ? '참가확인서' : '수료증'}.pdf`);
      
      if (certMeta) {
        try {
          const logFn = httpsCallable<{ confId: string; certificateId: string; badgeToken?: string }, { success: boolean }>(
            functions,
            'logCertificateDownload'
          );
          await logFn({
            confId,
            certificateId: certMeta.certificateId,
            ...(badgeToken ? { badgeToken } : {}),
          });
        } catch {
          // ignore
        }
      }
      
      toast.success(t("다운로드가 완료되었습니다.", "Download completed."), { id: 'cert' });
    } catch (err) {
      console.error('Certificate generation failed', err);
      toast.error(t("생성에 실패했습니다.", "Generation failed."), { id: 'cert' });
    } finally {
      setGenerating(false);
    }
  };

  const renderCertificate = (type: 'attendance' | 'completion') => {
    const ref = type === 'attendance' ? attendanceRef : completionRef;
    const title = type === 'attendance' 
      ? (config.attendanceTitle || config.title || '참가확인서') 
      : (config.completionTitle || '수료증');
    const bgUrl = type === 'attendance' 
      ? (config.attendanceBgUrl || config.backgroundImageUrl || '') 
      : (config.completionBgUrl || '');

    return (
      <div className="bg-slate-100 p-2 sm:p-8 rounded-xl overflow-x-auto flex flex-col items-center gap-4">
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
                    {ui.position && (
                      <>
                        <td className="w-32 py-4 font-bold text-slate-600 border-b border-slate-200">직급</td>
                        <td className="py-4 font-semibold text-slate-900 border-b border-slate-200 text-xl">{ui.position}</td>
                      </>
                    )}
                  </tr>
                  {(config.showLicenseNumber || config.showPaymentAmount) && (
                    <tr>
                      {config.showLicenseNumber && (
                        <>
                          <td className="w-32 py-4 font-bold text-slate-600 border-b border-slate-200">면허번호</td>
                          <td className="py-4 font-semibold text-slate-900 border-b border-slate-200">{ui.license && ui.license !== '-' ? ui.license : ''}</td>
                        </>
                      )}
                      {config.showPaymentAmount && (
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
                <div className="text-3xl font-black text-slate-900 tracking-widest">{societyName || config.societyName || ''}</div>
                {config.stampImageUrl && (
                  <img 
                    src={config.stampImageUrl as string} 
                    alt="직인" 
                    className="w-24 h-24 object-contain absolute -right-16 -top-6 opacity-90 mix-blend-multiply"
                    crossOrigin="anonymous"
                  />
                )}
              </div>
            </div>

            {certMeta && (
              <div className="flex items-center justify-between px-4 pt-4 mt-4 border-t border-slate-200">
                <div className="text-xs text-slate-500">
                  <div className="font-semibold text-slate-700">{certMeta.certificateNumber}</div>
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
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="w-full mt-3 border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-100 hover:text-blue-800 h-12 rounded-xl text-base shadow-sm"
        >
          <Award className="w-5 h-5 mr-2 text-blue-500" />
          {t("증명서 발급", "Download Certificate")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-blue-600" />
            {t("증명서 발급", "Certificate")}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as 'attendance' | 'completion')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="attendance" disabled={!isAttendanceEnabled}>
                참가확인서
              </TabsTrigger>
              <TabsTrigger value="completion" disabled={!isCompletionEnabled}>
                수료증 (이수증)
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="attendance" className="space-y-4">
              {!canDownloadAttendance ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500">
                  {t("현장 체크인을 완료한 참석자만 참가확인서를 발급받을 수 있습니다.", "Attendance certificate is only available for checked-in participants.")}
                </div>
              ) : (
                <>
                  {renderCertificate('attendance')}
                  <Button onClick={() => handleDownload('attendance')} disabled={generating || !certMeta} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-base">
                    {generating ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Download className="w-5 h-5 mr-2" />}
                    {t("참가확인서 PDF 다운로드", "Download PDF")}
                  </Button>
                </>
              )}
            </TabsContent>
            
            <TabsContent value="completion" className="space-y-4">
              {!canDownloadCompletion ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 space-y-2">
                  <p>{t("수료 기준을 충족한 참석자만 수료증을 발급받을 수 있습니다.", "Certificate of completion is only available for those who met the requirements.")}</p>
                  <p className="text-sm text-slate-400">
                    현재 누적 체류 시간: <span className="font-bold text-slate-600">{ui.baseMinutes || 0}분</span> / 기준 시간: <span className="font-bold text-slate-600">{config?.completionRequiredMinutes || 0}분</span>
                  </p>
                </div>
              ) : (
                <>
                  {renderCertificate('completion')}
                  <Button onClick={() => handleDownload('completion')} disabled={generating || !certMeta} className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-base">
                    {generating ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Download className="w-5 h-5 mr-2" />}
                    {t("수료증 PDF 다운로드", "Download PDF")}
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
