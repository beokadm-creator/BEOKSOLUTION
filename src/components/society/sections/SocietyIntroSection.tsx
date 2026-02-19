import React from 'react';
import type { Language } from '../../../hooks/useLanguage';
import { Society, LocalizedText } from '../../../types/schema';

interface SocietyIntroSectionProps {
  society: Society;
  language?: Language;
}

const SocietyIntroSection: React.FC<SocietyIntroSectionProps> = ({ society, language = 'ko' }) => {
  const getLocalizedText = (text: string | { [lang: string]: string } | LocalizedText | undefined) => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    // Handle both index signature and known keys
    const key = language as keyof typeof text;
    return text[key] || text.ko || '';
  };

  // Direct HTML Render for custom page designs
  if (society.introduction) {
    const htmlContent = getLocalizedText(society.introduction);
    return (
      <div
        className="w-full"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    );
  }

  // Fallback / Standard Layout
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="bg-white rounded-3xl border border-slate-100 p-12 shadow-sm">
        <h2 className="text-3xl font-black text-slate-900 mb-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-xl">
            {language === 'ko' ? '학회' : 'SOC'}
          </div>
          {language === 'ko' ? '학회소개' : 'Society Introduction'}
        </h2>

        <div className="space-y-6">
          {society.description && (society.description.ko || society.description.en) ? (
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">
                {language === 'ko' ? '학회 개요' : 'Society Overview'}
              </h3>
              <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                {getLocalizedText(society.description)}
              </p>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-400 font-bold">
                {language === 'ko' ? '학회 소개 정보가 준비 중입니다.' : 'Society introduction information is being prepared.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SocietyIntroSection;
