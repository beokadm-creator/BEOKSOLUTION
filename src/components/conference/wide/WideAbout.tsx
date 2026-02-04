import React from 'react';

interface WideAboutProps {
  title: string;
  description: string;
  images?: string[];
}

export const WideAbout: React.FC<WideAboutProps> = ({ title, description, images }) => {
  // Extract content inside <body> tags if present
  const getBodyContent = (html: string) => {
    if (!html) return '';
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return bodyMatch ? bodyMatch[1] : html;
  };

  const cleanDescription = getBodyContent(description);

  return (
    <section className="max-w-7xl mx-auto px-4 md:px-6">
      <div className="text-center space-y-4 mb-12">
        <h2 className="text-3xl font-bold text-slate-900">{title}</h2>
      </div>

      <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-start">
        {/* Left Column: Images */}
        {images && images.length > 0 && (
          <div className="w-full md:w-4/12 lg:w-3/12 flex-shrink-0 space-y-4">
            {images.map((url, index) => (
              <div key={index} className="relative rounded-2xl overflow-hidden shadow-xl ring-1 ring-slate-900/5 group max-w-[200px] md:max-w-full mx-auto">
                <img 
                  src={url} 
                  alt={`Welcome image ${index + 1}`} 
                  className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            ))}
          </div>
        )}

        {/* Right Column: Text Content */}
        <div className={`w-full ${images && images.length > 0 ? 'md:w-8/12 lg:w-9/12' : ''}`}>
          <div 
            className="prose prose-lg prose-slate max-w-none 
              prose-headings:font-bold prose-headings:text-slate-900 
              prose-p:text-slate-600 prose-p:leading-relaxed 
              prose-strong:text-slate-900 prose-strong:font-bold
              prose-li:text-slate-600 prose-li:marker:text-blue-500
              prose-hr:border-slate-200"
            dangerouslySetInnerHTML={{ __html: cleanDescription }}
          />
        </div>
      </div>
    </section>
  );
};
