import React from 'react';
import { useConference } from '../hooks/useConference';

const PrivacyPage: React.FC = () => {
    const { info, loading, isPlatform } = useConference();

    if (loading) return <div>Loading...</div>;

    const confTitle = info?.title?.ko || (isPlatform ? 'e-Regi Platform' : 'Conference');

    return (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
            <h1 style={{ marginBottom: '20px' }}>Privacy Policy</h1>
            <p style={{ color: '#666', marginBottom: '40px' }}>Last Updated: {new Date().toLocaleDateString()}</p>

            <section style={{ marginBottom: '30px' }}>
                <h2>1. Data Collection</h2>
                <p>
                    <strong>{confTitle}</strong> collects the following personal information for registration and operation purposes:
                </p>
                <ul style={{ listStyle: 'disc', marginLeft: '20px', marginTop: '10px' }}>
                    <li>Name, Email, Phone Number, Affiliation</li>
                    <li>Payment information (processed via PG, not stored directly)</li>
                    <li>Access logs and booth visit history</li>
                </ul>
            </section>

            <section style={{ marginBottom: '30px' }}>
                <h2>2. Purpose of Use</h2>
                <p>
                    Collected data is used for:
                </p>
                <ul style={{ listStyle: 'disc', marginLeft: '20px', marginTop: '10px' }}>
                    <li>Conference registration and badge issuance</li>
                    <li>Communication regarding schedule changes or announcements</li>
                    <li>Providing certificate of attendance</li>
                </ul>
            </section>

            <section style={{ marginBottom: '30px' }}>
                <h2>3. Data Retention</h2>
                <p>
                    Personal data is retained for a period of 1 year after the conference ends, or as required by applicable laws, 
                    after which it is securely deleted.
                </p>
            </section>

            <section style={{ marginBottom: '30px' }}>
                <h2>4. Third-Party Provision</h2>
                <p>
                    We may share limited data with:
                </p>
                <ul style={{ listStyle: 'disc', marginLeft: '20px', marginTop: '10px' }}>
                    <li>Payment Gateways (Toss Payments) for transaction processing</li>
                    <li>Exhibitors/Vendors (Only if you explicitly consent via QR scan)</li>
                </ul>
            </section>

            <section style={{ marginBottom: '30px' }}>
                <h2>5. Contact Us</h2>
                <p>
                    If you have questions about your data, please contact the administration of {confTitle}.
                </p>
            </section>

            <div style={{ marginTop: '50px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                <a href="/" style={{ color: 'blue', textDecoration: 'underline' }}>Back to Home</a>
            </div>
        </div>
    );
};

export default PrivacyPage;
