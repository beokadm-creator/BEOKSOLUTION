import React from 'react';
import { Conference } from '../../../types/schema';
import { Calendar, MapPin, ChevronRight, Trophy, Clock, ArrowRight } from 'lucide-react';
import type { Language } from '../../../hooks/useLanguage';

import { formatSafeDate } from '../../../utils/date';

interface ConferenceListSectionProps {
  activeConferences: Conference[];
  upcomingConferences: Conference[];
  pastConferences: Conference[];
  onRegisterClick: (conf: Conference) => void;
  getConferenceUrl: (conf: Conference, path?: string) => string;
  language?: Language;
}

// Format date helper function
const formatDate = (ts: { seconds: number } | Date, language: Language = 'ko') => {
  return formatSafeDate(ts, language === 'ko' ? 'ko-KR' : 'en-US');
};

const ConferenceListSection: React.FC<ConferenceListSectionProps> = ({
  activeConferences,
  upcomingConferences,
  pastConferences,
  // onRegisterClick prop received but handled internally by navigation
  getConferenceUrl,
  language = 'ko',
}) => {
  const getLocalizedText = (text: { ko?: string; en?: string } | string | undefined) => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    return text[language] || text.ko || '';
  };

  return (
    <div className="space-y-24">
      {/* 1. Scheduled Conferences (Active/Open) */}
      {(activeConferences.length > 0 || (activeConferences.length === 0 && upcomingConferences.length === 0 && pastConferences.length === 0)) && (
        <section>
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
              <Calendar size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                {language === 'ko' ? '예정된 학술대회' : 'Scheduled Conferences'}
              </h3>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
                {language === 'ko' ? '등록 및 참여 가능' : 'Open for Registration'}
              </p>
            </div>
          </div>

          {activeConferences.length === 0 ? (
            <div className="bg-slate-50 border border-slate-100 rounded-[2.5rem] p-16 text-center">
              <p className="text-lg font-bold text-slate-400">
                {language === 'ko' ? '현재 예정된 학술대회가 없습니다.' : 'No scheduled conferences at this time.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8">
              {activeConferences.map((conf) => (
                <div
                  key={conf.id}
                  className="group relative bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-blue-600/10 transition-all duration-300 overflow-hidden flex flex-col lg:flex-row"
                >
                  {/* Image Section */}
                  <div className="lg:w-2/5 aspect-video lg:aspect-auto bg-slate-900 relative overflow-hidden flex items-center justify-center p-10">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900"></div>
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>

                    {/* Visual Content */}
                    <div className="relative z-10 text-center">
                      <div className="w-20 h-20 mx-auto bg-white/10 backdrop-blur-sm rounded-3xl flex items-center justify-center text-white mb-6 border border-white/10 shadow-2xl">
                        <Calendar size={32} strokeWidth={1.5} />
                      </div>
                      <h3 className="text-3xl font-black text-white uppercase tracking-widest break-words leading-tight opacity-90">
                        {conf.slug.replace(/[^0-9a-zA-Z]/g, ' ')}
                      </h3>
                    </div>

                    {/* Status Badge */}
                    <div className="absolute top-6 left-6">
                      <div className="bg-blue-500 text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                        {language === 'ko' ? '접수중' : 'Open'}
                      </div>
                    </div>
                  </div>

                  {/* Content Section */}
                  <div className="p-8 lg:p-10 flex-1 flex flex-col justify-between relative bg-white">
                    <div className="space-y-8">
                      <div>
                        <h4 className="text-2xl md:text-3xl font-black text-slate-900 mb-2 leading-tight">
                          {getLocalizedText(conf.title)}
                        </h4>
                        <div className="h-1 w-12 bg-blue-600 rounded-full"></div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Date</p>
                          <p className="text-slate-700 font-bold text-lg flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                              <Calendar size={16} />
                            </span>
                            {formatDate(conf.dates?.start, language)}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Location</p>
                          <p className="text-slate-700 font-bold text-lg flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                              <MapPin size={16} />
                            </span>
                            {getLocalizedText(conf.venue?.name) || conf.location || (language === 'ko' ? '추후 공지' : 'TBD')}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-10">
                      <button
                        onClick={() => (window.location.href = getConferenceUrl(conf))}
                        className="w-full bg-slate-900 text-white py-5 px-6 rounded-2xl font-bold text-base hover:bg-black transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98] flex items-center justify-center gap-2 group-hover:bg-blue-600 group-hover:shadow-blue-600/20"
                      >
                        <span>{language === 'ko' ? '학술대회 등록하기' : 'Register Now'}</span>
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 2. Preparing Conferences (Upcoming/Planning) */}
      {upcomingConferences.length > 0 && (
        <section>
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <Clock size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                {language === 'ko' ? '준비 중인 학술대회' : 'Preparing Conferences'}
              </h3>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
                {language === 'ko' ? '개최 예정' : 'Coming Soon'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingConferences.map((conf) => (
              <div
                key={conf.id}
                className="group relative bg-white p-8 rounded-[2rem] border border-slate-100 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-900/5 transition-all duration-300"
              >
                <div className="absolute top-8 right-8 w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>

                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 font-black text-xs shadow-sm">
                  TBD
                </div>

                <h4 className="text-xl font-black text-slate-900 mb-3 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
                  {getLocalizedText(conf.title)}
                </h4>

                <div className="space-y-2 mb-8">
                  <p className="text-sm font-bold text-slate-500 flex items-center gap-2">
                    <Calendar size={14} />
                    {formatDate(conf.dates?.start, language)}
                  </p>
                  <p className="text-sm font-bold text-slate-400 flex items-center gap-2">
                    <MapPin size={14} />
                    {getLocalizedText(conf.venue?.name) || conf.location || (language === 'ko' ? '장소 미정' : 'Location TBD')}
                  </p>
                </div>

                <button
                  type="button"
                  disabled
                  className="w-full py-3 rounded-xl bg-slate-50 text-slate-400 font-bold text-xs cursor-not-allowed uppercase tracking-widest border border-slate-100"
                >
                  {language === 'ko' ? '준비 중' : 'Preparing'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Past Conferences (History) */}
      {pastConferences.length > 0 && (
        <section>
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500">
              <Trophy size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                {language === 'ko' ? '지난 학술대회' : 'Past Conferences'}
              </h3>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
                {language === 'ko' ? '아카이브' : 'Archive'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pastConferences.map((conf) => (
              <div
                key={conf.id}
                className="group bg-white p-6 rounded-3xl border border-slate-100 flex items-center justify-between hover:border-slate-200 hover:shadow-lg transition-all cursor-pointer"
                onClick={() => (window.location.href = getConferenceUrl(conf))}
              >
                <div className="flex items-center gap-5 min-w-0">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 font-black text-xs uppercase tracking-tighter flex-shrink-0 group-hover:bg-slate-100 transition-colors">
                    {conf.slug.substring(0, 3)}
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-base font-bold text-slate-800 leading-tight truncate group-hover:text-slate-900 mb-1">
                      {getLocalizedText(conf.title)}
                    </h5>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                      {formatDate(conf.dates?.start, language)}
                    </p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-slate-600 group-hover:border-slate-300 transition-all">
                  <ChevronRight size={18} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ConferenceListSection;
