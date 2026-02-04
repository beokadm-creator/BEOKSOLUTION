import React, { useState } from 'react';
import { getGradeName } from '../../../utils/gradeTranslator';
import { useSocietyGrades } from '../../../hooks/useSocietyGrades';
import { useAuth } from '../../../hooks/useAuth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';

type LocalizedString = { [lang: string]: string } | string;

export interface PricingPeriod {
    id: string;
    type?: string;
    name: LocalizedString | string;
    period?: { start: Date; end: Date };
    startDate?: any;
    endDate?: any;
    prices: Record<string, number> | Array<{ name: LocalizedString | string; amount: number; }>;
    isBestValue?: boolean;
}

interface WidePricingProps {
    slug?: string;
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
    societyId?: string; // Added societyId
}

export const WidePricing: React.FC<WidePricingProps> = ({
    slug,
    pricing,
    currency = 'KRW',
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
    const { auth } = useAuth('');
    const [isRegistered, setIsRegistered] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [registrationData, setRegistrationData] = useState<any>(null);

    // Check if user is already registered for this conference
    React.useEffect(() => {
        const checkRegistration = async () => {
            if (!auth.user || !slug) return;

            try {
                const confId = `${societyId}_${slug}`;
                const q = query(
                    collection(db, 'conferences', confId, 'registrations'),
                    where('userId', '==', auth.user.uid)
                );
                const snap = await getDocs(q);

                if (!snap.empty) {
                    setIsRegistered(true);
                    setRegistrationData(snap.docs[0].data());
                } else {
                    setIsRegistered(false);
                }
            } catch (e) {
                console.error('Error checking registration:', e);
            }
        };

        checkRegistration();
    }, [auth.user, slug, societyId]);

    const handleButtonClick = () => {
        if (isRegistered && registrationData) {
            // [Fix] Navigate to badge page directly for registered users (use pure slug)
            window.location.href = slug ? `/${slug}/badge` : `/badge`;
        } else {
            // Navigate to registration page
            window.location.href = slug ? `/${slug}/register?lang=${lang}` : `/register?lang=${lang}`;
        }
    };

    const handleBadgeClick = () => {
        window.location.href = slug ? `/${slug}/badge` : `/badge`;
    };

    // Task 1: Grade Localization
    const { getGradeLabel, gradeMasterMap } = useSocietyGrades(societyId);

    const manualMap: Record<string, string> = {
        'Dental hygienist': '치과위생사',
        'Resident': '전공의/수련의',
        'MO PHD': '군의관_공보의',
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

        // 3. Grade Master Map (getGradeLabel)
        // getGradeLabel returns code if not found, or the label.
        // We assume 'name' passed here is the code or name.
        // Try exact match as code
        if (gradeMasterMap.has(name)) {
            return gradeMasterMap.get(name)?.ko || name;
        }
        // Try normalized as code
        const codeNorm = name.toLowerCase().replace(/\s/g, '_'); // e.g. "Non Member" -> "non_member"
        if (gradeMasterMap.has(codeNorm)) {
             return gradeMasterMap.get(codeNorm)?.ko || name;
        }

        return name.replace(/_/g, ' ');
    };

    const formatDate = (dateVal: any) => {
        if (!dateVal) return '';
        const d = dateVal instanceof Date ? dateVal : (dateVal.toDate ? dateVal.toDate() : new Date(dateVal));
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

    const normalizePrices = (prices: any) => {
        if (!prices) return [];
        let arr: { name: string; amount: number }[] = [];
        
        if (Array.isArray(prices)) {
            arr = prices.map(p => {
                const rawName = t(p.name);
                // Apply translation only if rawName is English-like (optional, but safer to just apply)
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

    const currencySymbol = '₩'; // Forced
    
    const getCurrencyDisplay = (amount: number) => {
         return `${currencySymbol}${amount.toLocaleString()}`;
    };

    if (!pricing || pricing.length === 0) return null;

    return (
        <section className="w-full flex justify-center">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl w-full">
                {pricing.map((item) => {
                    const isActive = isCurrentPeriod(item);
                    const { start, end } = getPeriodDates(item);
                    const dateStr = start && end ? `${formatDate(start)} ~ ${formatDate(end)}` : '';
                    
                    const priceList = normalizePrices(item.prices);
                    
                    // Determine highlight price (try to find General/Standard/Non-Member, else max)
                    let highlightPrice = 0;
                    const generalPrice = priceList.find(p => 
                        p.name.toLowerCase().includes('general') || 
                        p.name.includes('일반') || 
                        p.name.toLowerCase().includes('non-member')
                    );
                    
                    if (generalPrice) {
                        highlightPrice = generalPrice.amount;
                    } else if (priceList.length > 0) {
                        highlightPrice = priceList[priceList.length - 1].amount;
                    }

                    return (
                        <div key={item.id} className={`bg-white rounded-2xl p-8 shadow-sm transition-all relative overflow-hidden flex flex-col items-center text-center max-w-sm mx-auto w-full ${isActive ? 'ring-4 ring-blue-500 shadow-xl scale-105 z-10' : 'border border-slate-200 hover:shadow-lg'}`}>
                             {isActive && (
                                <div className="absolute top-0 inset-x-0 bg-blue-500 text-white text-xs font-bold py-1.5 uppercase tracking-widest">
                                    {labels.bestValue || 'Open Now'}
                                </div>
                            )}

                            <div className="mt-4 mb-2">
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold tracking-wide ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {t(item.name)}
                                </span>
                            </div>

                            {/* Date Range */}
                            {dateStr && (
                                <p className={`text-sm font-medium mb-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                                    {dateStr}
                                </p>
                            )}

                            <div className="text-4xl font-black text-slate-900 mb-2">
                                <span className="text-lg font-medium text-slate-400 mr-1">{currencySymbol}</span>
                                {highlightPrice.toLocaleString()}
                            </div>
                            <p className="text-sm text-slate-500 mb-8">
                                {generalPrice ? generalPrice.name : (priceList.length > 0 ? 'Registration Fee' : '')}
                            </p>

                            <div className="w-full h-px bg-slate-100 mb-6"></div>

                            {/* Detailed Prices List */}
                            <ul className="text-sm text-slate-500 space-y-4 w-full text-left">
                                {priceList.map((p, idx) => (
                                    <li key={idx} className="flex justify-between items-center group">
                                        <span className="font-medium text-slate-600 group-hover:text-slate-900 transition-colors">{p.name}</span>
                                        <span className={`font-mono font-bold ${isActive ? 'text-blue-600' : 'text-slate-700'}`}>
                                            {getCurrencyDisplay(p.amount)}
                                        </span>
                                    </li>
                                ))}
                            </ul>

                            {isRegistered ? (
                                <>
                                    <button onClick={handleButtonClick} className={`mt-8 w-full py-3 rounded-xl font-bold transition-all ${isActive ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                                        {lang === 'ko' ? '등록확인' : 'Registration Status'}
                                    </button>
                                </>
                            ) : (
                                    <button onClick={handleButtonClick} className={`mt-8 w-full py-3 rounded-xl font-bold transition-all ${isActive ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                                        {lang === 'ko' ? '등록하기' : 'Register Now'}
                                    </button>
                            )}

                            {/* QR Modal */}
                            {showQRModal && registrationData && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowQRModal(false)}>
                                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8 m-4" onClick={(e) => e.stopPropagation()}>
                                        <h3 className="text-xl font-bold text-slate-900 mb-6 text-center">
                                            {lang === 'ko' ? '등록확인' : 'Registration Confirmation'}
                                        </h3>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center py-3 border-b border-slate-100">
                                                <span className="text-sm text-slate-600">
                                                    {lang === 'ko' ? '이름' : 'Name'}
                                                </span>
                                                <span className="font-bold text-slate-900">
                                                    {registrationData.userName || auth.user?.name || '-'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center py-3 border-b border-slate-100">
                                                <span className="text-sm text-slate-600">
                                                    {lang === 'ko' ? '참가 유형' : 'Registration Type'}
                                                </span>
                                                <span className="font-bold text-slate-900">
                                                    {registrationData.userTier || '-'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center py-3 border-b border-slate-100">
                                                <span className="text-sm text-slate-600">
                                                    {lang === 'ko' ? '등록일' : 'Registration Date'}
                                                </span>
                                                <span className="font-bold text-slate-900">
                                                    {registrationData.createdAt ? new Date(registrationData.createdAt.seconds * 1000).toLocaleDateString() : '-'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center py-3 border-b border-slate-100">
                                                <span className="text-sm text-slate-600">
                                                    {lang === 'ko' ? '결제 상태' : 'Payment Status'}
                                                </span>
                                                <span className={`font-bold ${registrationData.paymentStatus === 'PAID' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {registrationData.paymentStatus === 'PAID' ? (lang === 'ko' ? '완료' : 'Paid') : (lang === 'ko' ? '미결' : 'Pending')}
                                                </span>
                                            </div>
                                            <div className="flex gap-3 mt-6">
                                                <button
                                                    onClick={handleBadgeClick}
                                                    className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                                                >
                                                    {lang === 'ko' ? '디지털 명찰 발급' : 'Get Digital Badge'}
                                                </button>
                                                <button
                                                    onClick={() => setShowQRModal(false)}
                                                    className="flex-1 py-3 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 transition-colors"
                                                >
                                                    {lang === 'ko' ? '닫기' : 'Close'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {refundPolicy && (
                    <div className="col-span-full mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-200/60 text-sm text-slate-500 text-center max-w-4xl mx-auto">
                        <strong className="block text-slate-700 mb-2 text-base">{labels.refundPolicyTitle}</strong>
                        <p className="leading-relaxed">{refundPolicy}</p>
                    </div>
                )}
            </div>
        </section>
    );
};
