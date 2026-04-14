import React from 'react';
import { Calendar, FileText, Award } from 'lucide-react';

import EregiNavigation from '@/components/eregi/EregiNavigation';
import DataWidget from '@/components/eregi/DataWidget';
import { DOMAIN_CONFIG } from '@/utils/domainHelper';

import { useUserHubState } from '../features/user-hub/hooks/useUserHubState';
import { AnimatedCounter } from '../features/user-hub/components/AnimatedCounter';
import { EventsTab } from '../features/user-hub/components/EventsTab';
import { CertsTab } from '../features/user-hub/components/CertsTab';
import { AbstractsTab } from '../features/user-hub/components/AbstractsTab';
import { ProfileTab } from '../features/user-hub/components/ProfileTab';
import { Modals } from '../features/user-hub/components/Modals';

const UserHubPage: React.FC = () => {
    const state = useUserHubState();

    const hostname = window.location.hostname;
    const isMain = hostname === DOMAIN_CONFIG.BASE_DOMAIN || hostname.startsWith('www') || hostname.includes('firebaseapp') || hostname.includes('localhost');

    const getSocietyName = (): string => {
        if (isMain) return ''; 

        if (state.society?.name) {
            if (typeof state.society.name === 'string') {
                return state.society.name;
            } else if (state.society.name.ko || state.society.name.en) {
                return state.society.name.ko || state.society.name.en;
            }
        }

        return hostname.split('.')[0];
    };

    const societyName = getSocietyName();
    const pageTitle = isMain ? "통합 마이페이지" : `${societyName} 마이페이지`;

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#dbeafe_0%,_#f8fafc_45%,_#f1f5f9_100%)] pb-20 pt-20">
            <EregiNavigation />

            <div className="max-w-5xl mx-auto px-3 sm:px-6">
                <div className="mb-8 mt-8 rounded-2xl border border-slate-200/70 bg-white/80 backdrop-blur-sm px-5 py-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase mb-1">My eRegi</p>
                            <h1 className="text-2xl font-heading-2 text-slate-900">{pageTitle}</h1>
                            <p className="text-sm text-slate-500 mt-1">등록, 초록, 인증, 개인정보 제공 이력을 한 화면에서 확인할 수 있습니다.</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-gray-100 shadow-sm">
                                <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${state.syncStatus === 'connected' ? 'bg-green-500' :
                                    state.syncStatus === 'syncing' ? 'bg-blue-500 animate-pulse' :
                                        'bg-orange-500'
                                    }`} />
                                <span className="text-[10px] font-mono font-medium text-gray-400 uppercase tracking-wider">
                                    {state.syncStatus === 'connected' ? 'Data Live' :
                                        state.syncStatus === 'syncing' ? 'Syncing...' : 'Offline'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <DataWidget
                        title="My Conferences"
                        value={state.regs.length}
                        icon={Calendar}
                        loading={state.loading}
                    />

                    <DataWidget
                        title="Submitted Abstracts"
                        value={state.abstracts.length}
                        icon={FileText}
                        loading={state.loading}
                    />

                    <DataWidget
                        title="Total Points"
                        value={<><AnimatedCounter value={state.totalPoints} /> <span className="text-lg font-normal text-blue-200">pts</span></>}
                        icon={Award}
                        loading={state.loading}
                        variant="primary"
                    />
                </div>

                <div className="mb-6 overflow-x-auto no-scrollbar min-w-0">
                    <div className="inline-flex w-full min-w-max gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
                        <button onClick={() => state.setActiveTab('EVENTS')} className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-semibold transition-all ${state.activeTab === 'EVENTS' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-slate-100'}`}>등록학회</button>
                        <button onClick={() => state.setActiveTab('ABSTRACTS')} className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-semibold transition-all ${state.activeTab === 'ABSTRACTS' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-slate-100'}`}>초록 내역</button>
                        <button onClick={() => state.setActiveTab('CERTS')} className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-semibold transition-all ${state.activeTab === 'CERTS' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-slate-100'}`}>학회 인증</button>
                        <button onClick={() => state.setActiveTab('PROFILE')} className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-semibold transition-all ${state.activeTab === 'PROFILE' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-slate-100'}`}>내 정보</button>
                    </div>
                </div>

                {state.activeTab === 'EVENTS' && (
                    <EventsTab
                        loading={state.loading}
                        regs={state.regs}
                        handleEventClick={state.handleEventClick}
                        handleQrClick={state.handleQrClick}
                        handleReceiptClick={state.handleReceiptClick}
                        setSelectedVirtualAccountReg={state.setSelectedVirtualAccountReg}
                        setShowVirtualAccountModal={state.setShowVirtualAccountModal}
                    />
                )}

                {state.activeTab === 'CERTS' && (
                    <CertsTab
                        loading={state.loading}
                        user={state.user}
                        societies={state.societies}
                        handleOpenModal={state.handleOpenModal}
                    />
                )}

                {state.activeTab === 'ABSTRACTS' && (
                    <AbstractsTab
                        loading={state.loading}
                        abstracts={state.abstracts}
                        setActiveTab={state.setActiveTab}
                        setAbstracts={state.setAbstracts as any}
                    />
                )}

                {state.activeTab === 'PROFILE' && (
                    <ProfileTab
                        loading={state.loading}
                        profile={state.profile}
                        profileSaving={state.profileSaving}
                        guestbookEntries={state.guestbookEntries}
                        handleProfileFieldChange={state.handleProfileFieldChange}
                        handleSaveProfile={state.handleSaveProfile}
                    />
                )}
            </div>

            <Modals
                showCertModal={state.showCertModal}
                setShowCertModal={state.setShowCertModal}
                isSocLocked={state.isSocLocked}
                verifyForm={state.verifyForm}
                setVerifyForm={state.setVerifyForm}
                societies={state.societies}
                handleVerify={state.handleVerify}
                verifyLoading={state.verifyLoading}

                showReceiptModal={state.showReceiptModal}
                setShowReceiptModal={state.setShowReceiptModal}
                selectedReceiptReg={state.selectedReceiptReg}

                showVirtualAccountModal={state.showVirtualAccountModal}
                setShowVirtualAccountModal={state.setShowVirtualAccountModal}
                selectedVirtualAccountReg={state.selectedVirtualAccountReg}
            />
        </div>
    );
};

export default UserHubPage;
