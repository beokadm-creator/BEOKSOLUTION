import React from 'react';
import { Conference } from '../../../types/schema';
import { Calendar, MapPin, ChevronRight, Target, Trophy } from 'lucide-react';
import type { Language } from '../../../hooks/useLanguage';

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
  if (!ts) return 'TBA';
  const date = new Date(ts.seconds * 1000);
  return date.toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const ConferenceListSection: React.FC<ConferenceListSectionProps> = ({
  activeConferences,
  upcomingConferences,
  pastConferences,
  onRegisterClick,
  getConferenceUrl,
  language = 'ko',
}) => {
  const getLocalizedText = (text: { ko?: string; en?: string } | string | undefined) => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    return text[language] || text.ko || '';
  };
  return (
    <div className="space-y-20">
      {/* Active Conferences */}
      {(activeConferences.length > 0 || (activeConferences.length === 0 && upcomingConferences.length === 0 && pastConferences.length === 0)) && (
        <section>
          <div className="flex items-center gap-4 mb-12">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <Target size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Active Conferences</h3>
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mt-1">
                Registration & Abstract Submission Open
              </p>
            </div>
          </div>

          {activeConferences.length === 0 ? (
            <div className="bg-slate-50 border border-slate-100 rounded-[3rem] p-20 text-center animate-in fade-in">
              <p className="text-xl font-bold text-slate-400 mb-2">현재 진행 중인 학술대회가 없습니다.</p>
              <p className="text-slate-300 text-sm font-medium italic">
                진행 중인 학술대회가 준비되는 대로 안내해 드리겠습니다.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {activeConferences.map((conf) => (
                <div
                  key={conf.id}
                  className="group relative bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-blue-600/5 transition-all overflow-hidden flex flex-col md:flex-row"
                >
                  <div className="md:w-2/5 aspect-[4/3] md:aspect-auto bg-slate-900 relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-transparent"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-white/10 font-black text-6xl uppercase tracking-tighter select-none">
                      {conf.slug}
                    </div>
                    <div className="absolute top-6 left-6 bg-green-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                      Live Now
                    </div>
                  </div>
                  <div className="p-10 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-2xl font-black text-slate-900 mb-6 group-hover:text-blue-600 transition-colors leading-tight">
                        {conf.title.ko}
                      </h4>
                      <div className="space-y-3 text-slate-500">
                        <div className="flex items-center gap-3 text-sm font-bold">
                          <Calendar size={18} className="text-blue-500" />
                          {formatDate(conf.dates?.start)} — {formatDate(conf.dates?.end)}
                        </div>
                        <div className="flex items-center gap-3 text-sm font-bold">
                          <MapPin size={18} className="text-blue-500" />
                          {conf.location || 'Online / Venue TBD'}
                        </div>
                      </div>
                    </div>
                    <div className="mt-10 flex gap-3">
                      <button
                        onClick={() => onRegisterClick(conf)}
                        className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-blue-700 transition shadow-xl shadow-blue-600/20"
                      >
                        Register Now
                      </button>
                      <button
                        onClick={() => (window.location.href = getConferenceUrl(conf))}
                        className="w-14 h-14 bg-slate-100 text-slate-900 flex items-center justify-center rounded-2xl hover:bg-slate-200 transition"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Upcoming Conferences */}
      {upcomingConferences.length > 0 && (
        <section>
          <div className="flex items-center gap-4 mb-12">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <Calendar size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                {language === 'ko' ? '예정된 학술대회' : 'Upcoming Plans'}
              </h3>
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mt-1">
                {language === 'ko' ? '곧 개최' : 'Coming Soon'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {upcomingConferences.map((conf) => (
              <div
                key={conf.id}
                className="p-8 bg-white border border-slate-100 rounded-[2rem] hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-600/5 transition-all text-center"
              >
                <div className="mx-auto w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6 font-black text-xs">
                  SOON
                </div>
                <h4 className="text-xl font-black text-slate-900 mb-4 line-clamp-2 leading-tight">
                  {getLocalizedText(conf.title)}
                </h4>
                <p className="text-sm font-bold text-slate-400 mb-6">{formatDate(conf.dates?.start, language)}</p>
                <button
                  type="button"
                  onClick={() => (window.location.href = getConferenceUrl(conf))}
                  className="w-full py-3 rounded-xl border border-slate-100 text-slate-400 font-bold text-xs hover:bg-slate-50 transition uppercase tracking-widest"
                >
                  {language === 'ko' ? '정보 보기' : 'Preview Info'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Past Conferences */}
      {pastConferences.length > 0 && (
        <section>
          <div className="flex items-center gap-4 mb-12">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500">
              <Trophy size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                {language === 'ko' ? '학회 역사' : 'Society History'}
              </h3>
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mt-1">
                {language === 'ko' ? '지난 성공적인 행사들' : 'Successful Past Achievements'}
              </p>
            </div>
          </div>

          <div className="bg-slate-50/50 rounded-[3rem] border border-slate-100 p-10 overflow-hidden">
            <div className="space-y-4">
              {pastConferences.map((conf) => (
                <div
                  key={conf.id}
                  className="group bg-white p-6 rounded-3xl border border-slate-100 flex flex-col sm:flex-row justify-between items-center hover:shadow-lg transition-all gap-4"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 font-black text-[10px] uppercase tracking-tighter">
                      {conf.slug}
                    </div>
                    <div>
                      <h5 className="text-lg font-black text-slate-700 leading-tight">
                        {getLocalizedText(conf.title)}
                      </h5>
                      <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                        {formatDate(conf.dates?.start, language)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => (window.location.href = getConferenceUrl(conf))}
                    className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-50 transition uppercase tracking-widest"
                  >
                    {language === 'ko' ? '아카이브 상세' : 'Archive Details'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default ConferenceListSection;
