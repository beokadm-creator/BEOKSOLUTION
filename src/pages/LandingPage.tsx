import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { safeFormatDate } from '../utils/dateUtils';
import {
    Calendar,
    MapPin,
    ChevronRight,
    MessageCircle,
    ArrowRight,
    ShieldCheck
} from 'lucide-react';
import EregiNavigation from '../components/eregi/EregiNavigation';
import { EregiButton } from '@/components/eregi/EregiForm';
import { FOOTER_INFO, UI_TEXT } from '../constants/defaults';
import { useStaggeredAnimation, useScrollAnimation } from '../hooks/useScrollAnimation';

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

    // Animation refs for Academic Elegance entrance
    const heroContentRef = useStaggeredAnimation(100, 'animate-fade-in-up');
    const societiesRef = useScrollAnimation('animate-fade-in-up');
    const conferencesRef = useScrollAnimation('animate-fade-in-up');
    const contactRef = useScrollAnimation('animate-scale-in');

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
        <div className="min-h-screen bg-eregi-neutral-50 font-body text-foreground overflow-x-hidden">
            {/* 1. HEADER */}
            <EregiNavigation transparent />

            {/* 2. HERO SECTION */}
            <section className="pt-24 pb-20 px-6">
                <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.2fr_.8fr] gap-12 items-center">
                    <div ref={heroContentRef} className="space-y-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold tracking-wider">
                            <ShieldCheck size={14} /> TRUSTED CONFERENCE PLATFORM
                        </div>
                        <h1 className="text-display-lg font-display text-eregi-primary">
                            학술대회 운영을
                            <br />
                            <span className="text-eregi-secondary">
                                한 화면에서 단순하게
                            </span>
                        </h1>
                        <p className="text-body-xl text-muted-foreground leading-relaxed max-w-prose">
                            학회별 독립 도메인, 등록/결제, 명찰, 방명록 동의 관리, 실시간 운영 대시보드까지
                            eRegi에서 통합 제공합니다.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <EregiButton
                                onClick={() => navigate('/auth')}
                                className="w-full sm:w-auto px-8 py-4 text-body-xl h-auto btn-academic group"
                            >
                                시작하기 <ArrowRight size={18} className="ml-2 transition-transform duration-200 group-hover:translate-x-1" />
                            </EregiButton>

                            <button
                                onClick={() => window.open('https://pf.kakao.com/_wxexmxgn/chat', '_blank')}
                                className="w-full sm:w-auto bg-card border border-eregi-neutral-100 text-foreground px-8 py-4 rounded-xl font-medium text-body-xl btn-academic hover:bg-eregi-neutral-50"
                            >
                                카카오톡 문의
                            </button>
                        </div>
                        <div className="pt-8">
                            <p className="text-body-sm text-muted-foreground font-medium">
                                전국 주요 학회에서 신뢰하는 학술대회 플랫폼
                            </p>
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
            <section className="py-20 bg-card border-y border-eregi-neutral-100">
                <div ref={societiesRef} className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <p className="text-overline text-eregi-secondary mb-4">Partner Organizations</p>
                        <h2 className="text-heading-1 font-display text-eregi-primary">협력 학회</h2>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {societies.map(soc => (
                            <div
                                key={soc.id}
                                onClick={() => window.open(`https://${soc.id}.eregi.co.kr`, '_blank')}
                                className="group flex flex-col items-center justify-center p-6 bg-background border border-eregi-neutral-100 rounded-xl card-academic cursor-pointer"
                            >
                                <div className="w-12 h-12 bg-eregi-neutral-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-eregi-neutral-100 transition-colors">
                                    <span className="text-label font-semibold text-muted-foreground group-hover:text-eregi-primary">{soc.id.substring(0, 2).toUpperCase()}</span>
                                </div>
                                <span className="text-caption text-foreground text-center leading-tight">{soc.name.ko}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 4. CONFERENCE FEED */}
            <section className="py-24 px-6">
                <div ref={conferencesRef} className="max-w-6xl mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-16">
                        <div className="space-y-4">
                            <p className="text-overline text-eregi-secondary">{UI_TEXT.upcomingEvents.subtitle.ko}</p>
                            <h2 className="text-heading-1 font-display text-eregi-primary">{UI_TEXT.upcomingEvents.title.ko}</h2>
                            <p className="text-body text-muted-foreground max-w-prose">{UI_TEXT.upcomingEvents.description.ko}</p>
                        </div>
                        <button
                            onClick={() => navigate('/auth')}
                            className="bg-card border border-eregi-neutral-100 text-foreground px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-eregi-neutral-50 transition-colors"
                        >
                            전체 서비스 보기 <ChevronRight size={18} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-80 bg-eregi-neutral-100 rounded-xl animate-pulse"></div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {conferences.length === 0 && (
                                <div className="text-center py-20">
                                    <p className="text-body text-muted-foreground">진행 중인 행사가 없습니다.</p>
                                </div>
                            )}
                            {conferences.map((conf, index) => (
                                <div
                                    key={conf.id}
                                    className={`group relative bg-card border border-eregi-neutral-100 rounded-xl p-8 card-academic cursor-pointer ${
                                        index % 2 === 0 ? 'lg:mr-24' : 'lg:ml-24'
                                    }`}
                                    onClick={() => window.open(`https://${conf.societyId}.eregi.co.kr`, '_blank')}
                                >
                                    <div className="flex justify-between items-start mb-6">
                                        <span className="text-overline text-eregi-secondary">{conf.societyName}</span>
                                        <span className="text-caption text-muted-foreground">#{conf.societyId}</span>
                                    </div>

                                    <h3 className="text-heading-3 font-display text-eregi-primary mb-6 group-hover:text-eregi-secondary transition-colors">
                                        {formatTitle(conf.title)}
                                    </h3>

                                    <div className="space-y-4 mb-6">
                                        <div className="flex items-center gap-4 text-muted-foreground">
                                            <Calendar size={20} />
                                            <span className="text-body">{formatDateRange(conf.dates)}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-muted-foreground">
                                            <MapPin size={20} />
                                            <span className="text-body">{conf.venueName || 'Online'}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className={`text-caption font-medium px-3 py-2 rounded-lg ${getStatusMeta(conf.status).className}`}>
                                            {getStatusMeta(conf.status).label}
                                        </span>
                                        <div className="w-10 h-10 bg-eregi-primary rounded-lg flex items-center justify-center text-eregi-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity">
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
            <section className="py-24">
                <div ref={contactRef} className="max-w-6xl mx-auto px-6">
                    <div className="bg-eregi-primary rounded-xl p-12 lg:p-16 text-center lg:text-left">
                        <div className="grid lg:grid-cols-[1fr_auto] gap-12 items-center">
                            <div>
                                <h2 className="text-heading-1 font-display text-eregi-primary-foreground mb-6">학술대회 운영, 지금 간단하게 시작하세요</h2>
                                <p className="text-body-xl text-eregi-primary-foreground/80 max-w-prose mb-8 mx-auto lg:mx-0">
                                    도입 상담, 기능 안내, 운영 절차까지
                                    카카오톡으로 빠르게 안내해 드립니다.
                                </p>
                                <button
                                    onClick={() => window.open('https://pf.kakao.com/_wxexmxgn/chat', '_blank')}
                                    className="inline-flex items-center justify-center gap-3 bg-eregi-primary-foreground text-eregi-primary px-8 py-4 rounded-xl font-semibold text-body-xl hover:bg-eregi-neutral-50 transition-colors w-full sm:w-auto"
                                >
                                    <MessageCircle size={20} /> 카카오톡 상담
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="bg-card py-16 px-6 border-t border-eregi-neutral-100">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-eregi-primary rounded-lg flex items-center justify-center text-eregi-primary-foreground text-sm font-semibold">e</div>
                        <span className="text-heading-4 font-display text-eregi-primary">eRegi</span>
                    </div>

                    <div className="flex flex-wrap justify-center gap-8">
                        <button onClick={() => navigate('/terms')} className="text-label text-muted-foreground hover:text-eregi-primary transition-colors">이용약관</button>
                        <button onClick={() => navigate('/privacy')} className="text-label text-muted-foreground hover:text-eregi-primary transition-colors">개인정보처리방침</button>
                        <button onClick={() => navigate('/admin')} className="text-label text-muted-foreground hover:text-eregi-primary transition-colors">Admin Console</button>
                    </div>

                    <div className="flex flex-col items-center md:items-end gap-2 text-right">
                        <p className="text-caption text-muted-foreground">
                            {FOOTER_INFO.companyKr} | Biz No: {FOOTER_INFO.bizRegNumber}
                        </p>
                        <p className="text-body-xs text-muted-foreground">
                            {FOOTER_INFO.address}
                        </p>
                        <p className="text-body-xs text-muted-foreground">
                            TEL {FOOTER_INFO.phone} / FAX {FOOTER_INFO.fax}
                        </p>
                        <p className="text-body-xs text-muted-foreground/70 mt-2">
                            &copy; {FOOTER_INFO.year} {FOOTER_INFO.company}. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
};
export default LandingPage;
