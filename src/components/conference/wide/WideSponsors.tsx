import React, { useMemo } from 'react';
import { Sponsor } from '../../../types/schema';
import { ExternalLink, Building2 } from 'lucide-react';

interface WideSponsorsProps {
  sponsors?: Sponsor[];
  lang?: string;
}

export const WideSponsors: React.FC<WideSponsorsProps> = ({ sponsors, lang = 'ko' }) => {
  // Check if any sponsor has a tier assigned
  const hasTierSystem = useMemo(() => {
    if (!sponsors || sponsors.length === 0) return false;
    return sponsors.some(s => s.tier);
  }, [sponsors]);

  // Sort and filter sponsors
  const sortedSponsors = useMemo(() => {
    if (!sponsors || sponsors.length === 0) return [];

    return sponsors
      .filter((s) => s.isActive)
      .sort((a, b) => {
        // Sort by order (lower first)
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;

        // Fallback: sort by tier (only if tier system is used)
        if (hasTierSystem) {
          const tierOrder = { PLATINUM: 0, GOLD: 1, SILVER: 2, BRONZE: 3 };
          const tierA = tierOrder[a.tier || 'BRONZE'];
          const tierB = tierOrder[b.tier || 'BRONZE'];
          return tierA - tierB;
        }

        return 0;
      });
  }, [sponsors, hasTierSystem]);

  if (sortedSponsors.length === 0) {
    return (
      <div className="w-full bg-gradient-to-b from-slate-50 to-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-lg font-medium text-slate-500">
              {lang === 'ko' ? '스폰서가 곧 공개됩니다.' : 'Sponsors will be announced soon.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Get tier styles for badge and card
  const getTierStyles = (tier?: string) => {
    // If no tier system, use neutral styles for all
    if (!hasTierSystem || !tier) {
      return {
        badge: 'hidden', // Hide badge when no tier system
        card: 'from-white via-slate-50 to-white border-slate-200 hover:border-blue-300',
        accent: 'shadow-blue-100'
      };
    }

    switch (tier) {
      case 'PLATINUM':
        return {
          badge: 'bg-gradient-to-r from-slate-700 via-slate-600 to-slate-800 text-white border-slate-500 shadow-lg',
          card: 'from-slate-50 via-white to-slate-50 border-slate-300 hover:border-slate-400',
          accent: 'shadow-slate-200'
        };
      case 'GOLD':
        return {
          badge: 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-white border-amber-400 shadow-lg',
          card: 'from-amber-50 via-white to-yellow-50 border-amber-200 hover:border-amber-300',
          accent: 'shadow-amber-200'
        };
      case 'SILVER':
        return {
          badge: 'bg-gradient-to-r from-slate-400 via-slate-300 to-slate-500 text-white border-slate-300 shadow-lg',
          card: 'from-slate-50 via-white to-slate-100 border-slate-200 hover:border-slate-300',
          accent: 'shadow-slate-200'
        };
      case 'BRONZE':
        return {
          badge: 'bg-gradient-to-r from-orange-600 via-orange-500 to-orange-700 text-white border-orange-400 shadow-lg',
          card: 'from-orange-50 via-white to-orange-50 border-orange-200 hover:border-orange-300',
          accent: 'shadow-orange-200'
        };
      default:
        return {
          badge: 'hidden',
          card: 'from-slate-50 via-white to-slate-50 border-slate-200',
          accent: 'shadow-slate-200'
        };
    }
  };

  const getTierLabel = (tier?: string) => {
    if (!hasTierSystem || !tier) return '';
    
    switch (tier) {
      case 'PLATINUM':
        return lang === 'ko' ? '플래티넘' : 'PLATINUM';
      case 'GOLD':
        return lang === 'ko' ? '골드' : 'GOLD';
      case 'SILVER':
        return lang === 'ko' ? '실버' : 'SILVER';
      case 'BRONZE':
        return lang === 'ko' ? '브론즈' : 'BRONZE';
      default:
        return '';
    }
  };

  return (
    <section
      id="section-sponsors"
      className="w-full bg-gradient-to-b from-slate-50 via-white to-slate-50 py-16 md:py-24"
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full" />
            <span className="text-sm font-bold text-blue-600 uppercase tracking-widest">
              {lang === 'ko' ? '파트너사' : 'Partners'}
            </span>
            <div className="w-12 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full" />
          </div>
          <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-4 md:mb-6">
            {lang === 'ko' ? '스폰서' : 'Sponsors'}
          </h3>
          <p className="text-slate-600 max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
            {lang === 'ko'
              ? '이번 행사를 함께해주신 소중한 파트너사들을 소개합니다.'
              : 'We are proud to introduce our valued partners for this event.'}
          </p>
        </div>

        {/* Sponsors Grid - Mobile Optimized with Auto Centering */}
        <div className={`w-full ${
          hasTierSystem 
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 lg:gap-8' 
            : 'flex flex-wrap justify-center gap-4 md:gap-6 lg:gap-8'
        }`}>
          {sortedSponsors.map((sponsor) => {
            const tierStyles = getTierStyles(sponsor.tier);
            
            // Calculate width for non-tier mode based on count
            const getNonTierWidth = () => {
              const count = sortedSponsors.length;
              if (count === 1) return 'w-full sm:w-2/3 md:w-1/2 lg:w-2/5 xl:w-1/3';
              if (count === 2) return 'w-full sm:w-1/2 md:w-2/5 lg:w-1/3 xl:w-1/4';
              if (count === 3) return 'w-full sm:w-1/2 md:w-1/3 lg:w-1/4 xl:w-1/5';
              if (count === 4) return 'w-full sm:w-1/2 md:w-1/3 lg:w-1/4 xl:w-1/5';
              return 'w-full sm:w-1/2 md:w-1/3 lg:w-1/4 xl:w-1/5';
            };

            if (!hasTierSystem) {
              return (
                <div
                  key={sponsor.id}
                  className={`${getNonTierWidth()} flex-shrink-0`}
                >
                  <div
                    className={`group relative bg-gradient-to-br ${tierStyles.card} rounded-2xl md:rounded-3xl shadow-md hover:shadow-2xl border overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:scale-[1.02]`}
                  >
                    {/* No tier badge in non-tier mode */}
      
                    {/* Sponsor Logo Area - Square for equal display */}
                    <div className="relative aspect-square bg-white/80 backdrop-blur-sm p-6 md:p-8 lg:p-10 flex items-center justify-center">
                      {sponsor.logoUrl ? (
                        <img
                          src={sponsor.logoUrl}
                          alt={sponsor.name}
                          className="max-h-full max-w-full object-contain filter grayscale group-hover:grayscale-0 transition-all duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-24 h-24 md:w-28 md:h-28 bg-gradient-to-br from-slate-200 to-slate-300 rounded-xl flex items-center justify-center shadow-inner">
                          <Building2 className="w-12 h-12 md:w-14 md:h-14 text-slate-400" />
                        </div>
                      )}
                    </div>
      
                    {/* Sponsor Info */}
                    <div className="p-4 md:p-5 lg:p-6 space-y-2 md:space-y-3 bg-white/50 backdrop-blur-[2px]">
                      {/* Sponsor Name */}
                      <h4 className="text-sm md:text-base font-bold text-slate-900 text-center leading-tight">
                        {sponsor.name}
                      </h4>
      
                      {/* Description */}
                      {sponsor.description && (
                        <p className="text-xs md:text-sm text-slate-600 text-center line-clamp-2 leading-relaxed">
                          {sponsor.description}
                        </p>
                      )}
      
                      {/* Website Button */}
                      {sponsor.websiteUrl && (
                        <a
                          href={sponsor.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full mt-3 md:mt-4 px-4 md:px-5 py-2.5 md:py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl md:rounded-2xl font-semibold text-xs md:text-sm transition-all duration-300 shadow-md hover:shadow-xl active:scale-95"
                        >
                          <span>{lang === 'ko' ? '웹사이트' : 'Website'}</span>
                          <ExternalLink className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </a>
                      )}
                    </div>
      
                    {/* Hover Effect Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl md:rounded-3xl" />
                  </div>
                </div>
              );
            }
            
            // Tier mode rendering (original grid-based)
            return (
              <div
                key={sponsor.id}
                className={`group relative bg-gradient-to-br ${tierStyles.card} rounded-2xl md:rounded-3xl shadow-md hover:shadow-2xl border overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:scale-[1.02]`}
              >
                {/* Tier Badge - Only show if tier system is enabled and tier exists */}
                {hasTierSystem && sponsor.tier && tierStyles.badge !== 'hidden' && (
                  <div className="absolute top-3 md:top-4 right-3 md:right-4 z-10">
                    <span
                      className={`px-2 md:px-3 py-1 md:py-1.5 rounded-full text-[10px] md:text-xs font-bold border ${tierStyles.badge}`}
                    >
                      {getTierLabel(sponsor.tier)}
                    </span>
                  </div>
                )}

                {/* Sponsor Logo Area - Enhanced for equal display */}
                <div className={`relative bg-white/80 backdrop-blur-sm p-4 md:p-6 lg:p-8 flex items-center justify-center ${
                  hasTierSystem ? 'aspect-[4/3] md:aspect-video' : 'aspect-square md:aspect-square'
                }`}>
                  {sponsor.logoUrl ? (
                    <img
                      src={sponsor.logoUrl}
                      alt={sponsor.name}
                      className="max-h-full max-w-full object-contain filter grayscale group-hover:grayscale-0 transition-all duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className={`bg-gradient-to-br from-slate-200 to-slate-300 rounded-xl flex items-center justify-center shadow-inner ${
                      hasTierSystem ? 'w-16 h-16 md:w-20 md:h-20' : 'w-20 h-20 md:w-24 md:h-24'
                    }`}>
                      <Building2 className={`text-slate-400 ${hasTierSystem ? 'w-8 h-8 md:w-10 md:h-10' : 'w-10 h-10 md:w-12 md:h-12'}`} />
                    </div>
                  )}
                </div>

                {/* Sponsor Info - Enhanced for equal display */}
                <div className="p-4 md:p-5 lg:p-6 space-y-2 md:space-y-3 bg-white/50 backdrop-blur-[2px]">
                  {/* Sponsor Name */}
                  <h4 className={`font-bold text-slate-900 text-center leading-tight ${
                    hasTierSystem ? 'text-base md:text-lg' : 'text-sm md:text-base'
                  }`}>
                    {sponsor.name}
                  </h4>

                  {/* Description - Show if exists */}
                  {sponsor.description && (
                    <p className="text-xs md:text-sm text-slate-600 text-center line-clamp-2 leading-relaxed">
                      {sponsor.description}
                    </p>
                  )}

                  {/* Website Button - Touch Optimized */}
                  {sponsor.websiteUrl && (
                    <a
                      href={sponsor.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full mt-3 md:mt-4 px-4 md:px-5 py-2.5 md:py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl md:rounded-2xl font-semibold text-xs md:text-sm transition-all duration-300 shadow-md hover:shadow-xl active:scale-95"
                    >
                      <span>{lang === 'ko' ? '웹사이트' : 'Website'}</span>
                      <ExternalLink className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </a>
                  )}
                </div>

                {/* Hover Effect Overlay - Subtle */}
                <div className="absolute inset-0 bg-gradient-to-t from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl md:rounded-3xl" />
              </div>
            );
          })}
        </div>

        {/* Bottom CTA - Optional */}
        <div className="mt-16 md:mt-20 text-center">
          <p className="text-sm text-slate-500 mb-2">
            {lang === 'ko' ? '더 많은 스폰서가 참여하고 있습니다.' : 'More sponsors joining soon.'}
          </p>
          <div className="w-24 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent mx-auto rounded-full" />
        </div>
      </div>
    </section>
  );
};
