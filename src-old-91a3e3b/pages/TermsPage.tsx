import React from 'react';
import { useConference } from '../hooks/useConference';

const TermsPage: React.FC = () => {
    const { info, loading, isPlatform } = useConference();

    if (loading) return <div>Loading...</div>;

    const confTitle = info?.title?.ko || (isPlatform ? 'e-Regi Platform' : 'Conference');

    return (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
            <h1 style={{ marginBottom: '20px' }}>Terms of Service</h1>
            <p style={{ color: '#666', marginBottom: '40px' }}>Last Updated: {new Date().toLocaleDateString()}</p>

            <section style={{ marginBottom: '30px' }}>
                <h2>1. Introduction</h2>
                <p>
                    Welcome to <strong>{confTitle}</strong>. By accessing or using our registration and conference services, 
                    you agree to be bound by these Terms of Service.
                </p>
            </section>

            <section style={{ marginBottom: '30px' }}>
                <h2>2. Registration & Payments</h2>
                <p>
                    All registrations are subject to approval. Payments are processed securely via our payment partners (Toss Payments). 
                    Refund policies are determined by the specific conference administration settings.
                </p>
            </section>

            <section style={{ marginBottom: '30px' }}>
                <h2>3. User Obligations</h2>
                <p>
                    You agree to provide accurate information during registration. 
                    You are responsible for maintaining the confidentiality of your account credentials.
                </p>
            </section>

            <section style={{ marginBottom: '30px' }}>
                <h2>4. Intellectual Property</h2>
                <p>
                    All content presented at {confTitle}, including abstracts and presentation materials, 
                    remains the property of the respective authors or the conference organization.
                </p>
            </section>

            <section style={{ marginBottom: '30px' }}>
                <h2>5. Limitation of Liability</h2>
                <p>
                    {confTitle} and e-Regi Inc. are not liable for any indirect, incidental, or consequential damages 
                    arising from your use of the service.
                </p>
            </section>

            <div style={{ marginTop: '50px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                <a href="/" style={{ color: 'blue', textDecoration: 'underline' }}>Back to Home</a>
            </div>
        </div>
    );
};

export default TermsPage;
