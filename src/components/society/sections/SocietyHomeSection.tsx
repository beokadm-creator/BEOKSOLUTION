import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Globe } from 'lucide-react';
import type { Language } from '../../../hooks/useLanguage';

import { Society } from '../../../types/schema';

interface SocietyHomeSectionProps {
  society: Society;
  language?: Language;
  onRegisterClick?: (conference: any) => void;
}

const SocietyHomeSection: React.FC<SocietyHomeSectionProps> = ({ society, language = 'ko' }) => {
  const getLocalizedText = (text: string | { [lang: string]: string } | undefined | { ko: string; en?: string }) => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    // Handle both index signature and known keys
    return (text as any)[language] || (text as any).ko || '';
  };

  return (
    <section className="relative min-h-[440px] h-auto py-12 bg-slate-900 flex items-center overflow-hidden rounded-3xl">
      <div className="absolute inset-0 opacity-30 bg-[url('https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/60 to-transparent"></div>

      <div className="relative max-w-7xl mx-auto px-6 w-full animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="max-w-3xl space-y-6">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[10px] font-black uppercase tracking-widest">
            <Globe size={12} /> {language === 'ko' ? '공식 학회 포털' : 'Official Society Portal'}
          </span>
          <h2 className="text-5xl md:text-7xl font-black text-white leading-[1.1] tracking-tight">
            {getLocalizedText(society.name)}
          </h2>
          <p className="text-xl text-slate-300 font-medium leading-relaxed opacity-80">
            {getLocalizedText(society.name)} <br />
            <span className="text-sm">{language === 'ko' ? '학술적 가치를 공유하고 혁신적인 연구 네트워크를 구축합니다.' : 'Sharing academic values and building innovative research networks.'}</span>
          </p>
          <div className="flex gap-4 pt-4">
            {society.homepageUrl && (
              <a
                href={society.homepageUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-slate-50 transition transform hover:-translate-y-1 shadow-2xl"
              >
                {language === 'ko' ? '학회 웹사이트' : 'Society Website'} <ArrowRight size={18} />
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SocietyHomeSection;
