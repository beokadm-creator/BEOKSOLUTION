import React, { useMemo, useState } from 'react';
import { WideAboutPreview } from './WideAboutPreview';

type LocalizedString = { [lang: string]: string } | string;

interface Greeting {
  id?: string;
  role?: LocalizedString;
  name?: string;
  affiliation?: LocalizedString;
  message?: LocalizedString;
  photoUrl?: string;
  order?: number;
}

interface Props {
  title: string;
  greetings: Greeting[];
  lang: string;
  t: (val: LocalizedString | undefined) => string;
}

export const WideGreetingsPreview: React.FC<Props> = ({ title, greetings, lang, t }) => {
  const normalized = useMemo(() => {
    return (greetings || [])
      .map((g, idx) => ({ ...g, id: g.id || String(idx) }))
      .sort((a, b) => {
        const ao = typeof a.order === 'number' ? a.order : 9999;
        const bo = typeof b.order === 'number' ? b.order : 9999;
        return ao - bo;
      });
  }, [greetings]);

  const [activeId, setActiveId] = useState(normalized[0]?.id || '');

  const active = normalized.find(g => g.id === activeId) || normalized[0];
  const roleText = active?.role ? t(active.role) : '';
  const nameText = String(active?.name || '');
  const label = [roleText, nameText].filter(Boolean).join(' ');

  const description = active?.message ? t(active.message) : '';
  const images = active?.photoUrl ? [active.photoUrl] : [];

  return (
    <section className="animate-fade-in space-y-10">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex flex-wrap gap-2 justify-center">
          {normalized.map((g) => {
            const r = g.role ? t(g.role) : '';
            const n = String(g.name || '');
            const buttonLabel = [r, n].filter(Boolean).join(' ');
            const isActive = g.id === (active?.id || '');

            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveId(g.id || '')}
                className={`h-10 px-4 rounded-xl text-sm font-bold transition-all max-w-[220px] truncate ${isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                aria-pressed={isActive}
              >
                {buttonLabel}
              </button>
            );
          })}
        </div>
      </div>

      <WideAboutPreview
        title={title}
        description={description}
        images={images}
        key={`${active?.id || ''}_${lang}_${label}`}
      />
    </section>
  );
};

