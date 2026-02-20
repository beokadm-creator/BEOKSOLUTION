import React, { useState, useMemo } from 'react';
import { Agenda, Speaker } from '../../../types/schema';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { MapPin, User, Mic2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription
} from '../../ui/dialog';

export const WideProgram = ({ agendas, speakers = [], lang = 'ko' }: { agendas?: Agenda[], speakers?: Speaker[], lang?: string }) => {
    // Cast to Schema types for better type safety internally
    const safeAgendas = useMemo(() => (agendas || []) as Agenda[], [agendas]);
    const safeSpeakers = (speakers || []) as Speaker[];

    // Helper for localized text
     
    const t = (val: unknown) => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        return (lang === 'en' ? val.en : val.ko) || val.ko || '';
    };

    // Bio Modal State
    const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null);

    // Group agendas by date
    const groupedAgendas = useMemo(() => {
        if (!safeAgendas.length) return {};

        const groups: Record<string, Agenda[]> = {};

        safeAgendas.forEach(agenda => {
            // Handle various timestamp formats (Firestore Timestamp, Date, string)
            let date: Date | null = null;
            if (agenda.startTime) {
                if (agenda.startTime instanceof Date) date = agenda.startTime;
                // @ts-expect-error - Check for Firestore Timestamp toDate()
                else if (agenda.startTime.toDate) date = agenda.startTime.toDate();
                // @ts-expect-error - Check for seconds (Firestore serialized)
                else if (agenda.startTime.seconds) date = new Date(agenda.startTime.seconds * 1000);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                else date = new Date(agenda.startTime as any);
            }

            if (!date || isNaN(date.getTime())) return;

            const dateKey = format(date, 'yyyy-MM-dd'); // e.g. 2026-05-20

            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(agenda);
        });

        // Sort items by time within each group
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => {
                 
                const getSeconds = (val: unknown) => {
                    if (!val) return 0;
                    if (val.seconds) return val.seconds;
                    if (val instanceof Date) return val.getTime() / 1000;
                    if (val.toDate) return val.toDate().getTime() / 1000;
                    return new Date(val).getTime() / 1000;
                };
                return getSeconds(a.startTime) - getSeconds(b.startTime);
            });
        });

        return groups;
    }, [safeAgendas]);

    // Sort dates
    const sortedDates = Object.keys(groupedAgendas).sort();

    // Helper to format time
     
    const formatTime = (val: unknown) => {
        if (!val) return '';
        let date: Date;
        if (val instanceof Date) date = val;
        // @ts-expect-error - Check for Firestore Timestamp
        else if (val.toDate) date = val.toDate();
        // @ts-expect-error - Check for seconds
        else if (val.seconds) date = new Date(val.seconds * 1000);
        else date = new Date(val);

        if (isNaN(date.getTime())) return '';
        return format(date, 'HH:mm');
    };

    if (sortedDates.length === 0) {
        return (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <p className="text-lg font-medium text-slate-500">
                    {lang === 'ko' ? '등록된 일정이 없습니다.' : 'No sessions scheduled yet.'}
                </p>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="text-center mb-12 md:mb-16">
                <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
                    {lang === 'ko' ? '프로그램' : 'Program'}
                </h2>
                <div className="w-16 h-1.5 bg-blue-600 mx-auto rounded-full opacity-80"></div>
            </div>

            <Tabs defaultValue={sortedDates[0]} className="w-full">
                <div className="flex justify-center mb-10 md:mb-12 sticky top-16 md:top-20 z-40">
                    <TabsList className="h-auto p-1.5 md:p-2 bg-white/95 backdrop-blur border border-slate-200 shadow-md rounded-full inline-flex">
                        {sortedDates.map((dateKey, index) => {
                            const dateObj = new Date(dateKey);
                            return (
                                <TabsTrigger
                                    key={dateKey}
                                    value={dateKey}
                                    className="px-4 md:px-6 py-2 md:py-2.5 rounded-full text-sm md:text-base font-medium data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all min-w-[100px] md:min-w-[120px]"
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
                        <TabsContent key={dateKey} value={dateKey} className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-0">
                            {dayAgendas.map(agenda => {
                                // Filter speakers for this agenda
                                const sessionSpeakers = safeSpeakers.filter(s => s.agendaId === agenda.id);

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
                                            <div className="md:w-48 bg-slate-50/50 p-5 md:p-6 md:border-r border-slate-100 flex flex-row md:flex-col justify-between md:justify-start items-center md:items-start gap-3">
                                                <div className="text-center md:text-left">
                                                    <div className="text-xl md:text-2xl font-bold text-slate-900 font-mono tracking-tight">
                                                        {formatTime(agenda.startTime)}
                                                    </div>
                                                    <div className="text-sm md:text-base text-slate-400 font-medium pl-0.5">
                                                        ~ {formatTime(agenda.endTime)}
                                                    </div>
                                                </div>

                                                {agenda.location && (
                                                    <div className="flex items-center gap-1.5 text-xs md:text-sm font-medium text-slate-500 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                                        <MapPin className="w-3.5 h-3.5 text-blue-500" />
                                                        {t(agenda.location)}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Content Section */}
                                            <div className="flex-1 p-5 md:p-6 lg:p-8">
                                                {/* Session Header */}
                                                <div className="flex flex-wrap items-start gap-3 mb-4">
                                                    {agenda.sessionType && (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs md:text-sm font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-wider">
                                                            {agenda.sessionType}
                                                        </span>
                                                    )}
                                                </div>

                                                <h3 className="text-lg md:text-2xl font-bold text-slate-900 mb-3 leading-snug">
                                                    {t(agenda.title)}
                                                </h3>

                                                {agenda.description && (
                                                    <p className="text-slate-600 text-sm md:text-base leading-relaxed mb-6 max-w-3xl">
                                                        {t(agenda.description)}
                                                    </p>
                                                )}

                                                {/* Speakers Grid */}
                                                {sessionSpeakers.length > 0 && (
                                                    <div className="mt-6 grid grid-cols-1 gap-4">
                                                        {sessionSpeakers.map(speaker => (
                                                            <button
                                                                type="button"
                                                                key={speaker.id}
                                                                className="relative flex flex-col sm:flex-row gap-4 md:gap-5 p-4 md:p-5 bg-slate-50/80 rounded-xl border border-slate-100 hover:bg-blue-50/50 hover:border-blue-100 transition-colors cursor-pointer group/speaker text-left"
                                                                onClick={() => setSelectedSpeaker(speaker)}
                                                                aria-label={`View ${t(speaker.name)} details`}
                                                            >
                                                                {/* Time Badge inside Speaker Card */}
                                                                {speaker.sessionTime && (
                                                                    <div className="absolute top-3 md:top-4 right-3 md:right-4 text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded border border-slate-100">
                                                                        {speaker.sessionTime}
                                                                    </div>
                                                                )}

                                                                {/* Avatar */}
                                                                <div className="flex-shrink-0">
                                                                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white border-2 border-white shadow-sm overflow-hidden mx-auto sm:mx-0">
                                                                        {speaker.photoUrl ? (
                                                                            <img src={speaker.photoUrl} alt={t(speaker.name)} className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300">
                                                                                <User className="w-7 h-7 md:w-8 md:h-8" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Speaker Details */}
                                                                <div className="flex-1 text-center sm:text-left">
                                                                    {/* Presentation Title (TOPIC) - Highlighted */}
                                                                    <div className="mb-2">
                                                                        {speaker.presentationTitle ? (
                                                                            <h4 className="text-sm md:text-lg font-bold text-slate-900 leading-tight group-hover/speaker:text-blue-700 transition-colors">
                                                                                {t(speaker.presentationTitle)}
                                                                            </h4>
                                                                        ) : (
                                                                            <span className="text-xs md:text-sm text-slate-400 italic">
                                                                                {lang === 'ko' ? '주제 미정' : 'Topic TBD'}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    {/* Name & Org */}
                                                                    <div className="flex flex-col sm:flex-row items-center sm:items-baseline gap-1 sm:gap-2 text-xs md:text-sm text-slate-600">
                                                                        <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                                                                            <Mic2 className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-400" />
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
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </TabsContent>
                    );
                })}
            </Tabs>

            {/* Enhanced Bio Modal with Mobile Optimization & Scroll */}
            <Dialog open={!!selectedSpeaker} onOpenChange={() => setSelectedSpeaker(null)}>
                <DialogContent className="max-w-xl md:max-w-2xl max-h-[85vh] md:max-h-[80vh] overflow-y-auto rounded-2xl md:rounded-3xl p-0 border-0 shadow-2xl data-[state=open]:fade-in data-[state=closed]:fade-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 custom-scrollbar">
                    {/* Hide default close button from Radix UI */}
                    <DialogTitle className="sr-only">Speaker Details</DialogTitle>
                    <DialogDescription className="sr-only">Detailed speaker information</DialogDescription>

                    {selectedSpeaker && (
                        <>
                            {/* Header with Gradient & Close Button */}
                            <div className="relative h-36 md:h-48 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 overflow-hidden shrink-0">
                                {/* Decorative Pattern Overlay */}
                                <div className="absolute inset-0 opacity-10">
                                    <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2" />
                                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-white rounded-full blur-2xl transform translate-x-1/3 translate-y-1/3" />
                                </div>
                                {/* Custom Close Button - Hides default Radix UI close button */}
                                <button
                                    type="button"
                                    onClick={() => setSelectedSpeaker(null)}
                                    className="absolute top-3 right-3 md:top-4 md:right-4 text-white/90 hover:text-white hover:bg-white/20 rounded-full w-10 h-10 md:w-11 md:h-11 p-0 transition-all duration-200 shadow-lg backdrop-blur-sm z-20"
                                    aria-label="Close modal"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                    <span className="sr-only">Close</span>
                                </button>
                            </div>

                            {/* Content Area (Part of overall modal scroll) */}
                            <div className="px-5 md:px-8 pb-6 md:pb-8 -mt-20 md:-mt-24">
                                <div className="flex flex-col items-center text-center relative z-10">
                                    {/* Avatar with Glow Effect */}
                                    <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-white p-1.5 md:p-2 shadow-2xl mb-4 md:mb-5 ring-4 ring-white/50">
                                        <div className="w-full h-full rounded-full overflow-hidden bg-slate-100 relative">
                                            {selectedSpeaker.photoUrl ? (
                                                <img
                                                    src={selectedSpeaker.photoUrl}
                                                    alt={`${t(selectedSpeaker.name)} profile`}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                                                    <User className="w-14 h-14 md:w-16 md:h-16 text-slate-400" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Name & Org Section */}
                                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 mb-2 tracking-tight">
                                        {t(selectedSpeaker.name)}
                                    </h2>
                                    {selectedSpeaker.organization && (
                                        <p className="text-sm md:text-base lg:text-lg font-semibold text-blue-600 mb-5 md:mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2 rounded-full border border-blue-100 shadow-sm inline-block">
                                            {t(selectedSpeaker.organization)}
                                        </p>
                                    )}

                                    {/* Enhanced Presentation Title Card */}
                                    {selectedSpeaker.presentationTitle && (
                                        <div className="w-full bg-gradient-to-br from-slate-50 to-slate-100 p-5 md:p-6 rounded-2xl mb-5 md:mb-6 border border-slate-200 shadow-lg text-left">
                                            <h3 className="text-sm md:text-base font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                <span className="bg-blue-100 text-blue-600 p-1.5 md:p-2 rounded-lg">
                                                    <Mic2 className="w-4 h-4 md:w-5 md:h-5" />
                                                </span>
                                                {lang === 'ko' ? '발표 주제' : 'Presentation Topic'}
                                            </h3>
                                            <p className="font-bold text-slate-900 text-base md:text-lg lg:text-xl leading-relaxed">
                                                {t(selectedSpeaker.presentationTitle)}
                                            </p>
                                        </div>
                                    )}

                                    {/* Enhanced Bio Section (No separate scroll - part of modal scroll) */}
                                    {selectedSpeaker.bio && (
                                        <div className="w-full text-left bg-white rounded-2xl p-5 md:p-6 border border-slate-200 shadow-sm">
                                            <h3 className="text-sm md:text-base font-bold text-slate-900 mb-3 pb-3 border-b-2 border-slate-100 flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500" />
                                                {lang === 'ko' ? '약력' : 'Biography'}
                                            </h3>
                                            {/* Bio content without separate scroll - part of overall modal scroll */}
                                            <div className="text-sm md:text-base lg:text-lg text-slate-600 leading-relaxed whitespace-pre-wrap">
                                                {t(selectedSpeaker.bio)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

// Custom scrollbar and hide default close button styles
const customScrollbarStyles = `
    /* Custom scrollbar styles for modal */
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: #f1f5f9;
        border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
    }

    /* Hide default Radix UI close button inside our custom dialog */
    [data-radix-dialog-content] .absolute.right-4.top-4[data-radix-dialog-close] {
        display: none !important;
    }
`;

// Inject custom styles
if (typeof document !== 'undefined') {
    const styleElement = document.createElement('style');
    styleElement.textContent = customScrollbarStyles;
    document.head.appendChild(styleElement);
}
