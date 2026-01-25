import React from 'react';

type LocalizedString = { [lang: string]: string } | string;

export interface PricingPeriod {
  id: string;
  name: LocalizedString | string;
  start: Date;
  end: Date;
  prices: Record<string, number>;
  isBestValue?: boolean;
}

interface WideFeeTableProps {
  pricing: PricingPeriod[];
  currency: string;
  lang: string;
  labels?: {
    category: string;
    amount: string;
    bestValue?: string;
    save?: string;
    refundPolicyTitle?: string;
  };
  refundPolicy?: string;
}

export const WideFeeTable: React.FC<WideFeeTableProps> = ({
  pricing,
  currency,
  lang,
  labels = {
    category: 'Category',
    amount: 'Amount',
    bestValue: 'BEST VALUE',
    save: 'Save',
    refundPolicyTitle: 'Refund Policy'
  },
  refundPolicy
}) => {
  const t = (val: LocalizedString | undefined): string => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    return (lang === 'en' ? val.en : val.ko) || val.ko || '';
  };

  // Extract all categories
  const allCategories = Array.from(
    new Set(
      pricing.flatMap(p => Object.keys(p.prices || {}))
    )
  );

  if (pricing.length === 0) return null;

  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-0 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr>
              <th className="p-5 font-bold text-slate-900 bg-slate-50 border-b border-slate-200 min-w-[140px] sticky left-0 z-20">
                {labels.category}
              </th>
              {pricing.map((p, idx) => {
                const today = new Date();
                const isActive = p.start && p.end && today >= p.start && today <= p.end;

                return (
                  <th key={idx} className={`p-5 min-w-[160px] relative text-center border-b ${isActive ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-slate-100'}`}>
                    {isActive && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-600"></div>
                    )}
                    {p.isBestValue && (
                      <span className="absolute top-2 right-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm">
                        {labels.bestValue}
                      </span>
                    )}
                    <div className={`text-base font-bold ${isActive ? 'text-[var(--primary)]' : 'text-slate-700'}`}>
                      {t(p.name)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {allCategories.map(cat => (
              <tr key={cat} className="group hover:bg-slate-50/80 transition-colors">
                <td className="p-5 font-bold text-slate-800 border-r border-slate-100 bg-white group-hover:bg-slate-50 transition-colors sticky left-0 z-10 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]">
                  {cat.replace(/_/g, ' ')}
                </td>
                {pricing.map((p, idx) => {
                  const today = new Date();
                  const isActive = p.start && p.end && today >= p.start && today <= p.end;

                  return (
                    <td key={idx} className={`p-5 text-center border-r border-dashed border-slate-100 last:border-0 ${isActive ? 'bg-blue-50/10' : ''}`}>
                      {p.prices && p.prices[cat] ? (
                        <div className="flex flex-col items-center">
                          <span className={`font-mono text-lg ${isActive ? 'font-black text-[var(--primary)]' : 'font-medium text-slate-600'}`}>
                            {Number(p.prices[cat]).toLocaleString()}
                          </span>
                          {/* Simple heuristic for savings display: first column is Early Bird */}
                          {idx === 0 && (
                             <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded mt-1 font-bold">
                               {labels.save}
                             </span>
                          )}
                        </div>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {refundPolicy && (
        <div className="p-6 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
          <strong className="block text-slate-700 mb-1">{labels.refundPolicyTitle}</strong>
          <p className="line-clamp-2 hover:line-clamp-none transition-all">{refundPolicy}</p>
        </div>
      )}
    </section>
  );
};
