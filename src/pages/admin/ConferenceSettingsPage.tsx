import React, { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Save, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useConferenceSettings } from '@/features/admin-conference/hooks/useConferenceSettings';
import { BasicInfoSection } from '@/features/admin-conference/components/BasicInfoSection';
import { AbstractDeadlinesSection } from '@/features/admin-conference/components/AbstractDeadlinesSection';
import { VenueSection } from '@/features/admin-conference/components/VenueSection';
import { VisualAssetsSection } from '@/features/admin-conference/components/VisualAssetsSection';
import { WelcomeMessageSection } from '@/features/admin-conference/components/WelcomeMessageSection';
import { FeaturesSection } from '@/features/admin-conference/components/FeaturesSection';
import { StampTourSection } from '@/features/admin-conference/components/StampTourSection';

export default function ConferenceSettingsPage() {
    const { cid } = useParams<{ cid: string }>();
    const location = useLocation();

    const {
        data,
        setData,
        loading,
        saving,
        uploadingImage,
        sponsors,
        stampTourConfig,
        setStampTourConfig,
        stampTourProgress,
        drawingUserId,
        stampTourParticipantCount,
        handleSave,
        handleImageUpload,
        handleAdminRewardDraw,
        handleRunLottery
    } = useConferenceSettings(cid);

    useEffect(() => {
        if (location.hash !== '#stamp-tour') return;
        const scrollToStampTour = () => {
            const section = document.getElementById('stamp-tour');
            if (!section) return false;
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return true;
        };

        if (scrollToStampTour()) return;
        const timer = window.setTimeout(() => {
            scrollToStampTour();
        }, 250);
        return () => window.clearTimeout(timer);
    }, [location.hash, loading, data.features.stampTourEnabled]);

    if (!cid) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="text-center space-y-3">
                    <Info className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-slate-500 font-medium">유효하지 않은 학술대회입니다. URL을 확인해주세요.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto p-6 space-y-8">
                <Skeleton className="h-12 w-full max-w-sm rounded-lg" />
                <div className="space-y-6">
                    <Skeleton className="h-64 w-full rounded-xl" />
                    <Skeleton className="h-64 w-full rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full pb-32">
            {/* Sticky Header */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 shadow-sm transition-all">
                <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Conference settings</h1>
                        <p className="text-sm text-slate-500 font-medium mt-0.5">Basic conference information and visual settings</p>
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        size="lg"
                        className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg hover:shadow-slate-900/20 transition-all font-semibold rounded-full px-8"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                저장 중...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                설정 저장
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">
                <BasicInfoSection data={data} setData={setData} />
                <hr className="border-slate-100" />
                
                <AbstractDeadlinesSection data={data} setData={setData} />
                <hr className="border-slate-100" />
                
                <FeaturesSection data={data} setData={setData} />
                <hr className="border-slate-100" />

                {data.features.stampTourEnabled && (
                    <>
                        <StampTourSection
                            cid={cid}
                            stampTourConfig={stampTourConfig}
                            setStampTourConfig={setStampTourConfig}
                            stampTourProgress={stampTourProgress}
                            sponsors={sponsors}
                            stampTourParticipantCount={stampTourParticipantCount}
                            drawingUserId={drawingUserId}
                            handleAdminRewardDraw={handleAdminRewardDraw}
                            handleRunLottery={handleRunLottery}
                        />
                        <hr className="border-slate-100" />
                    </>
                )}

                <VenueSection data={data} setData={setData} />
                <hr className="border-slate-100" />
                
                <VisualAssetsSection cid={cid} data={data} setData={setData} />
                <hr className="border-slate-100" />
                
                <WelcomeMessageSection
                    data={data}
                    setData={setData}
                    uploadingImage={uploadingImage}
                    handleImageUpload={handleImageUpload}
                />
            </div>
        </div>
    );
}
