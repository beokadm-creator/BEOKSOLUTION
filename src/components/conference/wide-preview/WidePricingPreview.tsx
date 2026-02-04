import React from 'react';
import { useSocietyGrades } from '../../../hooks/useSocietyGrades';

type LocalizedString = { [lang: string]: string } | string;

export interface PricingPeriod {
    id: string;
    type?: string;
    name: LocalizedString | string;
    period?: { start: Date; end: Date };
    startDate?: Date | { toDate: () => Date };
    endDate?: Date | { toDate: () => Date };
    prices: Record<string, number> | Array<{ name: LocalizedString | string; amount: number; }>;
    isBestValue?: boolean;
}

interface WidePricingPreviewProps {
    pricing: PricingPeriod[];
    currency?: string;
    lang: string;
    labels?: {
        category: string;
        amount: string;
        bestValue?: string;
        save?: string;
        refundPolicyTitle?: string;
    };
    refundPolicy?: string;
    societyId?: string;
}

export const WidePricingPreview: React.FC<WidePricingPreviewProps> = ({
    pricing,
    lang,
    labels = {
        category: 'Category',
        amount: 'Amount',
        bestValue: 'BEST VALUE',
        save: 'Save',
        refundPolicyTitle: 'Refund Policy'
    },
    refundPolicy,
    societyId
}) => {
    const { gradeMasterMap } = useSocietyGrades(societyId);

    const manualMap: Record<string, string> = {
        'Member': '회원',
        'Non-Member': '비회원',
        'Nurse': '간호사',
        'Nutritionist': '영양사',
        'Researcher': '연구원',
        'Student': '학생',
        'Military Doctor': '군의관',
        'Public Health Doctor': '공보의'
    };

    const t = (val: LocalizedString | undefined): string => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        return (lang === 'en' ? val.en : val.ko) || val.ko || '';
    };

    const translateGrade = (name: string): string => {
        if (lang !== 'ko') return name;

        // 1. Manual Map
        if (manualMap[name]) return manualMap[name];

        // 2. Normalized Manual Map
        const normalized = name.replace(/_/g, ' ').trim();
        if (manualMap[normalized]) return manualMap[normalized];

        // 3. Grade Master Map
        if (gradeMasterMap.has(name)) {
            return gradeMasterMap.get(name)?.ko || name;
        }
        // Try normalized as code
        const codeNorm = name.toLowerCase().replace(/\s/g, '_');
        if (gradeMasterMap.has(codeNorm)) {
             return gradeMasterMap.get(codeNorm)?.ko || name;
        }

        return name.replace(/_/g, ' ');
    };

    const formatDate = (dateVal: Date | { toDate: () => Date } | string | undefined) => {
        if (!dateVal) return '';
        const d = dateVal instanceof Date ? dateVal : (typeof dateVal === 'object' && 'toDate' in dateVal ? dateVal.toDate() : new Date(dateVal));
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}.${m}.${day}`;
    };

    const getPeriodDates = (item: PricingPeriod) => {
        const start = item.startDate || item.period?.start;
        const end = item.endDate || item.period?.end;
        return { start, end };
    };

    const isCurrentPeriod = (item: PricingPeriod) => {
        const { start, end } = getPeriodDates(item);
        if (!start || !end) return false;

        const now = new Date();
        const s = start instanceof Date ? start : (start.toDate ? start.toDate() : new Date(start));
        const e = end instanceof Date ? end : (end.toDate ? end.toDate() : new Date(end));

        // End of day adjustment
        e.setHours(23, 59, 59, 999);

        return now >= s && now <= e;
    };

    const normalizePrices = (prices: Record<string, number> | Array<{ name: LocalizedString | string; amount: number }>) => {
        if (!prices) return [];
        let arr: { name: string; amount: number }[] = [];

        if (Array.isArray(prices)) {
            arr = prices.map(p => {
                const rawName = t(p.name);
                return {
                    name: translateGrade(rawName),
                    amount: Number(p.amount || p.price || 0)
                };
            });
        } else if (typeof prices === 'object') {
            arr = Object.entries(prices).map(([key, val]) => ({
                name: translateGrade(key),
                amount: Number(val)
            }));
        }

        return arr.sort((a, b) => a.amount - b.amount);
    };

    const currencySymbol = '₩';

    const getCurrencyDisplay = (amount: number) => {
         return `${currencySymbol}${amount.toLocaleString()}`;
    };

    if (!pricing || pricing.length === 0) return null;

    // Get all unique grades across all periods
    const allGrades = Array.from(
        new Set(
            pricing.flatMap(p => normalizePrices(p.prices).map(price => price.name))
        )
    );

    return (
        <>
            <section className="w-full flex justify-center py-8">
                <div className="max-w-6xl w-full px-4">
                    {/* Desktop: Pricing Table */}
                    <div className="hidden md:block bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        {/* Grade Column Header */}
                                        <th className="p-6 text-left bg-slate-50 border-b-2 border-slate-200 min-w-[180px]">
                                            <span className="text-sm font-bold text-slate-600 uppercase tracking-wide">
                                                {lang === 'ko' ? '등급' : 'Grade'}
                                            </span>
                                        </th>
                                        {/* Period Columns */}
                                        {pricing.map((item) => {
                                            const isActive = isCurrentPeriod(item);
                                            const { start, end } = getPeriodDates(item);
                                            const dateStr = start && end ? `${formatDate(start)} ~ ${formatDate(end)}` : '';

                                            return (
                                                <th
                                                    key={item.id}
                                                    className={`p-6 text-center min-w-[200px] border-b-2 ${
                                                        isActive
                                                            ? 'bg-blue-600 border-blue-700'
                                                            : 'bg-slate-50 border-slate-200'
                                                    }`}
                                                >
                                                    <div className={`text-sm font-bold uppercase tracking-wide ${isActive ? 'text-white' : 'text-slate-600'}`}>
                                                        {t(item.name)}
                                                    </div>
                                                    {dateStr && (
                                                        <div className={`text-xs mt-1 font-medium ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                                                            {dateStr}
                                                        </div>
                                                    )}
                                                    {isActive && (
                                                        <div className="mt-2 inline-flex items-center bg-white/20 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                                                            {labels.bestValue || 'CURRENT'}
                                                        </div>
                                                    )}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {allGrades.map((grade) => (
                                        <tr key={grade} className="border-b border-slate-100 last:border-0">
                                            {/* Grade Name */}
                                            <td className="p-5 bg-white font-semibold text-slate-800 sticky left-0 z-10">
                                                {grade}
                                            </td>
                                            {/* Prices for each period */}
                                            {pricing.map((item) => {
                                                const isActive = isCurrentPeriod(item);
                                                const priceList = normalizePrices(item.prices);
                                                const priceData = priceList.find(p => p.name === grade);

                                                return (
                                                    <td
                                                        key={`${item.id}-${grade}`}
                                                        className={`p-5 text-center font-mono font-bold text-lg ${
                                                            isActive ? 'bg-blue-50/50 text-blue-600' : 'bg-white text-slate-700'
                                                        }`}
                                                    >
                                                        {priceData ? getCurrencyDisplay(priceData.amount) : '-'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile: Card Layout */}
                    <div className="md:hidden space-y-4">
                        {pricing.map((item) => {
                            const isActive = isCurrentPeriod(item);
                            const { start, end } = getPeriodDates(item);
                            const dateStr = start && end ? `${formatDate(start)} ~ ${formatDate(end)}` : '';
                            const priceList = normalizePrices(item.prices);

                            return (
                                <div
                                    key={item.id}
                                    className={`bg-white rounded-2xl shadow-lg border-2 overflow-hidden ${
                                        isActive ? 'border-blue-500' : 'border-slate-200'
                                    }`}
                                >
                                    {/* Period Header */}
                                    <div className={`p-4 border-b ${isActive ? 'bg-blue-600 border-blue-700' : 'bg-slate-50 border-slate-200'}`}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className={`text-sm font-bold uppercase tracking-wide ${isActive ? 'text-white' : 'text-slate-600'}`}>
                                                    {t(item.name)}
                                                </div>
                                                {dateStr && (
                                                    <div className={`text-xs mt-1 font-medium ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                                                        {dateStr}
                                                    </div>
                                                )}
                                            </div>
                                            {isActive && (
                                                <div className="inline-flex items-center bg-white/20 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                                                    {labels.bestValue || 'CURRENT'}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Price List */}
                                    <div className="p-4 space-y-3">
                                        {priceList.map((priceData) => (
                                            <div
                                                key={`${item.id}-${priceData.name}`}
                                                className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                                            >
                                                <span className="text-sm font-medium text-slate-700">
                                                    {priceData.name}
                                                </span>
                                                <span className="text-lg font-bold font-mono text-blue-600">
                                                    {getCurrencyDisplay(priceData.amount)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Refund Policy */}
                    {refundPolicy && (
                        <div className="mt-12 p-6 bg-amber-50 rounded-xl border border-amber-200/60">
                            <div className="flex items-start gap-3">
                                <svg
                                    className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <title>{labels.refundPolicyTitle}</title>
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                <div>
                                    <h3 className="text-base font-bold text-slate-800 mb-2">
                                        {labels.refundPolicyTitle}
                                    </h3>
                                    <p className="text-sm text-slate-600 leading-relaxed">{refundPolicy}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </>
    );
};
