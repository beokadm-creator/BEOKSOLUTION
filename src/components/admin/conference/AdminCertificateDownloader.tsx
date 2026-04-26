import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const certificateRef = useRef<HTMLDivElement>(null);

  const verificationUrl = verificationToken ? `${VERIFICATION_BASE_URL}?token=${verificationToken}` : null;

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
    if (isOpen && !config) {
      fetchConfig();
    }
  }, [confId, isOpen, config]);

  const handleDownload = async () => {
    if (!certificateRef.current) return;
    
    setGenerating(true);
    toast.loading('참가확인서를 생성하고 있습니다...', { id: 'admin-cert' });

    try {
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
      pdf.save(`${ui.name}_참가확인서(관리자).pdf`);
      
      toast.success('다운로드가 완료되었습니다.', { id: 'admin-cert' });
      setIsOpen(false);
    } catch (err) {
      console.error('Certificate generation failed', err);
      toast.error('생성에 실패했습니다.', { id: 'admin-cert' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50">
          <Eye className="w-3.5 h-3.5" />
          보기 / 다운로드
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>참가확인서 미리보기 (관리자용)</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : !config ? (
          <div className="p-8 text-center text-slate-500">참가확인서 설정이 비활성화되어 있거나 로드할 수 없습니다.</div>
        ) : (
          <>
            <div className="bg-slate-100 p-4 sm:p-8 rounded-xl overflow-x-auto flex justify-center">
              <div 
                ref={certificateRef} 
                className={`bg-white w-[297mm] h-[210mm] shadow-sm relative flex flex-col justify-between ${config.backgroundImageUrl ? '' : 'p-[30mm]'}`}
                style={{
                  minWidth: '297mm',
                  minHeight: '210mm',
                  backgroundImage: config.backgroundImageUrl 
                    ? `url(${config.backgroundImageUrl})` 
                    : 'radial-gradient(#f1f5f9 1px, transparent 1px)',
                  backgroundSize: config.backgroundImageUrl ? 'cover' : '20px 20px',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                }}
              >
                {!config.backgroundImageUrl && (
                  <div className="absolute inset-4 border-[3px] border-double border-slate-300 pointer-events-none" />
                )}
                
                <div className={`relative z-10 flex flex-col h-full ${config.backgroundImageUrl ? 'p-[30mm]' : ''}`}>
                  <div className="text-center mt-8">
                    <h1 className="text-4xl font-black text-slate-900 tracking-[0.2em] mb-12">
                      {(config.title as string) || '참가확인서'}
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
                      위 사람은 <span className="font-bold">{config.dateStr as string}</span> 개최된<br />
                      <span className="font-bold text-2xl my-2 inline-block">「{config.conferenceName as string}」</span> 에<br />
                      참석하였음을 증명합니다.
                    </div>
                  </div>

                  <div className="text-center flex flex-col items-center justify-end pb-8">
                    <div className="text-lg text-slate-600 mb-6">{config.location as string}</div>
                    <div className="flex items-center justify-center gap-6 relative">
                      <div className="text-3xl font-black text-slate-900 tracking-widest">{config.societyName as string}</div>
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
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setIsOpen(false)}>닫기</Button>
              <Button onClick={handleDownload} disabled={generating} className="bg-blue-600 hover:bg-blue-700">
                {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                PDF 다운로드
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};