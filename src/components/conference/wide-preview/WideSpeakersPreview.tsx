import React, { useState } from 'react';
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

     
    const t = (val: unknown) => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        return (lang === 'en' ? val.en : val.ko) || val.ko || '';
    };

    if (!speakers || speakers.length === 0) return null;

    return (
        <section className="w-full bg-gradient-to-b from-slate-50 to-white py-8 md:py-12">
            <div className="px-4 md:px-8">
                <Swiper
                    modules={[Navigation, Pagination, Autoplay]}
                    spaceBetween={24}
                    slidesPerView={1}
                    navigation
                    pagination={{ clickable: true }}
                    autoplay={{ delay: 5000, disableOnInteraction: false }}
                    breakpoints={{
                        640: { slidesPerView: 2 },
                        768: { slidesPerView: 3 },
                        1024: { slidesPerView: 4 },
                    }}
                    className="pb-12 !px-4"
                >
                    {speakers.map((speaker) => (
                        <SwiperSlide key={speaker.id}>
                            <div
                                className="flex flex-col items-center text-center group cursor-pointer p-4"
                                onClick={() => setSelectedSpeaker(speaker)}
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
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>

            <SpeakerDetailDialog
                speaker={selectedSpeaker}
                lang={lang}
                onClose={() => setSelectedSpeaker(null)}
            />
        </section>
    );
};
