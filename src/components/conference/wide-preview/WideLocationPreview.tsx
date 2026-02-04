import React from 'react';

interface WideLocationPreviewProps {
    venueName: string;
    address: string;
    mapUrl?: string;
    googleMapEmbedUrl?: string;
    lang?: string;
}

export const WideLocationPreview: React.FC<WideLocationPreviewProps> = ({
    venueName,
    address,
    mapUrl,
    googleMapEmbedUrl,
    lang = 'ko'
}) => {
    // 주소 또는 장소명을 기반으로 Google Maps Embed URL 생성
    const generateEmbedUrl = () => {
        if (googleMapEmbedUrl) return googleMapEmbedUrl;

        // 주소 또는 장소명을 URL 인코딩
        const query = encodeURIComponent(address || venueName);
        return `https://www.google.com/maps?q=${query}&output=embed`;
    };

    const embedUrl = generateEmbedUrl();

    return (
        <section className="space-y-6">
            {/* Venue Info Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-2xl sm:text-3xl flex-shrink-0">
                        📍
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 sm:mb-3">{venueName}</h3>
                        <p className="text-base sm:text-lg text-slate-600 leading-relaxed whitespace-pre-line">
                            {address}
                        </p>
                    </div>
                </div>
            </div>

            {/* Google Map Embed - Always show */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                        src={embedUrl}
                        className="absolute top-0 left-0 w-full h-full border-0"
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        title="Venue Location Map"
                    />
                </div>
            </div>

            {/* External Map Link (Optional) */}
            {mapUrl && (
                <div className="text-center">
                    <a
                        href={mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-medium transition-colors border border-slate-300 hover:border-slate-400 text-sm"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <title>Google Maps</title>
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                        </svg>
                        <span>{lang === 'ko' ? '구글 지도에서 열기' : 'Open in Google Maps'}</span>
                    </a>
                </div>
            )}
        </section>
    );
};
