import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useConference } from '../hooks/useConference';
import { useNonMemberAuth } from '../hooks/useNonMemberAuth';
import { useAbstracts } from '../hooks/useAbstracts';
import EregiNavigation from '../components/eregi/EregiNavigation';
import DataWidget from '../components/eregi/DataWidget';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Registration } from '../types/schema';
import { CheckCircle, FileText, CreditCard, QrCode, Printer, AlertCircle } from 'lucide-react';
import { EregiButton, EregiCard } from '../components/eregi/EregiForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import ReceiptTemplate from '../components/print/ReceiptTemplate';
import PrintHandler from '../components/print/PrintHandler';
import { useRef } from 'react';

const NonMemberHubPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { id: cid, loading: confLoading, info: confInfo } = useConference();

    // Only initialize auth hook after conference data is loaded
    const { nonMember, loading: authLoading, initialLoadComplete, logout } = useNonMemberAuth(cid);
    
    const [registration, setRegistration] = useState<Registration | null>(null);
    const [loadingReg, setLoadingReg] = useState(false);
    const [qrImageError, setQrImageError] = useState(false);

    // Receipt Modal
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const receiptRef = useRef<HTMLDivElement>(null);

    // Fetch Registration
    useEffect(() => {
        if (!cid || !nonMember?.registrationId) return;

        const fetchRegistration = async () => {
            setLoadingReg(true);
            try {
                const ref = doc(db, `conferences/${cid}/registrations/${nonMember.registrationId}`);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const regData = { id: snap.id, ...snap.data() } as Registration;
                    console.log('[NonMemberHubPage] Registration data loaded:', regData);
                    console.log('[NonMemberHubPage] confirmationQr value:', regData.confirmationQr);
                    setRegistration(regData);
                }
            } catch (error) {
                console.error("Failed to fetch registration", error);
            } finally {
                setLoadingReg(false);
            }
        };

        fetchRegistration();
    }, [cid, nonMember]);

    // Fetch Abstracts
    // Only if registration is loaded and has userId
    const { mySubmissions, loadingSubs } = useAbstracts(cid || '', registration?.userId);

    // Auth Guard - redirect to login if not authenticated
    useEffect(() => {
        // Only redirect if:
        // 1. Initial load is complete (we've tried to restore session)
        // 2. cid is available
        // 3. nonMember is still null (no valid session found)
        if (initialLoadComplete && cid && !nonMember) {
            console.log('[NonMemberHubPage] No session found after loading, redirecting to check-status');
            navigate(`/${slug}/check-status`);
        }
    }, [initialLoadComplete, nonMember, cid, navigate, slug]);

    if (confLoading || !initialLoadComplete || loadingReg) {
        return <LoadingSpinner />;
    }

    if (!nonMember || !cid) {
        return null; // Will redirect
    }

    const handleLogout = () => {
        logout();
        navigate(`/${slug}/check-status`);
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <EregiNavigation
                societyName={confInfo?.title?.ko || confInfo?.title?.en}
                customUser={{
                    name: nonMember.name,
                    email: nonMember.email,
                    label: '비회원(준회원)'
                }}
                onLogout={handleLogout}
            />

            <main className="max-w-7xl mx-auto px-6 py-24 space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-black text-slate-900">
                        반갑습니다, {nonMember.name}{nonMember.email ? ` (${nonMember.email})` : ''}님 👋
                    </h1>
                    <p className="text-slate-500 mt-2">
                        비회원 전용 허브에서 등록 정보와 초록 제출 현황을 확인하세요.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* 1. Registration Status */}
                    <DataWidget
                        title="등록 상태"
                        value={registration?.paymentStatus === 'PAID' ? '결제 완료' : '결제 대기'}
                        subValue={
                            <div className="flex flex-col gap-1">
                                <span>등록번호: {registration?.receiptNumber || '-'}</span>
                                {registration?.amount && (
                                    <span className="text-xs">
                                        {registration.userTier || ''} {registration.amount.toLocaleString()}원
                                    </span>
                                )}
                            </div>
                        }
                        icon={CreditCard}
                        variant={registration?.paymentStatus === 'PAID' ? 'success' : 'default'}
                        loading={loadingReg}
                    />

                    {/* 2. Abstract Status */}
                    <DataWidget
                        title="제출한 초록"
                        value={`${mySubmissions.length}건`}
                        subValue={loadingSubs ? 'Loading...' : '제출 완료'}
                        icon={FileText}
                        variant="primary"
                        loading={loadingSubs}
                    />

                    {/* 3. Quick Action */}
                    <EregiCard className="p-6 flex flex-col justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">바로가기</h3>
                            <p className="text-slate-500 text-sm mb-4">
                                주요 기능을 빠르게 이용할 수 있습니다.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <EregiButton 
                                variant="secondary"
                                onClick={() => navigate(`/${slug}/abstracts`)}
                            >
                                초록 관리 페이지
                            </EregiButton>
                            {registration?.paymentStatus === 'PAID' && (
                                <EregiButton 
                                    variant="outline"
                                    onClick={() => {
                                        if (!(confInfo as Record<string, unknown>).receipt) {
                                            alert("영수증 설정이 없습니다.");
                                            return;
                                        }
                                        setShowReceiptModal(true);
                                    }}
                                    className="border-slate-200"
                                >
                                    <Printer className="w-4 h-4 mr-2" />
                                    영수증 출력
                                </EregiButton>
                            )}
                        </div>
                    </EregiCard>
                </div>

                {/* QR Code Section */}
                {registration?.paymentStatus === 'PAID' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <EregiCard className="md:col-span-2 p-8 flex flex-col items-center justify-center text-center bg-white border-2 border-eregi-800/10">
                            <div className="bg-blue-50 p-4 rounded-full mb-4">
                                <QrCode className="w-8 h-8 text-eregi-800" />
                            </div>
                             <h2 className="text-2xl font-bold text-slate-900 mb-2">인포데스크 QR 코드</h2>
                            <p className="text-slate-500 mb-8 max-w-md">
                                현장 인포데스크에서 명찰을 수령하실 때 아래 QR 코드를 제시해주세요.<br/>
                                <span className="text-sm text-red-500 font-medium">※ 스크린샷을 저장해두시면 편리합니다.</span>
                            </p>

                             {/* CRITICAL FIX: Use confirmationQr for info-desk scanning */}
                             <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-100">
                                 {!qrImageError ? (
                                     <img
                                         src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(registration.confirmationQr || registration.id)}`}
                                         alt="Info Desk QR Code"
                                         className="w-64 h-64 object-contain"
                                         onError={() => setQrImageError(true)}
                                         onLoad={() => setQrImageError(false)}
                                     />
                                 ) : (
                                     <div className="w-64 h-64 bg-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400 gap-2">
                                         <AlertCircle className="w-12 h-12 text-slate-300" />
                                         <span>QR 코드를 불러올 수 없습니다.</span>
                                         <span className="text-xs">새로고침을 시도해주세요.</span>
                                     </div>
                                 )}
                             </div>

                            <div className="mt-8 px-4 py-2 bg-slate-100 rounded-lg text-sm font-mono text-slate-500">
                                QR: {registration.confirmationQr || registration.id}
                            </div>
                        </EregiCard>

                        <div className="space-y-6">
                            {/* Additional Info or Widgets could go here */}
                             <EregiCard className="p-6 h-full bg-slate-900 text-white">
                                <h3 className="text-xl font-bold mb-4">안내사항</h3>
                                <ul className="space-y-3 text-slate-300 text-sm">
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                                        <span>현장 등록 데스크에서 명찰을 수령해주세요.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                                        <span>초록 수정은 마감 기한까지만 가능합니다.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                                        <span>문의사항은 사무국으로 연락 바랍니다.</span>
                                    </li>
                                    {confInfo?.externalLinks?.website && (
                                        <li className="flex items-start gap-2">
                                            <CheckCircle className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                                            <a href={confInfo.externalLinks.website} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 underline">
                                                학회 웹사이트 바로가기
                                            </a>
                                        </li>
                                    )}
                                </ul>
                            </EregiCard>
                        </div>
                    </div>
                )}
            </main>

            {/* Receipt Modal */}
            <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
                <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>영수증 미리보기 (Receipt Preview)</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center p-6 bg-gray-100 rounded-xl">
                        {registration && (confInfo as Record<string, unknown>)?.receipt && (
                            <div ref={receiptRef} className="shadow-2xl bg-white">
                                <ReceiptTemplate 
                                    data={{
                                        registrationId: registration.id,
                                        receiptNumber: registration.receiptNumber || registration.id,
                                        paymentDate: registration.createdAt ? (registration.createdAt.toDate ? registration.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString()) : new Date().toLocaleDateString(),
                                        payerName: nonMember.name || 'Unknown',
                                        totalAmount: registration.amount || 0,
                                        items: [
                                            { name: `${confInfo?.title?.ko || confInfo?.title?.en || 'Conference'} 등록`, amount: registration.amount || 0 }
                                        ]
                                    }} 
                                    config={(confInfo as Record<string, unknown>).receipt} 
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <EregiButton onClick={() => setShowReceiptModal(false)} variant="secondary">
                            닫기
                        </EregiButton>
                        <PrintHandler
                            contentRef={receiptRef}
                            triggerButton={
                                <EregiButton variant="primary" className="bg-blue-600 hover:bg-blue-700 text-white">
                                    <Printer className="w-4 h-4 mr-2" />
                                    인쇄하기
                                </EregiButton>
                            }
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default NonMemberHubPage;
