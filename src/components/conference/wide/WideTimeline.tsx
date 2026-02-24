import React from 'react';
import { formatSafeDate, toSafeDate } from '../../../utils/date';

type LocalizedString = { [lang: string]: string } | string;

export interface TimelineStep {
  name: LocalizedString;
  start: Date;
  end: Date;
}

interface WideTimelineProps {
  steps: TimelineStep[];
  lang: string;
}

export const WideTimeline: React.FC<WideTimelineProps> = ({ steps, lang }) => {
  const t = (val: LocalizedString | undefined): string => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    return (lang === 'en' ? val.en : val.ko) || val.ko || '';
  };

  return (
    <div className="relative flex items-center justify-between mb-8 px-2 max-w-2xl mx-auto">
      {/* Connectors */}
      <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-0"></div>

      {steps.map((step, idx) => {
        const today = new Date();
        const start = toSafeDate(step.start);
        const end = toSafeDate(step.end);
        const isActive = start && end && today >= start && today <= end;
        const isPast = end && today > end;

        return (
          <div key={idx} className="relative z-10 flex flex-col items-center">
            <div 
              className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                isActive 
                  ? 'bg-[var(--primary)] border-[var(--primary)] scale-125 ring-4 ring-blue-50' 
                  : isPast 
                    ? 'bg-slate-300 border-slate-300' 
                    : 'bg-white border-slate-300'
              }`}
            ></div>
            <div className="mt-3 text-center">
              <p 
                className={`text-xs font-bold ${
                  isActive ? 'text-[var(--primary)]' : 'text-slate-400'
                }`}
              >
                {t(step.name)}
              </p>
              {end && (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  ~{formatSafeDate(end)}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
