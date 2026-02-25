import React from 'react';
import { Agenda } from '../../../types/conference';

const formatDate = (dateValue: any) => {
    if (!dateValue) return '';
    const date = dateValue instanceof Date ? dateValue : (dateValue.toDate ? dateValue.toDate() : new Date(dateValue));
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

export const WideProgram = ({ agendas, lang = 'ko' }: { agendas?: Agenda[], lang?: string }) => {
    const t = (val: any) => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        return (lang === 'en' ? val.en : val.ko) || val.ko || '';
    };

    // 1. Safe Fallback: No Data
    if (!agendas || agendas.length === 0) {
        return (
            <section className="bg-white border border-slate-100 rounded-2xl p-8 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-6">Program Schedule</h3>
                <div className="p-8 border-2 border-dashed border-slate-300 rounded-xl text-center bg-slate-50">
                    <p className="text-slate-500 font-medium text-lg">세부 일정은 추후 공개됩니다.</p>
                    <p className="text-sm text-slate-400 mt-1 uppercase tracking-wide font-medium">(Schedule Coming Soon)</p>
                </div>
            </section>
        );
    }

    // 2. Data Exists (Timeline UI)
    // Sort agendas by startTime (Chronological Order)
    const sortedAgendas = [...agendas].sort((a, b) => {
        const getDate = (val: any) => {
            if (!val) return new Date(0);
            return val instanceof Date ? val : (val.toDate ? val.toDate() : new Date(val));
        };
        const dateA = getDate(a.startTime);
        const dateB = getDate(b.startTime);
        return dateA.getTime() - dateB.getTime();
    });

    // Group agendas by date
    const groupedAgendas = sortedAgendas.reduce((acc, agenda) => {
        // Handle date string or object
        let dateStr = agenda.date;
        // If date is missing but startTime exists, infer date from startTime
        if (!dateStr && agenda.startTime) {
            const startDate = agenda.startTime instanceof Date ? agenda.startTime : (agenda.startTime.toDate ? agenda.startTime.toDate() : new Date(agenda.startTime));
            dateStr = startDate.toLocaleDateString();
        }

        if (!dateStr) dateStr = 'TBD';

        if (!acc[dateStr]) acc[dateStr] = [];
        acc[dateStr].push(agenda);
        return acc;
    }, {} as Record<string, Agenda[]>);

    const sortedDates = Object.keys(groupedAgendas).sort();

    return (
        <section className="bg-transparent">
            <div className="space-y-16">
                {sortedDates.map((date) => (
                    <div key={date} className="relative">
                        <div className="flex items-center gap-4 mb-6 sticky top-20 z-10 bg-white/90 backdrop-blur py-2">
                            <h4 className="text-2xl font-bold text-slate-800 tracking-tight">
                                {date}
                            </h4>
                            <div className="h-px bg-slate-200 flex-1"></div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {groupedAgendas[date].map((agenda: Agenda) => {
                                const startTimeStr = formatDate(agenda.startTime);
                                const endTimeStr = formatDate(agenda.endTime);
                                const timeDisplay = endTimeStr ? `${startTimeStr} - ${endTimeStr}` : startTimeStr;

                                return (
                                    <div key={agenda.id} className="group relative flex flex-col md:flex-row gap-6 p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-blue-100 transition-all duration-300 border-l-4 border-l-blue-500 md:border-l-4 md:border-l-transparent md:hover:border-l-blue-500">
                                        {/* Mobile: Time Badge */}
                                        <div className="md:w-40 shrink-0 flex flex-row md:flex-col justify-between md:justify-start md:gap-2">
                                            <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-lg bg-slate-50 text-slate-600 font-mono font-bold text-sm border border-slate-200 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-colors">
                                                ⏰ {timeDisplay}
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 pt-1 md:pt-0">
                                            <h5 className="text-lg md:text-xl font-bold text-slate-800 mb-2 leading-relaxed group-hover:text-blue-700 transition-colors">
                                                {t(agenda.title)}
                                            </h5>

                                            <div className="flex flex-wrap gap-y-2 gap-x-6 text-sm text-slate-600">
                                                {agenda.speaker && (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-400">👤</div>
                                                        <span className="font-medium">{t(agenda.speaker)}</span>
                                                    </div>
                                                )}
                                                {agenda.location && (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-400">📍</div>
                                                        <span>{t(agenda.location)}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {agenda.description && (
                                                <p className="mt-4 text-slate-500 text-sm leading-relaxed border-t border-slate-100 pt-3">
                                                    {t(agenda.description)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};
