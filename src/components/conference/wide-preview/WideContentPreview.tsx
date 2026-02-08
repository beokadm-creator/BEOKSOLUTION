import React from 'react';
import { WideProgramPreview } from './WideProgramPreview';
import { WideSpeakersPreview } from './WideSpeakersPreview';
import { WidePricingPreview } from './WidePricingPreview';
import { WideLocationPreview } from './WideLocationPreview';
import { WideAboutPreview } from './WideAboutPreview';
import { WideSponsors } from '../wide/WideSponsors';
import type { Sponsor } from '@/types/schema';

type LocalizedString = { [lang: string]: string } | string;

interface WideContentPreviewProps {
  config: {
    societyId: string;
    welcomeMessageTitle?: LocalizedString;
    welcomeMessage?: LocalizedString;
    welcomeMessageImages?: string[];
    agendas?: unknown[];
    speakers?: unknown[];
    sponsors?: unknown[];
    pricing?: Array<{
      id: string;
      name: LocalizedString | string;
      prices?: Record<string, number>;
    }>;
    venue?: {
      name?: LocalizedString;
      address?: LocalizedString;
      mapUrl?: string;
      googleMapEmbedUrl?: string;
    };
  };
  lang: string;
  t: (val: LocalizedString | undefined) => string;
  activeSection: string;
}

export const WideContentPreview: React.FC<WideContentPreviewProps> = ({
  config,
  lang,
  t,
  activeSection,
}) => {
  // activeSection에 따라 하나만 렌더링 (제목 없음)
  const renderContent = () => {
    switch (activeSection) {
      case 'welcome':
        // Debug: Log the welcome message data
        console.log('[WideContentPreview] Welcome Message Data:', {
          raw: config.welcomeMessage,
          translated: t(config.welcomeMessage),
          lang: lang
        });

        return (
          <section id="section-welcome" className="animate-fade-in space-y-16">
            <WideAboutPreview
              title={t(config.welcomeMessageTitle) || (lang === 'ko' ? '환영사' : 'Welcome Message')}
              description={t(config.welcomeMessage)}
              images={config.welcomeMessageImages}
            />
          </section>
        );

      case 'program':
        return (
          <div id="section-program" className="animate-fade-in pt-8 pb-4">
            <div className="max-w-7xl mx-auto px-6">
              <WideProgramPreview
                agendas={config.agendas}
                speakers={config.speakers}
                lang={lang}
              />
            </div>
          </div>
        );

      case 'speakers':
        return (
          <div id="section-speakers" className="animate-fade-in pt-8 pb-4">
            <div className="max-w-7xl mx-auto px-6">
              <WideSpeakersPreview
                speakers={config.speakers}
                lang={lang}
              />
            </div>
          </div>
        );

      case 'pricing':
        return (
          <div id="section-pricing" className="animate-fade-in pt-8 pb-4">
            <div className="max-w-7xl mx-auto px-6">
              <WidePricingPreview
                societyId={config.societyId}
                lang={lang}
                pricing={
                  config.pricing?.map(
                    (p: { id: string; name: { [lang: string]: string } | string; prices?: Record<string, number> }) => ({ ...p, prices: p.prices || {} })
                  ) || []
                }
                currency="KRW"
              />
            </div>
          </div>
        );

      case 'location':
        return (
          <div id="section-location" className="animate-fade-in pt-8 pb-4">
            <div className="max-w-7xl mx-auto px-6">
              <WideLocationPreview
                venueName={t(config.venue?.name) || 'Venue'}
                address={t(config.venue?.address)}
                mapUrl={config.venue?.mapUrl}
                googleMapEmbedUrl={config.venue?.googleMapEmbedUrl}
                lang={lang}
              />
            </div>
          </div>
        );

      case 'sponsors':
        return (
          <div id="section-sponsors" className="animate-fade-in">
            <WideSponsors sponsors={config.sponsors as Sponsor[]} lang={lang} />
          </div>
        );

      default:
        return (
          <section id="section-welcome" className="animate-fade-in space-y-16">
            <WideAboutPreview
              title={t(config.welcomeMessageTitle) || (lang === 'ko' ? '환영사' : 'Welcome Message')}
              description={t(config.welcomeMessage)}
              images={config.welcomeMessageImages}
            />
          </section>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[50vh] md:min-h-[600px]">
      {renderContent()}
    </div>
  );
};
