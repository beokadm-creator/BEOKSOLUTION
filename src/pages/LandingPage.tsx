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

    return (
        <div className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">
            {/* 1. HEADER */}
            <EregiNavigation transparent />

            {/* 2. HERO SECTION */}
            <section className="pt-40 pb-20 px-6">
                <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
                    <div className="space-y-8 animate-in slide-in-from-left duration-700">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-eregi-50 text-eregi-600 border border-eregi-100 text-xs font-bold uppercase tracking-wider">
                            <ShieldCheck size={14} /> Reliable Conference Infrastructure
                        </div>
                        <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 leading-[1.1] tracking-tight">
                            The Next Era of <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-eregi-600 to-indigo-600">Event Intelligence</span>
                        </h1>
                        <p className="text-lg text-slate-500 leading-relaxed max-w-xl">
                            학술대회 등록부터 실시간 이수 관리까지. <br />
                            운영 솔루션, eRegi와 함께하세요.
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <EregiButton
                                onClick={() => navigate('/auth')}
                                className="px-8 py-4 text-lg h-auto rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all"
                            >
                                Get Started <ArrowRight size={20} className="ml-2" />
                            </EregiButton>

                            <button onClick={() => window.open('https://pf.kakao.com/_wxexmxgn/chat', '_blank')} className="bg-white border border-slate-200 text-slate-700 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-slate-50 transition transform hover:-translate-y-1">
                                Request Demo
                            </button>
                        </div>
                        <div className="flex gap-8 pt-4">
                            <div>
                                <div className="text-2xl font-black text-slate-900">500+</div>
                                <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Global Events</div>
                            </div>
                            <div className="border-l border-slate-200 h-10 my-auto"></div>
                            <div>
                                <div className="text-2xl font-black text-slate-900">100k+</div>
                                <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Participants</div>
                            </div>
                        </div>
                    </div>

                    <div className="relative animate-in zoom-in duration-1000">
                        <div className="absolute -inset-4 bg-gradient-to-tr from-eregi-600 to-indigo-600 rounded-3xl opacity-10 blur-2xl"></div>
                        <div className="relative bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-white/10 aspect-[4/3] flex items-center justify-center">
                            {/* Mockup Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-br from-eregi-500/10 to-transparent"></div>
                            <div className="p-8 w-full space-y-6">
                                <div className="h-4 w-32 bg-slate-800 rounded-full"></div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="h-24 bg-slate-800 rounded-2xl animate-pulse"></div>
                                    <div className="h-24 bg-eregi-600/20 rounded-2xl border border-eregi-500/30"></div>
                                    <div className="h-24 bg-slate-800 rounded-2xl"></div>
                                </div>
                                <div className="h-40 bg-slate-800 rounded-3xl opacity-50 relative overflow-hidden">
                                    <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-eregi-600/5 backdrop-blur-sm p-4">
                                        <div className="h-2 w-1/2 bg-eregi-400/20 rounded mb-2"></div>
                                        <div className="h-2 w-2/3 bg-eregi-400/10 rounded"></div>
                                    </div>
                                </div>
                            </div>
                            <div className="absolute top-4 right-4 bg-eregi-600 text-[10px] font-black px-2 py-1 rounded-md text-white tracking-widest uppercase">Admin Console Live</div>
                        </div>
                        {/* Decorative Badge */}
                        <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-2xl shadow-xl border border-slate-100 space-y-2 max-w-[180px]">
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map(i => <div key={i} className="w-3 h-3 bg-yellow-400 rounded-full"></div>)}
                            </div>
                            <p className="text-[11px] font-bold text-slate-600">Rated #1 Academic Event Solution</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* 3. SOCIETIES GRID */}
            <section className="py-20 bg-slate-50">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <p className="text-eregi-600 font-black text-xs uppercase tracking-widest mb-2">Partner Organizations</p>
                        <h2 className="text-3xl font-extrabold text-slate-900">Trusted by Premier Societies</h2>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                        {societies.map(soc => (
                            <div key={soc.id} onClick={() => window.open(`https://${soc.id}.eregi.co.kr`, '_blank')} className="group flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-slate-100 hover:border-eregi-200 hover:shadow-xl hover:shadow-eregi-600/5 transition-all cursor-pointer">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-eregi-50 transition-colors">
                                    <span className="text-xl font-black text-slate-300 group-hover:text-eregi-600">{soc.id.substring(0, 2).toUpperCase()}</span>
                                </div>
                                <span className="text-xs font-bold text-slate-600 text-center line-clamp-1">{soc.name.ko}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 4. CONFERENCE FEED */}
            <section className="py-24 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-16">
                        <div className="space-y-2">
                            <span className="text-eregi-600 font-black text-xs uppercase tracking-widest">{UI_TEXT.upcomingEvents.subtitle.ko}</span>
                            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">{UI_TEXT.upcomingEvents.title.ko}</h2>
                            <p className="text-slate-500 font-medium">{UI_TEXT.upcomingEvents.description.ko}</p>
                        </div>
                        <button className="bg-slate-50 border border-slate-200 text-slate-600 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-100 transition">
                            View All Events <ChevronRight size={18} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="grid md:grid-cols-3 gap-8">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-80 bg-slate-100 rounded-3xl animate-pulse"></div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-3 gap-8">
                            {conferences.length === 0 && <div className="col-span-full text-center py-20 text-slate-400 font-bold">진행 중인 행사가 없습니다.</div>}
                            {conferences.map(conf => (
                                <div key={conf.id} className="group relative bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm hover:shadow-2xl hover:shadow-slate-200 transition-all cursor-pointer" onClick={() => window.open(`https://${conf.societyId}.eregi.co.kr`, '_blank')}>
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="px-3 py-1 bg-eregi-50 text-eregi-600 rounded-lg text-[10px] font-black uppercase tracking-wider">{conf.societyName}</div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">#{conf.societyId}</div>
                                    </div>

                                    <h3 className="text-xl font-extrabold text-slate-900 mb-6 line-clamp-2 h-14 leading-tight group-hover:text-eregi-600 transition-colors">
                                        {formatTitle(conf.title)}
                                    </h3>

                                    <div className="space-y-4 pt-6 border-t border-slate-50">
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <Calendar size={18} className="text-slate-400" />
                                            <span className="text-sm font-bold">{formatDate(conf.dates?.start)}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <MapPin size={18} className="text-slate-400" />
                                            <span className="text-sm font-bold">{conf.venueName || 'Online'}</span>
                                        </div>
                                    </div>

                                    <div className="mt-8 pt-2 flex items-center justify-between">
                                        <span className="flex items-center gap-1.5 text-xs font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                            OPEN
                                        </span>
                                        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-all shadow-lg shadow-black/20">
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
            <section className="py-20">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="bg-slate-900 rounded-[3rem] p-12 lg:p-20 relative overflow-hidden text-center lg:text-left">
                        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-eregi-600/20 to-transparent"></div>
                        <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
                            <div>
                                <h2 className="text-4xl lg:text-5xl font-black text-white mb-6 leading-tight">Ready to Modernize Your Conference?</h2>
                                <p className="text-slate-400 text-lg font-medium max-w-lg mb-10 mx-auto lg:mx-0">
                                    도입 비용, 기능 문의 등 궁금한 점이 있으신가요? <br />
                                    카카오톡 실시간 상담을 통해 빠르게 답변해 드립니다.
                                </p>
                                <button onClick={() => window.open('https://pf.kakao.com/_wxexmxgn/chat', '_blank')} className="inline-flex items-center gap-3 bg-yellow-400 text-slate-900 px-10 py-5 rounded-2xl font-black text-xl hover:bg-yellow-300 shadow-2xl transition w-full sm:w-auto">
                                    <MessageCircle size={28} /> KaKaoTalk Inquiry
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                                    <BarChart3 className="text-eregi-500 mb-4" />
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
