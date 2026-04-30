import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import { Calendar, FileText, QrCode, Printer, Award } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { CreditCard } from 'lucide-react';
import { ABSTRACT_STATUS } from '@/constants/abstract';
import EregiNavigation from '../components/eregi/EregiNavigation';
import DataWidget from '../components/eregi/DataWidget';
import ReceiptTemplate from '../components/print/ReceiptTemplate';
import PrintHandler from '../components/print/PrintHandler';
import { safeFormatDate } from '../utils/dateUtils';
import { toast } from 'react-hot-toast';
import { useUserHub, forceString, getSafeConferenceSlug, getAbstractConfLabel, type Affiliation } from '../hooks/useUserHub';

const AnimatedCounter = ({ value }: { value: number }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        const duration = 800;
        const startValue = 0;

        const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);

            setCount(Math.floor(easeOut * (value - startValue) + startValue));

            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };

        window.requestAnimationFrame(step);
    }, [value]);

    return <span>{count.toLocaleString()}</span>;
};

const UserHubPage: React.FC = () => {
    const hub = useUserHub();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const receiptRef = useRef<HTMLDivElement>(null);
    const { user } = hub.auth;

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#dbeafe_0%,_#f8fafc_45%,_#f1f5f9_100%)] pb-20 pt-20">
            <EregiNavigation />

            <div className="max-w-5xl mx-auto px-3 sm:px-6">
                {/* TITLE & SYNC STATUS */}
                <div className="mb-8 mt-8 rounded-2xl border border-slate-200/70 bg-white/80 backdrop-blur-sm px-5 py-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase mb-1">My eRegi</p>
                            <h1 className="text-2xl font-heading-2 text-slate-900">{hub.pageTitle}</h1>
                            <p className="text-sm text-slate-500 mt-1">등록, 초록, 인증, 개인정보 제공 이력을 한 화면에서 확인할 수 있습니다.</p>
                        </div>
                        <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-gray-100 shadow-sm">
                            <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${hub.syncStatus === 'connected' ? 'bg-green-500' :
                                hub.syncStatus === 'syncing' ? 'bg-blue-500 animate-pulse' :
                                    'bg-orange-500'
                                }`} />
                            <span className="text-[10px] font-mono font-medium text-gray-400 uppercase tracking-wider">
                                {hub.syncStatus === 'connected' ? 'Data Live' :
                                    hub.syncStatus === 'syncing' ? 'Syncing...' : 'Offline'}
                            </span>
                        </div>
                    </div>
                </div>
                </div>

                {/* INFO WIDGET GRID */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {/* 1. Conferences Card */}
                    <DataWidget
                        title="My Conferences"
                        value={hub.regs.length}
                        icon={Calendar}
                        loading={hub.loading}
                    />

                    {/* 2. Abstract Card */}
                    <DataWidget
                        title="Submitted Abstracts"
                        value={hub.abstracts.length}
                        icon={FileText}
                        loading={hub.loading}
                    />

                    {/* 3. Points Card */}
                    <DataWidget
                        title="Total Points"
                        value={<><AnimatedCounter value={hub.totalPoints} /> <span className="text-lg font-normal text-blue-200">pts</span></>}
                        icon={Award}
                        loading={hub.loading}
                        variant="primary"
                    />
                </div>

                {/* TABS */}
                <div className="mb-6 overflow-x-auto no-scrollbar min-w-0">
                    <div className="inline-flex w-full min-w-max gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
                    <button onClick={() => hub.setActiveTab('EVENTS')} className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-semibold transition-all ${hub.activeTab === 'EVENTS' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-slate-100'}`}>등록학회</button>
                    <button onClick={() => hub.setActiveTab('ABSTRACTS')} className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-semibold transition-all ${hub.activeTab === 'ABSTRACTS' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-slate-100'}`}>초록 내역</button>
                    <button onClick={() => hub.setActiveTab('CERTS')} className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-semibold transition-all ${hub.activeTab === 'CERTS' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-slate-100'}`}>학회 인증</button>
                    <button onClick={() => hub.setActiveTab('PROFILE')} className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-semibold transition-all ${hub.activeTab === 'PROFILE' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-slate-100'}`}>내 정보</button>
                    </div>
                </div>

                {/* 1. EVENTS (FIXED LINKS & TITLES) */}
                {hub.activeTab === 'EVENTS' && (
                    <div className="space-y-4">
                        {hub.loading && (
                            <>
                                {[1, 2].map((i) => (
                                    <div key={i} className="bg-white p-5 rounded-xl shadow-sm border flex flex-col gap-3">
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-6 w-3/4" />
                                        <div className="flex gap-2">
                                            <Skeleton className="h-4 w-24" />
                                            <Skeleton className="h-4 w-32" />
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                        {!hub.loading && hub.visibleRegs.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-xl border-2 border-dashed border-gray-200 text-center">
                                <div className="w-20 h-20 bg-blue-50 text-blue-200 rounded-full flex items-center justify-center mb-6">
                                    <Calendar className="w-10 h-10 text-blue-400" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">등록된 학회가 없습니다</h3>
                                <p className="text-gray-500 max-w-sm mb-8">
                                    현재 참여 중인 학술대회 내역이 없습니다.<br />
                                    진행 중인 학술대회를 찾아 등록해보세요.
                                </p>
                                <Button
                                    onClick={() => window.location.href = '/'}
                                    className="px-8 py-6 text-base font-bold bg-[#003366] hover:bg-[#002244] text-white shadow-lg shadow-blue-900/10"
                                >
                                    지금 학회 등록하기
                                </Button>
                            </div>
                        )}
                        {hub.visibleRegs.map(r => (
                            <div key={r.id} onClick={() => hub.handleEventClick(r)} className="eregi-card cursor-pointer flex flex-col group animate-in fade-in slide-in-from-bottom-2 duration-500 border border-slate-200 bg-white/95 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                                <div className="flex flex-col mb-4">
                                    <div className="flex items-center text-sm text-[#24669e] font-bold mb-2">
                                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 border border-blue-100">[{r.societyName}]</span>
                                    </div>
                                    <h3 className="font-heading-3 text-slate-900 mb-2 group-hover:text-[#1b4d77] transition-colors">{r.conferenceName}</h3>
                                    <div className="text-body-sm text-slate-500 flex flex-col gap-1">
                                        <span>📅 {r.dates}</span>
                                        <span>📍 {r.location}</span>
                                    </div>
                                </div>
                                <div className="mt-auto border-t border-slate-100 pt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <span className={r.earnedPoints ? "bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold" :
                                        (r.status === 'PENDING_PAYMENT' || r.paymentStatus === 'WAITING_FOR_DEPOSIT') ? "bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-xs font-bold border border-orange-100" :
                                            "bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs"}>
                                        {r.earnedPoints ? `+${r.earnedPoints} pts` :
                                            (r.status === 'PENDING_PAYMENT' || r.paymentStatus === 'WAITING_FOR_DEPOSIT') ? '입금 대기 (가상계좌)' :
                                                `[STATUS] ${r.paymentStatus || r.status}`}
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                        {r.hasAbstracts && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const currentLang = searchParams.get('lang') || 'ko';
                                                    const safeSlug = getSafeConferenceSlug(r.slug);
                                                    if (!safeSlug) {
                                                        toast.error('학술대회 정보가 없어 초록 페이지로 이동할 수 없습니다.');
                                                        return;
                                                    }
                                                    navigate(`/${safeSlug}/abstracts?lang=${currentLang}`);
                                                }}
                                                className="w-full sm:w-auto justify-center bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs gap-1.5 shadow-sm border border-slate-200"
                                            >
                                                <FileText size={14} /> 초록 접수/확인
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => hub.handleQrClick(e, r)}
                                            className="w-full sm:w-auto justify-center bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs gap-1.5 shadow-sm border border-slate-200"
                                        >
                                            <QrCode size={14} /> 등록 확인증 (QR)
                                        </Button>
                                        {r.paymentStatus === 'PAID' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => hub.handleReceiptClick(e, r)}
                                                className="w-full sm:w-auto justify-center bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs gap-1.5 shadow-sm border border-slate-200"
                                            >
                                                <Printer size={14} /> 영수증
                                            </Button>
                                        )}
                                        {(r.status === 'PENDING_PAYMENT' || r.paymentStatus === 'WAITING_FOR_DEPOSIT') && r.virtualAccount && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    hub.setSelectedVirtualAccountReg(r);
                                                    hub.setShowVirtualAccountModal(true);
                                                }}
                                                className="w-full sm:w-auto justify-center bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-xs gap-1.5 shadow-sm border border-orange-200"
                                            >
                                                <CreditCard size={14} /> 계좌 확인
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 2. CERTS (Affiliations) */}
                {hub.activeTab === 'CERTS' && (
                    <div className="space-y-4">
                        {hub.loading && (
                            <>
                                <div className="bg-white p-5 rounded-xl shadow-sm border-blue-100 flex justify-between items-center">
                                    <div className="flex items-center gap-4 w-full">
                                        <Skeleton className="w-10 h-10 rounded-full" />
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="h-5 w-1/3" />
                                            <Skeleton className="h-4 w-1/2" />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {!hub.loading && user?.affiliations && Object.entries(user.affiliations).map(([socId, aff]: [string, Affiliation]) => {
                            if (!aff.verified) return null;

                            const soc = hub.societies.find(s => s.id === socId);

                            return (
                                <div key={socId} className="eregi-card flex justify-between items-center bg-blue-50/30 border-blue-100">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-[#e1ecf6] text-[#24669e] rounded-full flex items-center justify-center font-bold text-xl">✓</div>
                                        <div>
                                            <h4 className="font-heading-3 text-slate-900 leading-tight">{forceString(soc?.name || socId)}</h4>
                                            <p className="text-body-sm text-slate-500 flex flex-col gap-1">
                                                {forceString(user.name)} | {forceString(aff.licenseNumber || aff.memberId)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="bg-white border border-blue-100 text-eregi-700 px-3 py-1 rounded text-xs font-bold block mb-1 shadow-sm">
                                            {forceString(aff.grade || '정회원')}
                                        </span>
                                        <p className="text-xs text-blue-600 mt-1">
                                            {aff.expiry || aff.expiryDate ? `유효기간: ${hub.formatDate(aff.expiry || aff.expiryDate)}` : '무기한'}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                        <button onClick={hub.handleOpenModal} className="w-full py-4 bg-white border-2 border-dashed border-blue-300 text-blue-600 rounded-xl font-bold hover:bg-blue-50">
                            + 학회 정회원 인증 추가하기
                        </button>
                        <button onClick={() => navigate('/mypage/membership')} className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold hover:from-blue-700 hover:to-blue-800 shadow-md flex items-center justify-center gap-2">
                            <CreditCard className="w-5 h-5" />
                            학회 회비 납부
                        </button>
                    </div>
                )}

                {/* 3. ABSTRACTS */}
                {hub.activeTab === 'ABSTRACTS' && (
                    <div className="space-y-4">
                        {hub.loading && (
                            <>
                                {[1, 2].map((i) => (
                                    <div key={i} className="bg-white p-5 rounded-xl shadow-sm border flex flex-col gap-3">
                                        <div className="flex justify-between">
                                            <Skeleton className="h-4 w-20" />
                                            <Skeleton className="h-5 w-16 rounded-full" />
                                        </div>
                                        <Skeleton className="h-6 w-3/4" />
                                        <Skeleton className="h-4 w-1/2" />
                                    </div>
                                ))}
                            </>
                        )}
                        {!hub.loading && hub.abstracts.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-xl border-2 border-dashed border-gray-200 text-center">
                                <div className="w-20 h-20 bg-blue-50 text-blue-200 rounded-full flex items-center justify-center mb-6">
                                    <FileText className="w-10 h-10 text-blue-400" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">제출된 초록이 없습니다</h3>
                                <p className="text-gray-500 max-w-sm mb-8">
                                    아직 제출된 초록이 없습니다.<br />
                                    현재 접수 중인 학술대회를 확인해보세요.
                                </p>
                                <Button
                                    onClick={() => hub.setActiveTab('EVENTS')}
                                    variant="outline"
                                    className="px-8 py-6 text-base font-bold border-2 border-blue-100 text-blue-600 hover:bg-blue-50 hover:border-blue-200"
                                >
                                    등록된 학회 보기
                                </Button>
                            </div>
                        )}
                        {hub.abstracts.map(abs => (
                            <div key={abs.id} className="eregi-card hover:border-eregi-200 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex flex-col">
                                        <div className="text-xs font-bold text-eregi-600 mb-1 bg-eregi-50 inline-block px-2 py-0.5 rounded">
                                            [{getAbstractConfLabel(abs)}]
                                        </div>
                                        <h3 className="font-heading-3 text-slate-900 mt-2">
                                            {abs.title?.ko || abs.title?.en || 'Untitled'}
                                        </h3>
                                    </div>
                                    <span className={`px-3 py-1 rounded-md text-xs font-bold shadow-sm border ${abs.reviewStatus === ABSTRACT_STATUS.ACCEPTED_ORAL
                                        ? 'bg-green-100 text-green-800 border-green-200'
                                        : abs.reviewStatus === ABSTRACT_STATUS.ACCEPTED_POSTER
                                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                                            : abs.reviewStatus === ABSTRACT_STATUS.REJECTED
                                                ? 'bg-red-50 text-red-600 border-red-200'
                                                : 'bg-gray-100 text-gray-600 border-gray-200'
                                        }`}>
                                        {abs.reviewStatus === ABSTRACT_STATUS.ACCEPTED_ORAL ? 'Oral Accepted' :
                                            abs.reviewStatus === ABSTRACT_STATUS.ACCEPTED_POSTER ? 'Poster Accepted' :
                                                abs.reviewStatus === ABSTRACT_STATUS.REJECTED ? 'Rejected' : 'Under Review'}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-500 flex flex-col gap-1 mt-2">
                                    <p>제출일: {hub.formatDate(abs.submittedAt || abs.createdAt)}</p>
                                    <p>저자: {abs.authors?.map((a: { name: string; email: string; affiliation: string; isPresenter: boolean }) => a.name).join(', ') || '-'}</p>

                                    <div className="flex flex-col sm:flex-row gap-2 mt-4 w-full sm:w-auto">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                hub.handleAbstractAction(abs, 'edit');
                                            }}
                                            className="w-full sm:w-auto text-xs bg-blue-50 text-blue-600 px-3 py-2 sm:py-1.5 rounded hover:bg-blue-100 font-bold border border-blue-200"
                                        >
                                            수정하기
                                        </button>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                hub.handleAbstractAction(abs, 'withdraw');
                                            }}
                                            className="w-full sm:w-auto text-xs bg-red-50 text-red-600 px-3 py-2 sm:py-1.5 rounded hover:bg-red-100 font-bold border border-red-200"
                                        >
                                            제출 철회
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 4. PROFILE (LOCKED READ-ONLY) */}
                {hub.activeTab === 'PROFILE' && (
                    <div className="bg-white/95 p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-lg mb-6">내 정보 확인</h3>
                        {hub.loading ? (
                            <div className="space-y-4">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i}>
                                        <Skeleton className="h-4 w-20 mb-1" />
                                        <Skeleton className="h-12 w-full rounded-lg" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-2 rounded">기본 정보는 여기에서 바로 수정할 수 있습니다.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div><label className="block text-sm font-medium text-gray-700 mb-1">이름</label><input type="text" className="w-full border p-3 rounded-lg bg-white" value={hub.profile.displayName} onChange={(e) => hub.handleProfileFieldChange('displayName', e.target.value)} /></div>
                                    <div><label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label><input type="text" className="w-full border p-3 rounded-lg bg-white" value={hub.profile.phoneNumber} onChange={(e) => hub.handleProfileFieldChange('phoneNumber', e.target.value)} /></div>
                                    <div><label className="block text-sm font-medium text-gray-700 mb-1">소속</label><input type="text" className="w-full border p-3 rounded-lg bg-white" value={hub.profile.affiliation} onChange={(e) => hub.handleProfileFieldChange('affiliation', e.target.value)} /></div>
                                    <div><label className="block text-sm font-medium text-gray-700 mb-1">직급</label><input type="text" className="w-full border p-3 rounded-lg bg-white" value={hub.profile.position || ''} onChange={(e) => hub.handleProfileFieldChange('position', e.target.value)} /></div>
                                    <div><label className="block text-sm font-medium text-gray-700 mb-1">면허번호</label><input type="text" className="w-full border p-3 rounded-lg bg-white" value={hub.profile.licenseNumber} onChange={(e) => hub.handleProfileFieldChange('licenseNumber', e.target.value)} /></div>
                                    <div><label className="block text-sm font-medium text-gray-700 mb-1">이메일</label><input type="text" className="w-full border p-3 rounded-lg bg-gray-100" value={hub.profile.email} disabled /></div>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <button
                                        onClick={hub.handleSaveProfile}
                                        disabled={hub.profileSaving}
                                        className="w-full sm:w-auto px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                                    >
                                        {hub.profileSaving ? '저장 중...' : '기본 정보 저장'}
                                    </button>
                                </div>
                                <div className="mt-8 border-t border-gray-100 pt-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-lg font-bold text-gray-900">내 정보 제공 이력</h4>
                                        <span className="text-xs font-semibold text-gray-500">{hub.guestbookEntries.length}건</span>
                                    </div>
                                    {hub.guestbookEntries.length === 0 ? (
                                        <div className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-4">
                                            아직 제3자 정보 제공 이력이 없습니다.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {hub.guestbookEntries.map((entry) => (
                                                <div key={entry.id} className="flex flex-col gap-1 border border-gray-100 rounded-lg p-4">
                                                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                                        <span className="font-semibold text-gray-700">{entry.conferenceName}</span>
                                                        <span className="text-gray-300">•</span>
                                                        <span>{entry.vendorName}</span>
                                                        {entry.timestamp?.toDate && (
                                                            <>
                                                                <span className="text-gray-300">•</span>
                                                                <span>{entry.timestamp.toDate().toLocaleString()}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-emerald-700 font-semibold">동의 완료</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* MODAL (Force Render Logic) */}
            {hub.showCertModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full relative">
                        <h3 className="text-xl font-bold mb-2 text-gray-900">학회 정회원 인증</h3>
                        <p className="text-xs text-center text-blue-500 mb-6 font-bold bg-blue-50 p-1 rounded">{hub.isSocLocked ? `[${hub.verifyForm.societyId}] 학회 전용 모드` : '통합 모드 (학회 선택 가능)'}</p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">학회 선택</label>
                                <select className={`w-full border p-3 rounded-lg ${hub.isSocLocked ? 'bg-gray-100 text-gray-500' : 'bg-white'}`} value={hub.verifyForm.societyId} onChange={(e) => hub.setVerifyForm({ ...hub.verifyForm, societyId: e.target.value })} disabled={hub.isSocLocked}>
                                    <option value="">선택해주세요</option>
                                    {hub.societies.map((s) => <option key={s.id} value={s.id}>{forceString(s.name) || s.id}</option>)}
                                </select>
                            </div>
                            <div><label className="block text-sm font-medium mb-1">이름</label><input type="text" className="w-full border p-3 rounded-lg" value={hub.verifyForm.name} onChange={(e) => hub.setVerifyForm({ ...hub.verifyForm, name: e.target.value })} /></div>
                            <div><label className="block text-sm font-medium mb-1">인증 코드</label><input type="text" className="w-full border p-3 rounded-lg" value={hub.verifyForm.code} onChange={(e) => hub.setVerifyForm({ ...hub.verifyForm, code: e.target.value })} /></div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => hub.setShowCertModal(false)} className="px-5 py-3 text-gray-500 hover:bg-gray-100 rounded-lg font-bold">취소</button>
                            <button
                                onClick={hub.handleVerify}
                                className="px-5 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center min-w-[100px]"
                                disabled={hub.verifyLoading}
                            >
                                {hub.verifyLoading ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : '인증 받기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Modal */}
            <Dialog open={hub.showReceiptModal} onOpenChange={hub.setShowReceiptModal}>
                <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>영수증 미리보기 (Receipt Preview)</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center p-6 bg-gray-100 rounded-xl">
                        {hub.selectedReceiptReg && hub.selectedReceiptReg.receiptConfig && (
                            <div ref={receiptRef} className="shadow-2xl bg-white">
                                <ReceiptTemplate
                                    data={{
                                        registrationId: hub.selectedReceiptReg.id,
                                        receiptNumber: hub.selectedReceiptReg.receiptNumber || hub.selectedReceiptReg.id,
                                        paymentDate: safeFormatDate(hub.selectedReceiptReg.paymentDate || new Date()),
                                        payerName: hub.selectedReceiptReg.userName || 'Unknown',
                                        totalAmount: hub.selectedReceiptReg.amount || 0,
                                        items: [
                                            { name: `Conference Registration (${hub.selectedReceiptReg.conferenceName})`, amount: hub.selectedReceiptReg.amount || 0 }
                                        ]
                                    }}
                                    config={hub.selectedReceiptReg.receiptConfig}
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <Button onClick={() => hub.setShowReceiptModal(false)} variant="secondary">
                            닫기
                        </Button>
                        <PrintHandler
                            contentRef={receiptRef}
                            triggerButton={
                                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                                    <Printer className="w-4 h-4 mr-2" />
                                    인쇄하기
                                </Button>
                            }
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Virtual Account Modal */}
            <Dialog open={hub.showVirtualAccountModal} onOpenChange={hub.setShowVirtualAccountModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>가상계좌 입금 정보</DialogTitle>
                    </DialogHeader>
                    {hub.selectedVirtualAccountReg && hub.selectedVirtualAccountReg.virtualAccount && (
                        <div className="bg-white p-6 rounded-xl border border-orange-200 shadow-sm mt-2">
                            <h3 className="text-lg font-bold text-orange-800 mb-4 border-b border-orange-100 pb-2">
                                입금 계좌 안내
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">은행</span>
                                    <span className="font-bold">{hub.selectedVirtualAccountReg.virtualAccount.bank}</span>
                                </div>
                                <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
                                    <span className="text-gray-500">계좌번호</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-lg text-blue-600">{hub.selectedVirtualAccountReg.virtualAccount.accountNumber}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">예금주</span>
                                    <span className="font-medium">{hub.selectedVirtualAccountReg.virtualAccount.customerName || 'Toss Payments'}</span>
                                </div>
                                {hub.selectedVirtualAccountReg.virtualAccount.dueDate && (
                                    <div className="flex justify-between text-red-500 pt-2 border-t border-dashed border-gray-200 mt-2">
                                        <span className="font-medium">입금기한</span>
                                        <span className="font-bold">
                                            {new Date(hub.selectedVirtualAccountReg.virtualAccount.dueDate).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="mt-6 text-xs text-gray-400 text-center">
                                ※ 입금 기한 내에 입금하지 않으시면 자동 취소됩니다.
                            </div>
                        </div>
                    )}
                    <div className="flex justify-center mt-4">
                        <Button onClick={() => hub.setShowVirtualAccountModal(false)} className="w-full bg-slate-900 text-white hover:bg-slate-800">
                            확인
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
export default UserHubPage;
