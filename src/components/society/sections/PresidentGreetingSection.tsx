import React from 'react';
import type { Language } from '../../../hooks/useLanguage';
import { Society, LocalizedText } from '../../../types/schema';

interface PresidentGreetingSectionProps {
  society: Society;
  language?: Language;
}

const PresidentGreetingSection: React.FC<PresidentGreetingSectionProps> = ({ society, language = 'ko' }) => {
  const getLocalizedText = (text: string | { [lang: string]: string } | LocalizedText | undefined) => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    // Handle both index signature and known keys
    const key = language as keyof typeof text;
    return text[key] || text.ko || '';
  };

  const greetingData = society.presidentGreeting;

  // Parse greeting content based on structure
  let greetingContent = '';
  let greetingImages: string[] = [];

  if (greetingData) {
    if (typeof greetingData === 'string') {
      greetingContent = greetingData;
    } else if (typeof greetingData === 'object' && 'message' in greetingData) {
      // New format: { message: { ko, en }, images: [] }
      const data = greetingData as { message: LocalizedText; images?: string[] };
      greetingContent = getLocalizedText(data.message);
      greetingImages = data.images || [];
    } else {
      // Old format: { ko, en }
      greetingContent = getLocalizedText(greetingData as LocalizedText);
    }
  }

  if (!greetingContent && greetingImages.length === 0) {
    return null;
  }

  // Check if content is HTML (custom design) - purely heuristic: starts with < and no images
  const isHtml = greetingContent.trim().startsWith('<');
  const isCustomDesign = isHtml && greetingImages.length === 0;

  if (isCustomDesign) {
    return (
      <div
        className="w-full"
        dangerouslySetInnerHTML={{ __html: greetingContent }}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-12 shadow-sm">
        <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-6 md:mb-8 flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-lg md:text-xl">
            {language === 'ko' ? '인사' : 'MSG'}
          </div>
          {language === 'ko' ? '학회장 인사말' : 'President\'s Greeting'}
        </h2>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-5 md:p-8 border border-slate-100">
            {/* Images */}
            {greetingImages.length > 0 && (
              <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                {greetingImages.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`President Greeting ${idx + 1}`}
                    className="w-full h-64 object-cover rounded-xl shadow-md"
                  />
                ))}
              </div>
            )}

            <div
              className="prose prose-slate max-w-none text-slate-700 leading-loose text-lg"
              dangerouslySetInnerHTML={{ __html: greetingContent }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresidentGreetingSection;
