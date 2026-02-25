import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom'; 
import { db } from '../firebase';
import '../styles/PlatformLanding.css';
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
        <div className="platform-container">
            {/* Header */}
            <header style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 40px', backgroundColor: 'rgba(26, 41, 128, 0.95)', color: 'white', position: 'fixed', width: '100%', zIndex: 100 }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>e-Regi Platform</div>
                <nav>
                    <a href="/admin/super" style={{ color: 'white', textDecoration: 'none', marginLeft: '20px', fontWeight: 500 }}>Super Admin</a>
                </nav>
            </header>

            {/* Hero Section */}
            <section className="hero-section">
                <div style={{ maxWidth: 800, margin: '0 auto', paddingTop: 60 }}>
                    <h1 className="hero-title">The All-in-One Smart Conference Solution</h1>
                    <p className="hero-subtext">
                        From Registration to On-site Operations.<br/>
                        Experience the seamless flow with e-Regi.
                    </p>
                    <button className="cta-button" onClick={() => toast("Contact sales@eregi.co.kr", { icon: '📧' })}>
                        Request a Demo
                    </button>
                </div>
            </section>

            {/* Societies Grid */}
            <section className="grid-section">
                <h2 className="section-title">Participating Societies</h2>
                {loading ? <p style={{textAlign:'center'}}>Loading...</p> : (
                    <div className="card-grid">
                        {societies.length === 0 && <p style={{textAlign:'center', gridColumn: '1/-1'}}>No societies found.</p>}
                        {societies.map(soc => (
                            <a 
                                key={soc.id} 
                                href={`https://${soc.id}.eregi.co.kr`} // ABSOLUTE URL FORCE SWITCH
                                className="conf-card"
                                style={{ textDecoration: 'none', color: 'inherit' }}
                            >
                                <div className="card-image">
                                    {soc.id.toUpperCase()}
                                </div>
                                <div className="card-content">
                                    <h3 className="card-title">{soc.name.ko}</h3>
                                    <p className="card-meta">{soc.name.en}</p>
                                    <span className="status-badge status-open">Visit Society</span>
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </section>

            {/* Partners */}
            <section className="partner-section">
                <h2 className="section-title" style={{ fontSize: '2rem', marginBottom: 40 }}>Trusted by Industry Leaders</h2>
                <div className="partner-logos">
                    {partners.map((partner, idx) => (
                        <div key={idx} title={partner.name}>
                            <img src={partner.logo} alt={partner.name} style={{ height: 40, filter: 'grayscale(100%)', transition: 'filter 0.3s' }} 
                                 onMouseOver={e => (e.currentTarget.style.filter = 'none')}
                                 onMouseOut={e => (e.currentTarget.style.filter = 'grayscale(100%)')}
                            />
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="footer">
                <div style={{ marginBottom: 20 }}>
                    <a href="/terms" className="footer-link">Service Terms</a>
                    <a href="/privacy" className="footer-link">Privacy Policy</a>
                    <a href="/admin" className="footer-link">Admin Login</a>
                </div>
                <p>&copy; 2026 e-Regi Inc. All rights reserved.</p>
                <p>Contact: support@eregi.co.kr | Seoul, Korea</p>
            </footer>
        </div>
    );
};

export default PlatformLanding;
