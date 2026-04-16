import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { safeFormatDate } from '../utils/dateUtils';
import {
    Users,
    Calendar,
    MapPin,
    ChevronRight,
    MessageCircle,
    ArrowRight,
    ShieldCheck,
    BarChart3
} from 'lucide-react';
import EregiNavigation from '../components/eregi/EregiNavigation';
import { EregiButton } from '@/components/eregi/EregiForm';
import { FOOTER_INFO, UI_TEXT } from '../constants/defaults';

interface Society {
    id: string;
    name: { ko: string; en: string };
    logoUrl?: string;
}

interface Conference {
    id: string;
    title: string | { ko: string; en: string };
    societyId: string;
    societyName?: string;
    dates?: { start: unknown; end: unknown };
    venueName?: string;
    status: string;
}

const LandingPage: React.FC = () => {
    const [societies, setSocieties] = useState<Society[]>([]);
    const [conferences, setConferences] = useState<Conference[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Societies
                const socSnap = await getDocs(query(collection(db, 'societies'), limit(10)));
                const socList = socSnap.docs.map(d => ({ id: d.id, ...d.data() } as Society));
                setSocieties(socList);

                // Fetch Conferences
                const confSnap = await getDocs(query(collection(db, 'conferences'), limit(6)));
                const confList = confSnap.docs.map(d => {
                    const data = d.data();
                    const sName = socList.find(s => s.id === data.societyId)?.name.ko || data.societyId;
                    return { id: d.id, ...data, societyName: sName } as Conference;
                });
                setConferences(confList);
            } catch (err) {
                console.error("Error fetching landing data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const formatTitle = (title: string | { ko: string; en: string }) => {
        if (typeof title === 'string') return title;
        return title?.ko || 'Untitled Conference';
    };

    const formatDate = (dateObj: any) => {
        if (!dateObj) return 'TBA';
        return safeFormatDate(dateObj, 'ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatDateRange = (dates?: { start: unknown; end: unknown }) => {
        if (!dates?.start && !dates?.end) return '일정 추후 공지';
        const start = formatDate(dates?.start);
        const end = formatDate(dates?.end);
        if (!dates?.end || start === end) return start;
        return `${start} - ${end}`;
    };

    const getStatusMeta = (status?: string) => {
        const s = (status || '').toUpperCase();
        if (s.includes('LIVE') || s.includes('OPEN') || s.includes('ONGOING') || s.includes('ACTIVE')) {
            return {
                label: '진행중',
                className: 'bg-emerald-50 text-emerald-700 border border-emerald-100'
            };
        }
        if (s.includes('PREP') || s.includes('COMING') || s.includes('READY') || s.includes('DRAFT')) {
            return {
                label: '준비중',
                className: 'bg-amber-50 text-amber-700 border border-amber-100'
            };
        }
        if (s.includes('CLOSE') || s.includes('END') || s.includes('FINISH')) {
            return {
                label: '종료',
                className: 'bg-slate-100 text-slate-600 border border-slate-200'
            };
        }
        return {
            label: '운영중',
            className: 'bg-blue-50 text-blue-700 border border-blue-100'
        };
    };

    return (
        <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_40%,#f8fafc_100%)] font-sans text-slate-900 overflow-x-hidden">
            {/* 1. HEADER */}
            <EregiNavigation transparent />

            {/* 2. HERO SECTION */}
            <section className="pt-32 pb-16 px-4 sm:px-6">
                <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.2fr_.8fr] gap-8 lg:gap-10 items-center">
                    <div className="space-y-6 animate-in slide-in-from-left duration-700">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-overline font-bold">
                            <ShieldCheck size={14} /> TRUSTED CONFERENCE PLATFORM
                        </div>
                        <h1 className="text-display-lg font-display text-slate-900 leading-[1.12] tracking-tight">
                            학술대회 운영을
                            <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-cyan-600">
                                한 화면에서 단순하게
                            </span>
                        </h1>
                        <p className="text-body-xl text-slate-600 leading-relaxed max-w-2xl">
                            학회별 독립 도메인, 등록/결제, 명찰, 방명록 동의 관리, 실시간 운영 대시보드까지
                            eRegi에서 통합 제공합니다.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                            <EregiButton
                                onClick={() => navigate('/auth')}
                                className="w-full sm:w-auto px-7 py-4 text-base h-auto rounded-2xl shadow-lg hover:shadow-xl transition-all"
                            >
                                시작하기 <ArrowRight size={18} className="ml-2" />
                            </EregiButton>

                            <button
                                onClick={() => window.open('https://pf.kakao.com/_wxexmxgn/chat', '_blank')}
                                className="w-full sm:w-auto bg-white border border-slate-200 text-slate-700 px-7 py-4 rounded-2xl font-bold text-base hover:bg-slate-50 transition"
                            >
                                카카오톡 문의
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-6 pt-2">
                            <div>
                                <div className="text-heading-3 font-display text-slate-900">500+</div>
                                <div className="text-overline text-slate-400 font-bold">Annual Events</div>
                            </div>
                            <div>
                                <div className="text-heading-3 font-display text-slate-900">100k+</div>
                                <div className="text-overline text-slate-400 font-bold">Participants</div>
                            </div>
                            <div>
                                <div className="text-heading-3 font-display text-slate-900">99.9%</div>
                                <div className="text-overline text-slate-400 font-bold">Service Uptime</div>
                            </div>
                        </div>
                    </div>

                    <div className="relative animate-in zoom-in duration-700">
                        <div className="absolute -inset-2 bg-gradient-to-tr from-blue-600/20 to-cyan-500/20 rounded-3xl blur-2xl"></div>
                        <div className="relative rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xl">
                            <div className="flex items-center justify-between mb-5">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Operational Snapshot</p>
                                <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold">Live</span>
                            </div>
                            <div className="space-y-4">
                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-slate-700">실시간 등록</span>
                                        <span className="text-xl font-black text-slate-900">1,284</span>
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-slate-700">방명록 동의 기록</span>
                                        <span className="text-xl font-black text-slate-900">742</span>
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-slate-700">현장 체크인</span>
                                        <span className="text-xl font-black text-slate-900">96%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 3. SOCIETIES GRID */}
            <section className="py-16 bg-slate-50/80 border-y border-slate-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="text-center mb-12">
                        <p className="text-blue-700 text-overline font-bold mb-2">Partner Organizations</p>
                        <h2 className="text-heading-2 font-display text-slate-900">협력 학회</h2>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
                        {societies.map(soc => (
                            <div
                                key={soc.id}
                                onClick={() => window.open(`https://${soc.id}.eregi.co.kr`, '_blank')}
                                className="group flex flex-col items-center justify-center p-5 sm:p-6 bg-white rounded-2xl border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer"
                            >
                                <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-50 transition-colors">
                                    <span className="text-lg font-black text-slate-400 group-hover:text-blue-700">{soc.id.substring(0, 2).toUpperCase()}</span>
                                </div>
                                <span className="text-xs font-bold text-slate-600 text-center line-clamp-1">{soc.name.ko}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 4. CONFERENCE FEED */}
            <section className="py-20 px-4 sm:px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-10">
                        <div className="space-y-2">
                            <span className="text-blue-700 text-overline font-bold">{UI_TEXT.upcomingEvents.subtitle.ko}</span>
                            <h2 className="text-heading-1 font-display text-slate-900 tracking-tight">{UI_TEXT.upcomingEvents.title.ko}</h2>
                            <p className="text-body text-slate-500 font-medium">{UI_TEXT.upcomingEvents.description.ko}</p>
                        </div>
                        <button
                            onClick={() => navigate('/auth')}
                            className="bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition"
                        >
                            전체 서비스 보기 <ChevronRight size={18} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="grid md:grid-cols-3 gap-8">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-80 bg-slate-100 rounded-3xl animate-pulse"></div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {conferences.length === 0 && <div className="col-span-full text-center py-20 text-slate-400 font-bold">진행 중인 행사가 없습니다.</div>}
                            {conferences.map(conf => (
                                <div key={conf.id} className="group relative bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-lg transition-all cursor-pointer" onClick={() => window.open(`https://${conf.societyId}.eregi.co.kr`, '_blank')}>
                                    <div className="flex justify-between items-start mb-5">
                                        <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-wider">{conf.societyName}</div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">#{conf.societyId}</div>
                                    </div>

                                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 mb-5 line-clamp-2 min-h-[56px] leading-tight group-hover:text-blue-700 transition-colors">
                                        {formatTitle(conf.title)}
                                    </h3>

                                    <div className="space-y-3 pt-5 border-t border-slate-100">
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <Calendar size={18} className="text-slate-400" />
                                            <span className="text-sm font-bold">{formatDateRange(conf.dates)}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <MapPin size={18} className="text-slate-400" />
                                            <span className="text-sm font-bold">{conf.venueName || 'Online'}</span>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-1 flex items-center justify-between">
                                        <span className={`inline-flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-full ${getStatusMeta(conf.status).className}`}>
                                            {getStatusMeta(conf.status).label}
                                        </span>
                                        <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-all shadow-lg shadow-black/20">
                                            <ArrowRight size={20} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* 5. CONTACT SECTION */}
            <section className="py-16 sm:py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="bg-slate-900 rounded-[2rem] sm:rounded-[2.5rem] p-8 sm:p-12 lg:p-16 relative overflow-hidden text-center lg:text-left">
                        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-500/20 to-transparent"></div>
                        <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
                            <div>
                                <h2 className="text-3xl lg:text-5xl font-black text-white mb-6 leading-tight">학술대회 운영, 지금 간단하게 시작하세요</h2>
                                <p className="text-slate-300 text-base sm:text-lg font-medium max-w-lg mb-8 mx-auto lg:mx-0">
                                    도입 상담, 기능 안내, 운영 절차까지
                                    카카오톡으로 빠르게 안내해 드립니다.
                                </p>
                                <button onClick={() => window.open('https://pf.kakao.com/_wxexmxgn/chat', '_blank')} className="inline-flex items-center justify-center gap-3 bg-yellow-400 text-slate-900 px-8 py-4 rounded-2xl font-black text-lg hover:bg-yellow-300 shadow-2xl transition w-full sm:w-auto">
                                    <MessageCircle size={24} /> 카카오톡 상담
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                                    <BarChart3 className="text-blue-400 mb-4" />
                                    <div className="text-white font-bold mb-1">Real-time Analytics</div>
                                    <div className="text-slate-500 text-sm">Monitor registration stats live.</div>
                                </div>
                                <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                                    <Users className="text-indigo-500 mb-4" />
                                    <div className="text-white font-bold mb-1">Expert Support</div>
                                    <div className="text-slate-500 text-sm">24/7 technical assistance.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="bg-white py-12 px-6 border-t border-slate-100">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white text-xs font-black">e</div>
                        <span className="text-lg font-black text-slate-900 tracking-tighter">eRegi</span>
                    </div>

                    <div className="flex flex-wrap justify-center gap-8 text-xs font-bold text-slate-400 uppercase tracking-widest">
                        <button onClick={() => navigate('/terms')} className="hover:text-slate-900 transition-colors">이용약관</button>
                        <button onClick={() => navigate('/privacy')} className="hover:text-slate-900 transition-colors">개인정보처리방침</button>
                        <button onClick={() => navigate('/admin')} className="hover:text-slate-900 transition-colors">Admin Console</button>
                    </div>

                    <div className="flex flex-col items-center md:items-end gap-2 text-right">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                            {FOOTER_INFO.companyKr} | Biz No: {FOOTER_INFO.bizRegNumber}
                        </p>
                        <p className="text-[10px] text-slate-400">
                            {FOOTER_INFO.address}
                        </p>
                        <p className="text-[10px] text-slate-400">
                            TEL {FOOTER_INFO.phone} / FAX {FOOTER_INFO.fax}
                        </p>
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2">
                            &copy; {FOOTER_INFO.year} {FOOTER_INFO.company}. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
};
export default LandingPage;
