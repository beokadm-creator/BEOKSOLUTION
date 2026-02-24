import React from 'react';
import { Bell, Megaphone } from 'lucide-react';
import type { Language } from '../../../hooks/useLanguage';
import { Society } from '../../../types/schema';

import { formatSafeDate } from '../../../utils/date';

interface NoticesSectionProps {
  society?: Society;
  language?: Language;
}

const NoticesSection: React.FC<NoticesSectionProps> = ({ society, language = 'ko' }) => {
  const getLocalizedText = (text: string | { [lang: string]: string } | undefined) => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    return text[language] || text.ko || '';
  };

  const notices = society?.notices || [];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-3xl border border-slate-100 p-12 shadow-sm">
        <h2 className="text-3xl font-black text-slate-900 mb-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
            <Bell size={24} />
          </div>
          {language === 'ko' ? '공지사항' : 'Notices'}
        </h2>

        <div className="space-y-4">
          {notices.length > 0 ? (
            notices.map((notice) => (
              <div
                key={notice.id}
                className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl p-6 border border-slate-100 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Megaphone size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold">
                        {notice.category}
                      </span>
                      <span className="text-slate-400 text-sm font-bold">
                        {formatSafeDate(notice.date, language === 'ko' ? 'ko-KR' : 'en-US')}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{getLocalizedText(notice.title)}</h3>
                    <p className="text-slate-600 text-sm line-clamp-2">
                      {getLocalizedText(notice.content)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <Bell size={48} className="text-slate-300 mx-auto mb-4" />
              <p className="text-slate-400 font-bold mb-2">
                {language === 'ko' ? '공지사항 준비 중' : 'Notices Coming Soon'}
              </p>
              <p className="text-slate-300 text-sm">
                {language === 'ko'
                  ? '학회의 소식을 빠르게 전달해 드리겠습니다.'
                  : 'We will share society news with you quickly.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoticesSection;
