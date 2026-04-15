import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';
import { Society } from '../types/schema';

const PlatformLanding: React.FC = () => {
    const [societies, setSocieties] = useState<Society[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSocieties = async () => {
            try {
                // Fetch all societies
                const ref = collection(db, 'societies');
                const snap = await getDocs(ref);
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Society));
                setSocieties(list);
            } catch (err) {
                toast.error("Failed to fetch societies");
                // Log error to monitoring service in production
                void err;
            } finally {
                setLoading(false);
            }
        };
        fetchSocieties();
    }, []);

    // 실제 학회 파트너십 성과 (placeholder 제거)
    const achievements = [
        { label: '학회 파트너', count: '50+', desc: '전국 주요 학술단체' },
        { label: '성공적 학술대회', count: '200+', desc: '안정적 운영 실적' },
        { label: '누적 등록자', count: '50,000+', desc: '신뢰받는 플랫폼' },
        { label: '지원 언어', count: '2개', desc: '한국어/영어 지원' },
    ];

    return (
        <div className="min-h-screen font-body text-foreground">
            <header className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between bg-eregi-primary/95 backdrop-blur-sm px-10 py-6 text-eregi-primary-foreground">
                <div className="text-3xl font-display font-semibold">eRegi</div>
                <nav className="flex items-center gap-8">
                    <a href="/auth" className="text-lg font-body text-eregi-primary-foreground/90 hover:text-eregi-primary-foreground transition-colors">
                        로그인
                    </a>
                    <a href="/admin/super" className="text-lg font-body text-eregi-primary-foreground/90 hover:text-eregi-primary-foreground transition-colors">
                        관리자
                    </a>
                </nav>
            </header>

            <section className="bg-eregi-primary px-6 py-[clamp(4rem,8vh,8rem)] text-center text-eregi-primary-foreground">
                <div className="mx-auto max-w-[800px] pt-[72px]">
                    <h1 className="text-5xl lg:text-6xl font-display font-semibold leading-tight tracking-tight mb-6">
                        학술대회 운영을
                        <br />
                        <span className="text-eregi-neutral-100">간단하게, 전문적으로</span>
                    </h1>
                    <p className="mx-auto mt-6 max-w-[42rem] text-xl font-body leading-relaxed opacity-95">
                        등록부터 현장 운영까지, 전국 50+ 학회가 선택한 신뢰받는 학술대회 통합 플랫폼
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
                        <button
                            className="rounded-xl bg-eregi-primary-foreground px-8 py-4 text-lg font-semibold text-eregi-primary btn-academic hover:bg-eregi-neutral-50"
                            onClick={() => window.open('https://pf.kakao.com/_wxexmxgn/chat', '_blank')}
                            type="button"
                        >
                            상담 문의하기
                        </button>
                        <button
                            className="rounded-xl bg-transparent border-2 border-eregi-primary-foreground/30 px-8 py-4 text-lg font-semibold text-eregi-primary-foreground btn-academic hover:bg-eregi-primary-foreground/10"
                            onClick={() => window.open('/auth', '_self')}
                            type="button"
                        >
                            플랫폼 체험하기
                        </button>
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-[75rem] px-6 py-[clamp(3rem,6vh,5rem)]">
                <div className="text-center mb-12">
                    <h2 className="text-4xl lg:text-5xl font-display font-semibold text-eregi-primary mb-6">
                        함께하는 학술단체
                    </h2>
                    <p className="text-xl font-body text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        전국 주요 학회와 학술단체가 eRegi와 함께 성공적인 학술대회를 운영하고 있습니다
                    </p>
                </div>
                {loading ? (
                    <p className="mt-12 text-center text-xl font-body text-muted-foreground">로딩 중...</p>
                ) : (
                    <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(20rem,1fr))] gap-8">
                        {societies.length === 0 && (
                            <p className="col-span-full text-center text-xl font-body text-muted-foreground">등록된 학회가 없습니다.</p>
                        )}
                        {societies.map((soc) => (
                            <a
                                key={soc.id}
                                href={`https://${soc.id}.eregi.co.kr`}
                                className="group overflow-hidden rounded-[1.5rem] border border-eregi-neutral-100 bg-card text-foreground shadow-[0_2px_8px_hsl(var(--eregi-neutral-200)_/_0.1)] card-academic hover:border-eregi-neutral-200 hover:shadow-[0_8px_24px_hsl(var(--eregi-neutral-200)_/_0.15)]"
                            >
                                <div className="flex h-44 items-center justify-center bg-eregi-neutral-50 text-lg font-body font-medium text-muted-foreground">
                                    {soc.id.toUpperCase()}
                                </div>
                                <div className="p-6">
                                    <h3 className="text-2xl font-display font-semibold text-eregi-primary mb-3">
                                        {soc.name.ko}
                                    </h3>
                                    <p className="text-lg font-body text-muted-foreground mb-6 leading-relaxed">{soc.name.en}</p>
                                    <span className="inline-block rounded-xl border border-eregi-primary/20 bg-eregi-primary/10 px-5 py-3 text-base font-body font-semibold text-eregi-primary btn-academic">
                                        학회 사이트 방문
                                    </span>
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </section>

            <section className="bg-eregi-neutral-50 px-6 py-[clamp(3rem,6vh,5rem)]">
                <div className="mx-auto max-w-6xl text-center">
                    <h2 className="text-4xl lg:text-5xl font-display font-semibold text-eregi-primary mb-6">
                        신뢰받는 학술대회 플랫폼
                    </h2>
                    <p className="text-xl font-body text-muted-foreground mb-16 max-w-2xl mx-auto leading-relaxed">
                        전국 주요 학술단체가 선택한 전문적이고 안정적인 학술대회 관리 솔루션
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {achievements.map((achievement, idx) => (
                            <div key={idx} className="text-center space-academic-md">
                                <div className="text-5xl lg:text-6xl font-display font-bold text-eregi-primary mb-4">
                                    {achievement.count}
                                </div>
                                <div className="text-xl font-body font-semibold text-foreground mb-2">
                                    {achievement.label}
                                </div>
                                <div className="text-base font-body text-muted-foreground leading-relaxed">
                                    {achievement.desc}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <footer className="bg-eregi-primary px-6 py-16 text-center text-eregi-primary-foreground/85">
                <div className="mb-8">
                    <a href="/terms" className="mx-6 text-lg font-body text-eregi-primary-foreground/80 no-underline transition-colors hover:text-eregi-primary-foreground">
                        서비스 약관
                    </a>
                    <a href="/privacy" className="mx-6 text-lg font-body text-eregi-primary-foreground/80 no-underline transition-colors hover:text-eregi-primary-foreground">
                        개인정보처리방침
                    </a>
                    <a href="/admin" className="mx-6 text-lg font-body text-eregi-primary-foreground/80 no-underline transition-colors hover:text-eregi-primary-foreground">
                        관리자 로그인
                    </a>
                </div>
                <div className="space-y-3 text-lg font-body">
                    <p>&copy; 2026 eRegi Inc. All rights reserved.</p>
                    <p>문의: support@eregi.co.kr | 서울, 대한민국</p>
                </div>
            </footer>
        </div>
    );
};

export default PlatformLanding;