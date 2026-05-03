import React, { useMemo, useState } from 'react';
import { Speaker } from '../../../types/conference';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import { User } from 'lucide-react';
import { SpeakerDetailDialog } from '../SpeakerDetailDialog';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

interface WideSpeakersPreviewProps {
    speakers?: Speaker[];
    lang?: string;
}

export const WideSpeakersPreview: React.FC<WideSpeakersPreviewProps> = ({ speakers, lang = 'ko' }) => {
    const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null);
    const [visibleCount, setVisibleCount] = useState(12);

     
    const t = (val: unknown) => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        return (lang === 'en' ? val.en : val.ko) || val.ko || '';
    };

    const sortedSpeakers = useMemo(() => {
        if (!speakers) return [];
        return [...speakers].sort((a, b) => (a.order || 9999) - (b.order || 9999));
    }, [speakers]);

    if (!speakers || speakers.length === 0) return null;

    const renderCard = (speaker: Speaker) => (
        <div
            className="flex flex-col items-center text-center group cursor-pointer p-4"
            onClick={() => setSelectedSpeaker(speaker)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setSelectedSpeaker(speaker);
            }}
        >
            <div className="relative w-36 md:w-40 h-36 md:h-40 mb-5 md:mb-6 rounded-full overflow-hidden shadow-2xl border-4 border-white ring-2 ring-slate-200 group-hover:ring-blue-300 transition-all duration-300 group-hover:scale-105 bg-slate-100">
                {speaker.photoUrl ? (
                    <img
                        src={speaker.photoUrl}
                        alt={t(speaker.name)}
                        className="w-full h-full object-contain"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-200">
                        <User className="w-12 h-12 text-slate-400" />
                    </div>
                )}
            </div>

            <h4 className="max-w-[240px] text-lg md:text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors break-keep">
                {t(speaker.name)}
            </h4>

            <p className="mx-auto max-w-[260px] text-sm md:text-base font-semibold text-blue-600 mb-2 line-clamp-2 min-h-[2.25rem] break-words leading-snug">
                {t(speaker.organization)}
            </p>
        </div>
    );

    return (
        <section className="w-full bg-gradient-to-b from-slate-50 to-white py-8 md:py-12">
            <div className="px-4 md:px-8">
                <div className="md:hidden">
                    <Swiper
                        modules={[Navigation, Pagination, Autoplay]}
                        spaceBetween={24}
                        slidesPerView={1}
                        navigation
                        pagination={{ clickable: true }}
                        autoplay={{ delay: 5000, disableOnInteraction: false }}
                        breakpoints={{
                            640: { slidesPerView: 2 },
                        }}
                        className="pb-12 !px-4"
                    >
                        {sortedSpeakers.map((speaker) => (
                            <SwiperSlide key={speaker.id}>
                                {renderCard(speaker)}
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </div>

                <div className="hidden md:block">
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-10">
                        {sortedSpeakers.slice(0, visibleCount).map((speaker) => (
                            <div key={speaker.id} className="flex justify-center">
                                {renderCard(speaker)}
                            </div>
                        ))}
                    </div>

                    {sortedSpeakers.length > visibleCount && (
                        <div className="mt-8 flex justify-center">
                            <button
                                type="button"
                                onClick={() => setVisibleCount((c) => Math.min(c + 12, sortedSpeakers.length))}
                                className="h-11 px-6 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition"
                            >
                                {lang === 'en' ? 'Load more' : '더보기'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <SpeakerDetailDialog
                speaker={selectedSpeaker}
                lang={lang}
                onClose={() => setSelectedSpeaker(null)}
            />
        </section>
    );
};
