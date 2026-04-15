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
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchSocieties();
    }, []);

    const partners = [
        { name: 'Samsung', logo: 'https://via.placeholder.com/150x50?text=Samsung' },
        { name: 'LG', logo: 'https://via.placeholder.com/150x50?text=LG' },
        { name: 'Google', logo: 'https://via.placeholder.com/150x50?text=Google' },
        { name: 'Microsoft', logo: 'https://via.placeholder.com/150x50?text=Microsoft' },
        { name: 'Kakao', logo: 'https://via.placeholder.com/150x50?text=Kakao' },
    ];

    return (
        <div className="min-h-screen font-body text-foreground">
            <header className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between bg-eregi-primary/95 px-10 py-5 text-eregi-primary-foreground">
                <div className="text-heading-4 font-semibold">e-Regi Platform</div>
                <nav className="flex items-center gap-5">
                    <a href="/admin/super" className="text-body-sm font-medium text-eregi-primary-foreground hover:opacity-90">
                        Super Admin
                    </a>
                </nav>
            </header>

            <section className="bg-eregi-primary px-6 py-[clamp(4rem,8vh,8rem)] text-center text-eregi-primary-foreground">
                <div className="mx-auto max-w-[800px] pt-[60px]">
                    <h1 className="text-display-lg font-display font-semibold leading-[1.15] tracking-[-0.015em]">
                        The All-in-One Smart Conference Solution
                    </h1>
                    <p className="mx-auto mt-6 max-w-[42rem] text-body-xl font-body leading-relaxed opacity-90">
                        From Registration to On-site Operations.
                        <br />
                        Experience the seamless flow with e-Regi.
                    </p>
                    <button
                        className="mt-10 rounded-[1.5rem] bg-eregi-primary-foreground px-10 py-4 text-body-xl font-semibold text-eregi-primary btn-academic hover:bg-eregi-neutral-50 hover:shadow-[0_4px_12px_hsl(var(--eregi-primary)_/_0.2)]"
                        onClick={() => toast("Contact sales@eregi.co.kr", { icon: '📧' })}
                        type="button"
                    >
                        Request a Demo
                    </button>
                </div>
            </section>

            <section className="mx-auto max-w-[75rem] px-6 py-[clamp(3rem,6vh,5rem)]">
                <h2 className="text-center text-heading-1 font-display font-semibold text-eregi-primary">
                    Participating Societies
                </h2>
                {loading ? (
                    <p className="mt-12 text-center text-body">Loading...</p>
                ) : (
                    <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(20rem,1fr))] gap-8">
                        {societies.length === 0 && (
                            <p className="col-span-full text-center text-body">No societies found.</p>
                        )}
                        {societies.map((soc) => (
                            <a
                                key={soc.id}
                                href={`https://${soc.id}.eregi.co.kr`}
                                className="group overflow-hidden rounded-[1.5rem] border border-eregi-neutral-100 bg-card text-foreground shadow-[0_2px_8px_hsl(var(--eregi-neutral-200)_/_0.1)] card-academic hover:border-eregi-neutral-200 hover:shadow-[0_8px_24px_hsl(var(--eregi-neutral-200)_/_0.15)]"
                            >
                                <div className="flex h-44 items-center justify-center bg-eregi-neutral-50 text-body font-medium text-muted-foreground">
                                    {soc.id.toUpperCase()}
                                </div>
                                <div className="p-6">
                                    <h3 className="text-heading-4 font-display font-semibold text-eregi-primary">
                                        {soc.name.ko}
                                    </h3>
                                    <p className="mt-3 text-body-sm text-muted-foreground">{soc.name.en}</p>
                                    <span className="mt-4 inline-block rounded-[1.5rem] border border-eregi-success/20 bg-eregi-success/10 px-3.5 py-1.5 text-body-xs font-semibold tracking-[0.01em] text-eregi-success">
                                        Visit Society
                                    </span>
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </section>

            <section className="bg-eregi-neutral-50 px-6 py-[clamp(3rem,6vh,5rem)] text-center">
                <h2 className="text-center text-heading-2 font-display font-semibold text-eregi-primary">
                    Trusted by Industry Leaders
                </h2>
                <div className="mt-10 flex flex-wrap justify-center gap-12 opacity-60">
                    {partners.map((partner, idx) => (
                        <div key={idx} title={partner.name}>
                            <img
                                src={partner.logo}
                                alt={partner.name}
                                className="h-10 grayscale transition hover:grayscale-0"
                            />
                        </div>
                    ))}
                </div>
            </section>

            <footer className="bg-eregi-primary px-6 py-12 text-center text-body-sm text-eregi-primary-foreground/70">
                <div className="mb-5">
                    <a href="/terms" className="mx-3 text-eregi-primary-foreground/70 no-underline transition hover:text-eregi-primary-foreground">
                        Service Terms
                    </a>
                    <a href="/privacy" className="mx-3 text-eregi-primary-foreground/70 no-underline transition hover:text-eregi-primary-foreground">
                        Privacy Policy
                    </a>
                    <a href="/admin" className="mx-3 text-eregi-primary-foreground/70 no-underline transition hover:text-eregi-primary-foreground">
                        Admin Login
                    </a>
                </div>
                <p>&copy; 2026 e-Regi Inc. All rights reserved.</p>
                <p>Contact: support@eregi.co.kr | Seoul, Korea</p>
            </footer>
        </div>
    );
};

export default PlatformLanding;
