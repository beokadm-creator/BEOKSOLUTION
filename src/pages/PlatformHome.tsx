import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getRootCookie } from '../utils/cookie';
import { db } from '../firebase';
import { safeFormatDate } from '../utils/dateUtils';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { ArrowRight, CheckCircle2, Calendar, MapPin } from 'lucide-react';

interface ConfSummary {
    id: string;
    title: string;
    societyId: string;
    dates: string;
    location: string;
    status?: string;
    startDate?: number;
}

const PlatformHome: React.FC = () => {
    const navigate = useNavigate();
    const { auth } = useAuth();
    const { user } = auth;
    const [activeConferences, setActiveConferences] = useState<ConfSummary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConferences = async () => {
            try {
                // [Fix-Step 264] L3 Standard Fetch
                // Fetch ALL conferences from root (Limit 50 to ensure KADD is found)
                console.log("[PlatformHome] Fetching ALL conferences...");

                // Note: We avoid complex server-side filtering to prevent index errors on 'status'
                // We fetch everything and filter in memory.
                const q = query(
                    collection(db, 'conferences'),
                    limit(50)
                );

                const snap = await getDocs(q);
                console.log(`[PlatformHome] Found ${snap.size} conferences.`);

                const list: ConfSummary[] = snap.docs.map(doc => {
                    const data = doc.data();
                    const start = safeFormatDate(data.dates?.start);

                    // [Fix-Step 263] Normalize societyId
                    const rawSocId = data.societyId || 'kap';
                    const normalizedSocId = typeof rawSocId === 'string' ? rawSocId.toLowerCase() : 'kap';

                    console.log(` - Conf: ${doc.id} / Society: ${normalizedSocId} / Status: ${data.status}`);

                    return {
                        id: doc.id,
                        title: typeof data.title === 'string' ? data.title : (data.title?.ko || 'Untitled Conference'),
                        societyId: normalizedSocId,
                        dates: start,
                        location: typeof data.venueName === 'string' ? data.venueName : (data.venue?.name?.ko || 'Online'),
                        // Add raw data for filtering
                        status: data.status,
                        startDate: data.dates?.start?.seconds || 0
                    };
                })
                    // Filter ACTIVE or PUBLIC (or just show all for now to verify KADD)
                    // The user said: "filter by status in JS"
                    .filter((c: ConfSummary) => c.status !== 'HIDDEN' && c.status !== 'ARCHIVED')
                    .sort((a: ConfSummary, b: ConfSummary) => (b.startDate || 0) - (a.startDate || 0)); // Newest first

                setActiveConferences(list);
            } catch (e) {
                console.error("Failed to load conferences", e);
            } finally {
                setLoading(false);
            }
        };
        fetchConferences();
    }, []);

    return (
        <div className="min-h-screen font-sans text-slate-900 bg-white">
            {/* Hero Section */}
            <section className="bg-slate-900 text-white pt-32 pb-24 px-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80')] bg-cover bg-center opacity-10"></div>
                <div className="max-w-6xl mx-auto relative z-10 text-center">
                    <span className="inline-block py-1 px-3 rounded-full bg-blue-600/30 border border-blue-500 text-blue-300 text-sm font-bold mb-6">
                        2026 Academic Season Open
                    </span>
                    <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight tracking-tight">
                        학술대회 통합 관리 솔루션 <br />
                        <span className="text-blue-500">e-Regi Platform</span>
                    </h1>
                    <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                        등록부터 명찰 발급, 출결 관리, 이수증 발급까지.<br />
                        학회 운영의 모든 과정을 하나의 플랫폼에서 경험하세요.
                    </p>

                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        {user ? (
                            <button
                                onClick={() => navigate('/mypage')}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-bold text-lg shadow-lg shadow-blue-900/50 transition-all flex items-center justify-center gap-2"
                            >
                                대시보드 바로가기 <ArrowRight className="w-5 h-5" />
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => navigate('/auth')}
                                    className="bg-white text-slate-900 hover:bg-slate-100 px-8 py-4 rounded-lg font-bold text-lg shadow-lg transition-all"
                                >
                                    로그인 / 회원가입
                                </button>
                                <button
                                    onClick={() => window.location.href = 'mailto:contact@eregi.co.kr'}
                                    className="bg-transparent border border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white px-8 py-4 rounded-lg font-bold text-lg transition-all"
                                >
                                    도입 문의
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 bg-white">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold mb-4">Why e-Regi?</h2>
                        <p className="text-slate-500">학회와 참가자 모두를 위한 최적의 기능</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-lg transition-all">
                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">간편한 등록/결제</h3>
                            <p className="text-slate-600 leading-relaxed">
                                복잡한 절차 없이 1분 만에 등록 완료. 국내외 카드 및 간편결제 지원.
                            </p>
                        </div>
                        <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-lg transition-all">
                            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center mb-6">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">QR 디지털 명찰</h3>
                            <p className="text-slate-600 leading-relaxed">
                                종이 명찰 없이 모바일 QR코드로 빠르고 간편하게 입장하세요.
                            </p>
                        </div>
                        <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-lg transition-all">
                            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-6">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">실시간 이수 관리</h3>
                            <p className="text-slate-600 leading-relaxed">
                                내 체류 시간과 평점을 실시간으로 확인하고 이수증을 발급받으세요.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Active Conferences */}
            <section className="py-20 bg-slate-50 border-t border-slate-200">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="flex justify-between items-end mb-10">
                        <div>
                            <h2 className="text-3xl font-bold mb-2">진행 중인 학술대회</h2>
                            <p className="text-slate-500">Active Events</p>
                        </div>
                        {/* <a href="#" className="text-blue-600 font-bold hover:underline">전체 보기 &rarr;</a> */}
                    </div>

                    {loading ? (
                        <div className="text-center py-20 text-slate-400">Loading events...</div>
                    ) : activeConferences.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {activeConferences.map(conf => (
                                <div key={conf.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all group">
                                    <div className="h-3 bg-blue-600 w-full"></div>
                                    <div className="p-6">
                                        <h3 className="font-bold text-lg mb-4 line-clamp-2 h-14 group-hover:text-blue-600 transition-colors">
                                            {conf.title}
                                        </h3>
                                        <div className="space-y-2 text-sm text-slate-500 mb-6">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4" />
                                                {conf.dates}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-4 h-4" />
                                                {conf.location}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const token = getRootCookie('eregi_session');
                                                // [Step 403-D] Append token if logged in
                                                const baseUrl = `https://${conf.societyId}.eregi.co.kr`;
                                                window.location.href = token ? `${baseUrl}?token=${token}` : baseUrl;
                                            }}
                                            className="w-full py-3 rounded-lg border border-slate-200 font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all"
                                        >
                                            바로가기
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                            <p className="text-slate-500">현재 등록 가능한 학술대회가 없습니다.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
                <div className="max-w-6xl mx-auto px-6 text-center md:text-left">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-white mb-2">eRegi</h2>
                        <p className="text-sm">Academic Conference Management Solution</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
                        <div>
                            <h4 className="text-white font-bold mb-4">Company</h4>
                            <p>Hong Communication</p>
                            <p>Seoul, Republic of Korea</p>
                        </div>
                        <div>
                            <h4 className="text-white font-bold mb-4">Contact</h4>
                            <p>support@eregi.co.kr</p>
                            <p>02-1234-5678</p>
                        </div>
                        <div>
                            <h4 className="text-white font-bold mb-4">Legal</h4>
                            <p><a href="/terms" className="hover:text-white">Terms of Service</a></p>
                            <p><a href="/privacy" className="hover:text-white">Privacy Policy</a></p>
                        </div>
                    </div>
                    <div className="mt-12 pt-8 border-t border-slate-800 text-xs text-center">
                        &copy; 2026 Hong Communication. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default PlatformHome;
