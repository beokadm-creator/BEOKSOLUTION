import React from 'react';

interface WideLocationProps {
    venueName: string;
    address: string;
    mapUrl?: string;
}

export const WideLocation: React.FC<WideLocationProps> = ({ venueName, address, mapUrl }) => {
    return (
        <section className="bg-white border border-slate-100 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-blue-50 text-[var(--primary)] rounded-full flex items-center justify-center text-3xl mb-6 shadow-inner">
                📍
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{venueName}</h3>
            <div className="text-lg md:text-xl font-medium text-slate-700 leading-relaxed max-w-2xl mb-6">
                {address}
            </div>
            {mapUrl && (
                <a 
                    href={mapUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#03C75A] hover:bg-[#02b351] text-white rounded-lg font-bold transition-colors shadow-md"
                >
                    <span>View on Naver Map</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                </a>
            )}
        </section>
    );
};
