import React, { useState } from 'react';
import { Speaker } from '../../../types/conference';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import { Dialog, DialogContent } from '../../ui/dialog';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

interface WideSpeakersPreviewProps {
    speakers?: Speaker[];
    lang?: string;
}

export const WideSpeakersPreview: React.FC<WideSpeakersPreviewProps> = ({ speakers, lang = 'ko' }) => {
    const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (val: any) => {
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
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400 text-4xl md:text-5xl">
                                            👤
                                        </div>
                                    )}
                                </div>

                                <h4 className="text-lg md:text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                                    {t(speaker.name)}
                                </h4>

                                <p className="text-sm md:text-base font-semibold text-blue-600 mb-2 line-clamp-2 min-h-[2.25rem]">
                                    {t(speaker.organization)}
                                </p>
                            </div>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>

            {/* Enhanced Speaker Modal */}
            <Dialog open={!!selectedSpeaker} onOpenChange={(open) => !open && setSelectedSpeaker(null)}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 bg-white/95 backdrop-blur-xl border-slate-200 shadow-2xl">
                    {selectedSpeaker && (
                        <div className="flex flex-col md:flex-row w-full">
                            {/* Photo Section */}
                            <div className="md:w-2/5 bg-gradient-to-br from-slate-100 to-slate-200 p-8 md:p-12 flex flex-col items-center justify-center shrink-0">
                                <div className="w-48 md:w-56 h-48 md:h-56 rounded-full overflow-hidden border-4 border-white shadow-2xl bg-slate-100">
                                    {selectedSpeaker.photoUrl ? (
                                        <img
                                            src={selectedSpeaker.photoUrl}
                                            alt={t(selectedSpeaker.name)}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400 text-6xl">
                                            👤
                                        </div>
                                    )}
                                </div>
                                <div className="mt-6 text-center">
                                    <h4 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{t(selectedSpeaker.name)}</h4>
                                    <p className="text-lg md:text-xl font-semibold text-blue-600">{t(selectedSpeaker.organization)}</p>
                                </div>
                            </div>

                            {/* Info Section */}
                            <div className="md:w-3/5 p-6 md:p-12 space-y-8">
                                {/* Lecture Title Section - Enhanced Design */}
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 md:p-8 border border-blue-100 shadow-lg">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
                                            <span className="text-white text-xl">🎤</span>
                                        </div>
                                        <h5 className="text-lg md:text-xl font-bold text-blue-900 uppercase tracking-wide">
                                            {lang === 'ko' ? '강연 주제' : 'Lecture Topic'}
                                        </h5>
                                    </div>
                                    <p className="text-xl md:text-2xl font-bold text-slate-800 leading-relaxed">
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        {(selectedSpeaker.presentationTitle as any)?.[lang] ||
                                         // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                         (selectedSpeaker.presentationTitle as any)?.ko ||
                                         t(selectedSpeaker.presentationTitle) ||
                                         (lang === 'ko' ? '주제 미정' : 'TBD')}
                                    </p>
                                </div>

                                {/* Bio Section - Enhanced Design */}
                                {selectedSpeaker.bio && (
                                    <div>
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/30">
                                                <span className="text-white text-xl">👤</span>
                                            </div>
                                            <h5 className="text-lg md:text-xl font-bold text-emerald-900 uppercase tracking-wide">
                                                {lang === 'ko' ? '소개' : 'Biography'}
                                            </h5>
                                        </div>
                                        <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm">
                                            <p className="text-lg md:text-xl text-slate-600 leading-relaxed whitespace-pre-wrap">
                                                {t(selectedSpeaker.bio)}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </section>
    );
};
