import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Download, Loader2, FileCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import toast from 'react-hot-toast';
import { BadgeUiState } from './UnifiedBadgeView';

interface CertificateDownloaderProps {
  confId: string;
  ui: BadgeUiState;
  badgeLang: "ko" | "en";
}

export const CertificateDownloader: React.FC<CertificateDownloaderProps> = ({ confId, ui, badgeLang }) => {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const certificateRef = useRef<HTMLDivElement>(null);

  const t = (ko: string, en: string) => (badgeLang === "ko" ? ko : en);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, `conferences/${confId}/settings/certificate_config`));
        if (snap.exists() && snap.data().enabled) {
          setConfig(snap.data());
        }
      } catch (err) {
        console.error('Failed to load certificate config', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [confId]);

  if (loading || !config) return null;

  // 발급 조건: 체크인 완료(isCheckedIn === true) 및 결제 완료(paymentStatus === "PAID")
  const canDownload = ui.isCheckedIn;

  const handleDownload = async () => {
    if (!certificateRef.current) return;
    
    setGenerating(true);
    toast.loading(t("참가확인서를 생성하고 있습니다...", "Generating certificate..."), { id: 'cert' });

    try {
      // Create canvas from the hidden certificate div
      const canvas = await html2canvas(certificateRef.current, {
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
      pdf.save(`${ui.name}_참가확인서.pdf`);
      
      toast.success(t("다운로드가 완료되었습니다.", "Download complete."), { id: 'cert' });
      setIsOpen(false);
    } catch (err) {
      console.error('Certificate generation failed', err);
      toast.error(t("생성에 실패했습니다.", "Generation failed."), { id: 'cert' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="w-full">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <button 
            disabled={!canDownload}
            className={`w-full flex items-center justify-center gap-2 p-4 rounded-2xl font-bold transition-all ${canDownload ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >
            <FileCheck className="w-5 h-5" />
            {t("참가확인서 다운로드", "Download Certificate")}
          </button>
        </DialogTrigger>

        {canDownload && (
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("참가확인서 미리보기", "Certificate Preview")}</DialogTitle>
            </DialogHeader>

            <div className="bg-slate-100 p-4 sm:p-8 rounded-xl overflow-x-auto flex justify-center">
              {/* This is the actual certificate that will be rendered to PDF. We scale it up nicely. */}
              <div 
                ref={certificateRef} 
                className="bg-white w-[297mm] h-[210mm] shadow-sm relative flex flex-col justify-between"
                style={{
                  minWidth: '297mm',
                  minHeight: '210mm',
                  padding: '30mm',
                  backgroundImage: 'radial-gradient(#f1f5f9 1px, transparent 1px)',
                  backgroundSize: '20px 20px'
                }}
              >
                {/* Border Decor */}
                <div className="absolute inset-4 border-[3px] border-double border-slate-300 pointer-events-none" />
                
                <div className="text-center mt-8">
                  <h1 className="text-4xl font-black text-slate-900 tracking-[0.2em] mb-12">
                    {config.title || '참가확인서'}
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
                    위 사람은 <span className="font-bold">{config.dateStr}</span> 개최된<br />
                    <span className="font-bold text-2xl my-2 inline-block">「{config.conferenceName}」</span> 에<br />
                    참석하였음을 증명합니다.
                  </div>
                </div>

                <div className="text-center flex flex-col items-center justify-end pb-8">
                  <div className="text-lg text-slate-600 mb-6">{config.location}</div>
                  <div className="flex items-center justify-center gap-6 relative">
                    <div className="text-3xl font-black text-slate-900 tracking-widest">{config.societyName}</div>
                    {config.stampImageUrl && (
                      <img 
                        src={config.stampImageUrl} 
                        alt="직인" 
                        className="w-24 h-24 object-contain absolute -right-16 -top-6 opacity-90 mix-blend-multiply"
                        crossOrigin="anonymous"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                {t("취소", "Cancel")}
              </Button>
              <Button onClick={handleDownload} disabled={generating} className="bg-blue-600 hover:bg-blue-700">
                {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                {t("PDF로 저장", "Save as PDF")}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {!canDownload && (
        <p className="text-center text-xs text-slate-400 mt-2">
          {t("현장 체크인이 완료된 후 발급 가능합니다.", "Available after on-site check-in.")}
        </p>
      )}
    </div>
  );
};