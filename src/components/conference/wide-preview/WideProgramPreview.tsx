import React, { useState, useMemo } from 'react';
import { Agenda, Speaker } from '../../../types/schema';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { MapPin, User, Mic2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { tryParseDate, hasToDate, hasSeconds } from '../../../utils/dateUtils';
import { SpeakerDetailDialog } from '../SpeakerDetailDialog';

export const WideProgramPreview = ({ agendas, speakers = [], lang = 'ko' }: { agendas?: Agenda[], speakers?: Speaker[], lang?: string }) => {
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
            let date: Date | null = null;
            if (agenda.startTime) {
                if (agenda.startTime instanceof Date) date = agenda.startTime;
                else if (hasToDate(agenda.startTime)) {
                    const parsed = agenda.startTime.toDate();
                    date = parsed instanceof Date ? parsed : null;
                } else if (hasSeconds(agenda.startTime)) {
                    date = new Date(agenda.startTime.seconds * 1000);
                } else date = tryParseDate(agenda.startTime);
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
                    if (hasSeconds(val)) return val.seconds;
                    if (val instanceof Date) return val.getTime() / 1000;
                    if (hasToDate(val)) {
                        const d = val.toDate();
                        return d instanceof Date ? d.getTime() / 1000 : 0;
                    }
                    return 0;
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
        else if (hasToDate(val)) {
            const parsed = val.toDate();
            if (!(parsed instanceof Date)) return '';
            date = parsed;
        } else if (hasSeconds(val)) {
            date = new Date(val.seconds * 1000);
        } else {
            const parsed = tryParseDate(val as string | number);
            if (!parsed) return '';
            date = parsed;
        }

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
                                                                            <img src={speaker.photoUrl} alt={t(speaker.name)} className="w-full h-full object-contain" />
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

            <SpeakerDetailDialog
                speaker={selectedSpeaker}
                lang={lang}
                onClose={() => setSelectedSpeaker(null)}
            />
        </div>
    );
};
