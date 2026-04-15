import React from 'react';
import { useConference } from '../hooks/useConference';

const TermsPage: React.FC = () => {
    const { info, loading, isPlatform } = useConference();

    if (loading) return <div>Loading...</div>;

    const confTitle = info?.title?.ko || (isPlatform ? 'e-Regi Platform' : 'Conference');

    return (
        <div className="font-body max-w-4xl mx-auto px-6 py-10">
            <h1 className="text-heading-1 text-eregi-primary mb-4">Terms of Service</h1>
            <p className="text-body-sm text-muted-foreground mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

            <section className="mb-8">
                <h2 className="text-heading-3 text-eregi-primary mb-3">1. Introduction</h2>
                <p className="text-body">
                    Welcome to <strong className="font-semibold">{confTitle}</strong>. By accessing or using our registration and conference services,
                    you agree to be bound by these Terms of Service.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-heading-3 text-eregi-primary mb-3">2. Registration & Payments</h2>
                <p className="text-body">
                    All registrations are subject to approval. Payments are processed securely via our payment partners (Toss Payments).
                    Refund policies are determined by the specific conference administration settings.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-heading-3 text-eregi-primary mb-3">3. User Obligations</h2>
                <p className="text-body">
                    You agree to provide accurate information during registration.
                    You are responsible for maintaining the confidentiality of your account credentials.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-heading-3 text-eregi-primary mb-3">4. Intellectual Property</h2>
                <p className="text-body">
                    All content presented at {confTitle}, including abstracts and presentation materials,
                    remains the property of the respective authors or the conference organization.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-heading-3 text-eregi-primary mb-3">5. Limitation of Liability</h2>
                <p className="text-body">
                    {confTitle} and e-Regi Inc. are not liable for any indirect, incidental, or consequential damages
                    arising from your use of the service.
                </p>
            </section>

            <div className="mt-12 pt-6 border-t border-eregi-neutral-100">
                <a href="/" className="text-eregi-secondary hover:text-eregi-primary font-medium underline">Back to Home</a>
            </div>
        </div>
    );
};

export default TermsPage;
