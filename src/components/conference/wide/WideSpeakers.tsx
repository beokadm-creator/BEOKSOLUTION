import React, { useState } from 'react';
import { Speaker } from '../../../types/conference';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../ui/dialog';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

interface WideSpeakersProps {
    speakers?: Speaker[];
    lang?: string;
}

export const WideSpeakers: React.FC<WideSpeakersProps> = ({ speakers, lang = 'ko' }) => {
    const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null);

    const t = (val: any) => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        return (lang === 'en' ? val.en : val.ko) || val.ko || '';
    };

    if (!speakers || speakers.length === 0) return null;

    return (
        <section className="w-full">
            <div className="text-center mb-12">
                <h3 className="text-3xl font-bold text-slate-900 mb-4">{lang === 'ko' ? '초청 연자' : 'Invited Speakers'}</h3>
                <p className="text-slate-500 max-w-2xl mx-auto">
                    {lang === 'ko' 
                        ? '분야별 최고의 전문가들과 함께하는 깊이 있는 강연을 만나보세요.' 
                        : 'Meet our distinguished speakers sharing their expertise and insights.'}
                </p>
            </div>

            <div className="px-4 md:px-8">
                <Swiper
                    modules={[Navigation, Pagination, Autoplay]}
                    spaceBetween={30}
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
                                className="flex flex-col items-center text-center group cursor-pointer"
                                onClick={() => setSelectedSpeaker(speaker)}
                            >
                                <div className="relative w-48 h-48 mb-6 rounded-full overflow-hidden shadow-lg border-4 border-white ring-1 ring-slate-100 group-hover:ring-blue-200 transition-all group-hover:scale-105 bg-slate-100">
                                    {speaker.photoUrl ? (
                                        <img 
                                            src={speaker.photoUrl} 
                                            alt={t(speaker.name)} 
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400 text-5xl">
                                            👤
                                        </div>
                                    )}
                                </div>
                                
                                <h4 className="text-xl font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                                    {t(speaker.name)}
                                </h4>
                                
                                <p className="text-sm font-medium text-blue-600 mb-3 line-clamp-2 min-h-[2.5rem]">
                                    {t(speaker.organization)}
                                </p>
                            </div>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>

            <Dialog open={!!selectedSpeaker} onOpenChange={(open) => !open && setSelectedSpeaker(null)}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="sr-only">Speaker Details</DialogTitle>
                        <DialogDescription className="sr-only">Details about the speaker</DialogDescription>
                    </DialogHeader>
                    
                    {selectedSpeaker && (
                        <div className="flex flex-col md:flex-row gap-8">
                            {/* Photo Side */}
                            <div className="flex flex-col items-center md:items-start shrink-0">
                                <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-white shadow-lg mb-4 bg-slate-100">
                                    {selectedSpeaker.photoUrl ? (
                                        <img 
                                            src={selectedSpeaker.photoUrl} 
                                            alt={t(selectedSpeaker.name)} 
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400 text-4xl">
                                            👤
                                        </div>
                                    )}
                                </div>
                                <div className="text-center md:text-left">
                                    <h4 className="text-2xl font-bold text-slate-900">{t(selectedSpeaker.name)}</h4>
                                    <p className="text-blue-600 font-medium">{t(selectedSpeaker.organization)}</p>
                                </div>
                            </div>

                            {/* Info Side */}
                            <div className="flex-1 space-y-6">
                                {/* Lecture Title */}
                                <div>
                                    <h5 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-2">Lecture</h5>
                                    <p className="text-lg font-bold text-slate-800 leading-snug">
                                        {(selectedSpeaker.lectureTitle as any)?.[lang] || (selectedSpeaker.lectureTitle as any)?.ko || t(selectedSpeaker.lectureTitle) || (lang === 'ko' ? '주제 미정' : 'TBD')}
                                    </p>
                                </div>

                                {/* Bio */}
                                {selectedSpeaker.bio && (
                                    <div>
                                        <h5 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-2">Biography</h5>
                                        <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                                            {t(selectedSpeaker.bio)}
                                        </p>
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
