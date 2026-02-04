import React from 'react';
import type { Language } from '../../../hooks/useLanguage';

interface PresidentGreetingSectionProps {
  society: Record<string, unknown>;
  language?: Language;
}

const PresidentGreetingSection: React.FC<PresidentGreetingSectionProps> = ({ society, language = 'ko' }) => {
  const getLocalizedText = (text: string | { [lang: string]: string } | undefined) => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    return text[language] || text.ko || '';
  };

  const greetingData = society.presidentGreeting;
  
  // Parse greeting content based on structure
  let greetingContent = '';
  let greetingImages: string[] = [];

  if (greetingData) {
    if (typeof greetingData === 'string') {
      greetingContent = greetingData;
    } else if ('message' in greetingData) {
      // New format: { message: { ko, en }, images: [] }
      greetingContent = getLocalizedText(greetingData.message);
      greetingImages = greetingData.images || [];
    } else {
      // Old format: { ko, en }
      greetingContent = getLocalizedText(greetingData);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-3xl border border-slate-100 p-12 shadow-sm">
        <h2 className="text-3xl font-black text-slate-900 mb-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-xl">
            {language === 'ko' ? '인사' : 'MSG'}
          </div>
          {language === 'ko' ? '학회장 인사말' : 'President\'s Greeting'}
        </h2>

        <div className="space-y-6">
          {greetingContent ? (
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-8 border border-slate-100">
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
          ) : (
            <>
              <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-8 border border-slate-100">
                <div className="prose prose-slate max-w-none">
                  <p className="text-slate-700 leading-loose text-lg">
                    {language === 'ko' ? '존경하는 회원 여러분,' : 'Dear Members,'}
                  </p>
                  <p className="text-slate-700 leading-loose text-lg mt-4">
                    {getLocalizedText(society.name)} {language === 'ko' ? '에 관심을 가져주셔서 감사합니다.' : ', thank you for your interest.'}
                  </p>
                  <p className="text-slate-700 leading-loose text-lg mt-4">
                    {language === 'ko'
                      ? '우리 학회는 학술적 가치를 공유하고 혁신적인 연구 네트워크를 구축하여 관련 분야의 발전에 기여하고 있습니다.'
                      : 'Our society shares academic values and builds innovative research networks to contribute to the development of related fields.'}
                  </p>
                  <p className="text-slate-700 leading-loose text-lg mt-4">
                    {language === 'ko' ? '회원 여러분의 적극적인 참여와 성원을 부탁드립니다.' : 'We appreciate your active participation and support.'}
                  </p>
                  <p className="text-slate-700 leading-loose text-lg mt-8 font-bold">
                    {getLocalizedText(society.name)} {language === 'ko' ? '회장' : 'President'}
                  </p>
                </div>
              </div>

              <div className="text-center py-4">
                <p className="text-slate-400 text-sm">
                  {language === 'ko' ? '학회장 인사말이 곧 업데이트될 예정입니다.' : 'President\'s greeting will be updated soon.'}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PresidentGreetingSection;
