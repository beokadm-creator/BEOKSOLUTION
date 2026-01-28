import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { Society, Conference } from '../types/schema';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
    Calendar,
    MapPin,
    ChevronRight,
    Globe,
    UserPlus,
    LogIn,
    Info,
    ArrowRight,
    Trophy,
    Target
} from 'lucide-react';

const SocietyLandingPage: React.FC = () => {
    // [Step 403-D] Sync Auth Token from URL if present
    useAuth('');
    const { societyId: paramId } = useParams<{ societyId: string }>();
    const [societyId, setSocietyId] = useState<string | null>(paramId || null);
    const navigate = useNavigate();

    // [Step 411-D] Redirect /mypage calls to Global Hub (Performance Fix)
    // If we are on a society domain and URL ends with /mypage, redirect immediately
    useEffect(() => {
        if (window.location.pathname.endsWith('/mypage')) {
            window.location.href = 'https://kadd.eregi.co.kr/mypage';
        }
    }, []);

    const [society, setSociety] = useState<Society | null>(null);
    const [conferences, setConferences] = useState<Conference[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!paramId) {
            const host = window.location.hostname;
            const parts = host.split('.');
            if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin' && parts[0] !== 'eregi') {
                setSocietyId(parts[0].toLowerCase());
            }
        }
    }, [paramId]);

    useEffect(() => {
        if (!societyId) return;

        const fetchData = async () => {
            try {
                // 1. Fetch Society Info
                const socRef = doc(db, 'societies', societyId);
                const socSnap = await getDoc(socRef);

                if (!socSnap.exists()) {
                    if (paramId) navigate('/');
                    setLoading(false);
                    return;
                }

                const socData = { id: socSnap.id, ...socSnap.data() } as Society;
                setSociety(socData);

                // 2. Fetch Conferences (Broaden query to find field name)
                const confRef = collection(db, 'conferences');

                // We try societyId as primary, but also check hostId if societyId fails (as requested)
                // However, since we can't easily do OR across fields in simple query without index,
                // we'll fetch by societyId variations first.
                const variations = [societyId, societyId.toLowerCase(), societyId.toUpperCase()];
                const q = query(confRef, where('societyId', 'in', [...new Set(variations)]));
                const confSnaps = await getDocs(q);

                let confList = confSnaps.docs.map(d => ({ id: d.id, ...d.data() } as Conference));

                // Emergency Fallback: If 0 results, try 'hostId' field
                if (confList.length === 0) {
                    const q2 = query(confRef, where('hostId', 'in', [...new Set(variations)]));
                    const snap2 = await getDocs(q2);
                    confList = snap2.docs.map(d => ({ id: d.id, ...d.data() } as Conference));
                }

                setConferences(confList);

            } catch (err) {
                console.error("Fetch Error:", err);
                toast.error("Failed to load society data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [societyId, navigate, paramId]);

    if (loading) return <LoadingSpinner />;
    if (!society) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400">Society Not Found</div>;

    const getConferenceUrl = (conf: Conference, path: string = '') => {
        const host = window.location.hostname;
        const base = (host === 'localhost' || host === '127.0.0.1' || host.startsWith(society.id))
            ? `/${conf.slug}`
            : `${window.location.protocol}//${society.id}.eregi.co.kr/${conf.slug}`;
        return path ? `${base}/${path}` : base;
    };

    const formatDate = (ts: any) => {
        if (!ts) return 'TBA';
        const date = new Date(ts.seconds * 1000);
        return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    // 3-Status Categorization
    const activeConfs = conferences.filter(c => c.status === 'OPEN').sort((a, b) => b.dates?.start?.seconds - a.dates?.start?.seconds);
    const upcomingConfs = conferences.filter(c => c.status === 'PLANNING').sort((a, b) => a.dates?.start?.seconds - b.dates?.start?.seconds);
    const pastConfs = conferences.filter(c => ['CLOSED', 'ARCHIVED'].includes(c.status)).sort((a, b) => b.dates?.start?.seconds - a.dates?.start?.seconds);

    return (
        <div className="min-h-screen bg-white font-sans text-slate-900">
            {/* 1. NAV BAR */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 h-20">
                <div className="max-w-7xl mx-auto px-6 h-full flex justify-between items-center">
                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/')}>
                        {society.logoUrl ? (
                            <img src={society.logoUrl} alt="Logo" className="h-10 object-contain" />
                        ) : (
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black uppercase text-sm shadow-lg shadow-blue-600/20">{society.id.substring(0, 2)}</div>
                        )}
                        <div className="hidden sm:block">
                            <h1 className="text-lg font-black text-slate-900 leading-none">{society.name.ko}</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Society Hub</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <button onClick={() => navigate('/auth')} className="text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors flex items-center gap-1.5 px-4 py-2 rounded-xl hover:bg-slate-50"><LogIn size={16} /> LOGIN</button>
                        <button onClick={() => navigate('/auth?mode=signup')} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-black transition shadow-lg"><UserPlus size={16} /> SIGNUP</button>
                    </div>
                </div>
            </nav>

            {/* 2. HERO SECTION */}
            <section className="pt-20">
                <div className="relative h-[440px] bg-slate-900 flex items-center overflow-hidden">
                    <div className="absolute inset-0 opacity-30 bg-[url('https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/60 to-transparent"></div>

                    <div className="relative max-w-7xl mx-auto px-6 w-full animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        <div className="max-w-3xl space-y-6">
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[10px] font-black uppercase tracking-widest">
                                <Globe size={12} /> Official Society Portal
                            </span>
                            <h2 className="text-5xl md:text-7xl font-black text-white leading-[1.1] tracking-tight">
                                {society.name.ko}
                            </h2>
                            <p className="text-xl text-slate-300 font-medium leading-relaxed opacity-80">
                                {society.name.en} <br />
                                <span className="text-sm">학술적 가치를 공유하고 혁신적인 연구 네트워크를 구축합니다.</span>
                            </p>
                            <div className="flex gap-4 pt-4">
                                {society.homepageUrl && (
                                    <a href={society.homepageUrl} target="_blank" rel="noreferrer" className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-slate-50 transition transform hover:-translate-y-1 shadow-2xl">
                                        Society Website <ArrowRight size={18} />
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 3. CONFERENCE SECTIONS */}
            <main className="max-w-7xl mx-auto px-6 py-24 space-y-32">

                {/* A. ACTIVE (NOW OPEN) */}
                {(activeConfs.length > 0 || conferences.length === 0) && (
                    <section>
                        <div className="flex items-center gap-4 mb-12">
                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                                <Target size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Active Conferences</h3>
                                <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mt-1">Registration & Abstract Submission Open</p>
                            </div>
                        </div>

                        {activeConfs.length === 0 ? (
                            <div className="bg-slate-50 border border-slate-100 rounded-[3rem] p-20 text-center animate-in fade-in">
                                <p className="text-xl font-bold text-slate-400 mb-2">현재 진행 중인 행사가 없습니다.</p>
                                <p className="text-slate-300 text-sm font-medium italic">There are no active conferences at this time.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {activeConfs.map(conf => (
                                    <div key={conf.id} className="group relative bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-blue-600/5 transition-all overflow-hidden flex flex-col md:flex-row">
                                        <div className="md:w-2/5 aspect-[4/3] md:aspect-auto bg-slate-900 relative">
                                            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-transparent"></div>
                                            <div className="absolute inset-0 flex items-center justify-center text-white/10 font-black text-6xl uppercase tracking-tighter select-none">{conf.slug}</div>
                                            <div className="absolute top-6 left-6 bg-green-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg">
                                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                                                Live Now
                                            </div>
                                        </div>
                                        <div className="p-10 flex-1 flex flex-col justify-between">
                                            <div>
                                                <h4 className="text-2xl font-black text-slate-900 mb-6 group-hover:text-blue-600 transition-colors leading-tight">{conf.title.ko}</h4>
                                                <div className="space-y-3 text-slate-500">
                                                    <div className="flex items-center gap-3 text-sm font-bold">
                                                        <Calendar size={18} className="text-blue-500" />
                                                        {formatDate(conf.dates?.start)} — {formatDate(conf.dates?.end)}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-sm font-bold">
                                                        <MapPin size={18} className="text-blue-500" />
                                                        {conf.location || 'Online / Venue TBD'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-10 flex gap-3">
                                                <button onClick={() => window.location.href = getConferenceUrl(conf, 'register')} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-blue-700 transition shadow-xl shadow-blue-600/20">Register Now</button>
                                                <button onClick={() => window.location.href = getConferenceUrl(conf)} className="w-14 h-14 bg-slate-100 text-slate-900 flex items-center justify-center rounded-2xl hover:bg-slate-200 transition"><ChevronRight size={20} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* B. UPCOMING (PLANNING) */}
                {upcomingConfs.length > 0 && (
                    <section>
                        <div className="flex items-center gap-4 mb-12">
                            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                                <Calendar size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Upcoming Plans</h3>
                                <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mt-1">Scheduled for the Future</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {upcomingConfs.map(conf => (
                                <div key={conf.id} className="p-8 bg-white border border-slate-100 rounded-[2rem] hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-600/5 transition-all text-center">
                                    <div className="mx-auto w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6 font-black text-xs">SOON</div>
                                    <h4 className="text-xl font-black text-slate-900 mb-4 line-clamp-2 leading-tight">{conf.title.ko}</h4>
                                    <p className="text-sm font-bold text-slate-400 mb-6">{formatDate(conf.dates?.start)}</p>
                                    <button onClick={() => window.location.href = getConferenceUrl(conf)} className="w-full py-3 rounded-xl border border-slate-100 text-slate-400 font-bold text-xs hover:bg-slate-50 transition uppercase tracking-widest">Preview Info</button>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* C. PAST (ARCHIVE) */}
                {pastConfs.length > 0 && (
                    <section>
                        <div className="flex items-center gap-4 mb-12">
                            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500">
                                <Trophy size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Society History</h3>
                                <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mt-1">Successful Past Achievements</p>
                            </div>
                        </div>

                        <div className="bg-slate-50/50 rounded-[3rem] border border-slate-100 p-10 overflow-hidden">
                            <div className="space-y-4">
                                {pastConfs.map(conf => (
                                    <div key={conf.id} className="group bg-white p-6 rounded-3xl border border-slate-100 flex flex-col sm:flex-row justify-between items-center hover:shadow-lg transition-all gap-4">
                                        <div className="flex items-center gap-6">
                                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 font-black text-[10px] uppercase tracking-tighter">{conf.slug}</div>
                                            <div>
                                                <h5 className="text-lg font-black text-slate-700 leading-tight">{conf.title.ko}</h5>
                                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{formatDate(conf.dates?.start)}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => toast("History records available soon")} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-50 transition uppercase tracking-widest">Archive Details</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}
            </main>

            {/* 4. FOOTER */}
            <footer className="bg-white py-16 px-6 border-t border-slate-100 mt-20">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12 text-center md:text-left">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 justify-center md:justify-start grayscale opacity-50">
                            {society.logoUrl && <img src={society.logoUrl} alt="Logo" className="h-6" />}
                            <span className="text-lg font-black text-slate-900 tracking-tighter uppercase">{society.id} PORTAL</span>
                        </div>
                        <p className="max-w-xs text-[10px] font-bold text-slate-300 leading-relaxed uppercase tracking-widest">
                            본 학술 플랫폼은 이레지(eRegi)의 솔루션을 통해 <br /> 운영되고 있습니다. (주)홍커뮤니케이션.
                        </p>
                    </div>

                    <div className="flex flex-col md:items-end gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <p>&copy; 2026 {society.name.en}. All rights reserved.</p>
                        <p className="text-slate-300">Technology Support by Hong Communication</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default SocietyLandingPage;
