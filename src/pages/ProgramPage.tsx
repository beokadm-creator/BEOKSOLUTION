import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useConference } from '../hooks/useConference';
import { useUserStore } from '../store/userStore';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Button } from '../components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogTitle
} from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ChevronLeft, MapPin, User, Mic2, Calendar } from 'lucide-react';
import { Agenda, Speaker } from '../types/schema';
import { format } from 'date-fns';

const ProgramPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { info, agendas, speakers, loading, error } = useConference();
    const { language } = useUserStore();

    // Helper for localized text
    const t = (val: string | { ko?: string; en?: string } | null | undefined): string => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        return (language === 'en' ? val.en : val.ko) || val.ko || '';
    };

    // Bio Modal State
    const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null);

    // Group agendas by date
    const groupedAgendas = useMemo(() => {
        if (!agendas) return {};

        const groups: Record<string, Agenda[]> = {};
        
        agendas.forEach(agenda => {
            if (!agenda.startTime) return;
            const date = new Date(agenda.startTime.seconds * 1000);
            const dateKey = format(date, 'yyyy-MM-dd'); // e.g. 2026-05-20
            
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(agenda);
        });

        // Sort items by time within each group
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => a.startTime.seconds - b.startTime.seconds);
        });

        return groups;
    }, [agendas]);

    // Sort dates
    const sortedDates = Object.keys(groupedAgendas).sort();

    if (loading) return <LoadingSpinner />;
    if (error) return <div className="p-8 text-center text-red-500">Error loading program: {error}</div>;

    return (
        <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans text-slate-900">
             {/* Header */}
             <header className="sticky top-0 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => navigate(`/${slug}`)}
                        className="text-slate-600 hover:text-slate-900 pl-0 hover:bg-transparent"
                    >
                        <ChevronLeft className="w-5 h-5 mr-1" />
                        {language === 'ko' ? '홈으로' : 'Home'}
                    </Button>
                    <div className="font-bold text-lg text-slate-900 truncate max-w-[200px]">
                        {language === 'ko' ? '프로그램' : 'Program'}
                    </div>
                    <div className="w-10" /> {/* Spacer for centering */}
                </div>
            </header>

            <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 md:py-12">
                <div className="text-center mb-10">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">
                        {language === 'ko' ? '학술 프로그램' : 'Conference Program'}
                    </h1>
                    <p className="text-slate-500 text-lg">
                        {info ? t(info.title) : ''}
                    </p>
                </div>

                {sortedDates.length === 0 ? (
                    <div className="text-center text-gray-500 py-20 bg-white rounded-2xl border border-gray-200 shadow-sm">
                        <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                        <p className="text-lg font-medium">{language === 'ko' ? '등록된 일정이 없습니다.' : 'No sessions scheduled yet.'}</p>
                    </div>
                ) : (
                    <Tabs defaultValue={sortedDates[0]} className="w-full">
                        <div className="flex justify-center mb-8 sticky top-20 z-40">
                            <TabsList className="h-auto p-1 bg-white/90 backdrop-blur border border-slate-200 shadow-sm rounded-full inline-flex">
                                {sortedDates.map((dateKey, index) => {
                                    const dateObj = new Date(dateKey);
                                    return (
                                        <TabsTrigger 
                                            key={dateKey} 
                                            value={dateKey}
                                            className="px-6 py-2.5 rounded-full text-base font-medium data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all"
                                        >
                                            Day {index + 1} <span className="ml-2 text-xs opacity-70 font-normal">{format(dateObj, 'MM.dd')}</span>
                                        </TabsTrigger>
                                    );
                                })}
                            </TabsList>
                        </div>

                        {sortedDates.map(dateKey => {
                            const dayAgendas = groupedAgendas[dateKey];
                            
                            return (
                                <TabsContent key={dateKey} value={dateKey} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-0">
                                    {dayAgendas.map(agenda => {
                                        const start = new Date(agenda.startTime.seconds * 1000);
                                        const end = new Date(agenda.endTime.seconds * 1000);
                                        const sessionSpeakers = speakers.filter(s => s.agendaId === agenda.id);
                                        
                                        // Sort speakers by sessionTime if available
                                        sessionSpeakers.sort((a, b) => {
                                            if (a.sessionTime && b.sessionTime) {
                                                return a.sessionTime.localeCompare(b.sessionTime);
                                            }
                                            return 0;
                                        });

                                        return (
                                            <div 
                                                key={agenda.id} 
                                                className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all duration-300 overflow-hidden"
                                            >
                                                <div className="flex flex-col md:flex-row">
                                                    {/* Time Section - Desktop Left Sidebar style */}
                                                    <div className="md:w-48 bg-slate-50/50 p-6 md:border-r border-slate-100 flex flex-row md:flex-col justify-between md:justify-start items-center md:items-start gap-3">
                                                        <div className="text-center md:text-left">
                                                            <div className="text-xl font-bold text-slate-900 font-mono tracking-tight">
                                                                {format(start, 'HH:mm')}
                                                            </div>
                                                            <div className="text-sm text-slate-400 font-medium pl-0.5">
                                                                ~ {format(end, 'HH:mm')}
                                                            </div>
                                                        </div>
                                                        
                                                        {agenda.location && (
                                                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                                                <MapPin className="w-3.5 h-3.5 text-blue-500" />
                                                                {agenda.location}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Content Section */}
                                                    <div className="flex-1 p-6 md:p-8">
                                                        {/* Session Header */}
                                                        <div className="flex flex-wrap items-start gap-3 mb-4">
                                                            {agenda.sessionType && (
                                                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-wider">
                                                                    {agenda.sessionType}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-3 leading-snug">
                                                            {t(agenda.title)}
                                                        </h3>
                                                        
                                                        {agenda.description && (
                                                            <p className="text-slate-600 text-sm leading-relaxed mb-6 max-w-3xl">
                                                                {t(agenda.description)}
                                                            </p>
                                                        )}

                                                        {/* Speakers Grid */}
                                                        {sessionSpeakers.length > 0 && (
                                                            <div className="mt-6 grid grid-cols-1 gap-4">
                                                                {sessionSpeakers.map(speaker => (
                                                                     <div 
                                                                         key={speaker.id} 
                                                                         className="relative flex flex-col sm:flex-row gap-5 p-5 bg-slate-50/80 rounded-xl border border-slate-100 hover:bg-blue-50/50 hover:border-blue-100 transition-colors cursor-pointer group/speaker"
                                                                         onClick={() => setSelectedSpeaker(speaker)}
                                                                     >
                                                                         {/* Time Badge inside Speaker Card */}
                                                                         {speaker.sessionTime && (
                                                                             <div className="absolute top-4 right-4 text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded border border-slate-100">
                                                                                 {speaker.sessionTime}
                                                                             </div>
                                                                         )}

                                                                         {/* Avatar */}
                                                                         <div className="flex-shrink-0">
                                                                             <div className="w-16 h-16 rounded-full bg-white border-2 border-white shadow-sm overflow-hidden mx-auto sm:mx-0">
                                                                                 {speaker.photoUrl ? (
                                                                                     <img src={speaker.photoUrl} alt={t(speaker.name)} className="w-full h-full object-cover" />
                                                                                 ) : (
                                                                                     <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300">
                                                                                         <User className="w-8 h-8" />
                                                                                     </div>
                                                                                 )}
                                                                             </div>
                                                                         </div>

                                                                         {/* Speaker Details */}
                                                                         <div className="flex-1 text-center sm:text-left">
                                                                             {/* Presentation Title (TOPIC) - Highlighted */}
                                                                             <div className="mb-2">
                                                                                {speaker.presentationTitle ? (
                                                                                    <h4 className="text-base md:text-lg font-bold text-slate-900 leading-tight group-hover/speaker:text-blue-700 transition-colors">
                                                                                        {t(speaker.presentationTitle)}
                                                                                    </h4>
                                                                                ) : (
                                                                                    <span className="text-sm text-slate-400 italic">
                                                                                        {language === 'ko' ? '주제 미정' : 'Topic TBD'}
                                                                                    </span>
                                                                                )}
                                                                             </div>

                                                                             {/* Name & Org */}
                                                                             <div className="flex flex-col sm:flex-row items-center sm:items-baseline gap-1 sm:gap-2 text-sm text-slate-600">
                                                                                 <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                                                                                    <Mic2 className="w-3.5 h-3.5 text-slate-400" />
                                                                                    {t(speaker.name)}
                                                                                 </span>
                                                                                 {speaker.organization && (
                                                                                     <>
                                                                                         <span className="hidden sm:inline text-slate-300">|</span>
                                                                                         <span className="text-slate-500">{t(speaker.organization)}</span>
                                                                                     </>
                                                                                 )}
                                                                             </div>
                                                                         </div>
                                                                     </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    {/* Empty state for the day */}
                                    {dayAgendas.length === 0 && (
                                        <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                                            {language === 'ko' ? '해당 날짜에 일정이 없습니다.' : 'No sessions for this day.'}
                                        </div>
                                    )}
                                </TabsContent>
                            );
                        })}
                    </Tabs>
                )}
            </main>

            {/* Bio Modal */}
            <Dialog open={!!selectedSpeaker} onOpenChange={() => setSelectedSpeaker(null)}>
                <DialogContent className="max-w-md sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-0 overflow-hidden border-0">
                    {/* Header Image Background */}
                    <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-700 relative">
                        <DialogTitle className="sr-only">Speaker Details</DialogTitle>
                        <Button 
                            variant="ghost" 
                            className="absolute top-2 right-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full w-8 h-8 p-0"
                            onClick={() => setSelectedSpeaker(null)}
                        >
                            <span className="sr-only">Close</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </Button>
                    </div>

                    {selectedSpeaker && (
                        <div className="px-6 pb-8 -mt-12 flex flex-col items-center text-center relative z-10">
                            {/* Avatar */}
                            <div className="w-24 h-24 rounded-full bg-white p-1 shadow-lg mb-4">
                                <div className="w-full h-full rounded-full overflow-hidden bg-slate-100">
                                    {selectedSpeaker.photoUrl ? (
                                        <img src={selectedSpeaker.photoUrl} alt={t(selectedSpeaker.name)} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <User className="w-10 h-10 text-slate-300" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* Name & Org */}
                            <h2 className="text-2xl font-bold text-slate-900 mb-1">
                                {t(selectedSpeaker.name)}
                            </h2>
                            {selectedSpeaker.organization && (
                                <p className="text-blue-600 font-medium mb-6 bg-blue-50 px-3 py-1 rounded-full text-sm">
                                    {t(selectedSpeaker.organization)}
                                </p>
                            )}

                            {/* Presentation Title */}
                            <div className="w-full bg-slate-50 p-5 rounded-xl mb-6 border border-slate-100 text-left">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Mic2 className="w-3.5 h-3.5" />
                                    Lecture
                                </h3>
                                <p className="font-bold text-slate-900 text-lg leading-relaxed">
                                    {selectedSpeaker.presentationTitle ? t(selectedSpeaker.presentationTitle) : (
                                        <span className="text-slate-400 italic">
                                            {language === 'ko' ? '주제 미정' : 'Topic TBD'}
                                        </span>
                                    )}
                                </p>
                            </div>
                            
                            {/* Bio */}
                            {selectedSpeaker.bio && (
                                <div className="w-full text-left">
                                    <h3 className="text-sm font-bold text-slate-900 mb-3 border-b border-slate-100 pb-2">
                                        {language === 'ko' ? '약력' : 'Biography'}
                                    </h3>
                                    <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                        {t(selectedSpeaker.bio)}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ProgramPage;