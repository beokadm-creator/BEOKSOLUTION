import React from 'react';

interface WideAboutPreviewProps {
  title: string;
  description: string;
  images?: string[]; // Optional array of image URLs
}

export const WideAboutPreview: React.FC<WideAboutPreviewProps> = ({
  title,
  description,
  images = []
}) => {
  // Ensure description is always a string
  const safeDescription = String(description || '');

  // Extract content inside <body> tags if present
  const getBodyContent = (html: string) => {
    if (!html || typeof html !== 'string') return '';

    // Check if it's a complete HTML document
    if (html.trim().toLowerCase().startsWith('<!doctype') ||
      html.trim().toLowerCase().startsWith('<html')) {

      // Extract head content (meta, title, style tags)
      const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
      let headContent = '';
      if (headMatch && headMatch[1]) {
        // Extract only meta, title, and style tags from head
        const metaTags = headMatch[1].match(/<meta[^>]*>/gi) || [];
        const titleMatch = headMatch[1].match(/<title[\s\S]*?<\/title>/i);
        const styleMatch = headMatch[1].match(/<style[\s\S]*?<\/style>/i);

        headContent = [
          ...metaTags,
          titleMatch ? titleMatch[0] : '',
          styleMatch ? styleMatch[0] : ''
        ].filter(Boolean).join('\n');
      }

      // Extract body content
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const bodyContent = bodyMatch && bodyMatch[1] ? bodyMatch[1].trim() : '';

      // Combine head content and body content (like Korean version)
      return [headContent, bodyContent].filter(Boolean).join('\n\n').trim();
    }

    // Try to extract body content using regex (case-insensitive)
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      return bodyMatch[1].trim();
    }

    // Otherwise return as-is (it's probably already just body content)
    return html;
  };

  const cleanDescription = getBodyContent(safeDescription);

  // Debug log
  console.log('[WideAboutPreview] HTML Processing:', {
    original: typeof safeDescription === 'string' ? safeDescription.substring(0, 100) : 'NOT_STRING',
    cleaned: typeof cleanDescription === 'string' ? cleanDescription.substring(0, 100) : 'NOT_STRING',
    originalLength: typeof safeDescription === 'string' ? safeDescription.length : -1,
    cleanedLength: typeof cleanDescription === 'string' ? cleanDescription.length : -1
  });

  return (
    <section className="max-w-7xl mx-auto px-4 md:px-6">
      {/* Title */}
      {title && (
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">{title}</h2>
      )}

      <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-start">
        {/* Left Column: Images */}
        {images && images.length > 0 && (
          <div className="w-full md:w-4/12 lg:w-3/12 flex-shrink-0 space-y-4">
            {images.map((imageUrl, index) => (
              <div key={index} className="relative rounded-2xl overflow-hidden shadow-xl ring-1 ring-slate-900/5 group max-w-[200px] md:max-w-full mx-auto">
                <img
                  src={imageUrl}
                  alt={`Greeting image ${index + 1}`}
                  className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
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

      {/* Fallback for empty content */}
      {!cleanDescription && !images.length && (
        <p className="text-slate-400 italic text-center py-10">No content available.</p>
      )}
    </section>
  );
};
