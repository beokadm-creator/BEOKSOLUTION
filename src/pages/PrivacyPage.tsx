import React from 'react';
import { useConference } from '../hooks/useConference';

const PrivacyPage: React.FC = () => {
    const { info, loading, isPlatform } = useConference();

    if (loading) return <div>Loading...</div>;

    const confTitle = info?.title?.ko || (isPlatform ? 'e-Regi Platform' : 'Conference');

    return (
        <div className="font-body max-w-4xl mx-auto px-6 py-10">
            <h1 className="text-heading-1 text-eregi-primary mb-4">Privacy Policy</h1>
            <p className="text-body-sm text-muted-foreground mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

            <section className="mb-8">
                <h2 className="text-heading-3 text-eregi-primary mb-3">1. Data Collection</h2>
                <p className="text-body mb-4">
                    <strong className="font-semibold">{confTitle}</strong> collects the following personal information for registration and operation purposes:
                </p>
                <ul className="list-disc ml-6 space-y-2 text-body">
                    <li>Name, Email, Phone Number, Affiliation</li>
                    <li>Payment information (processed via PG, not stored directly)</li>
                    <li>Access logs and booth visit history</li>
                </ul>
            </section>

            <section className="mb-8">
                <h2 className="text-heading-3 text-eregi-primary mb-3">2. Purpose of Use</h2>
                <p className="text-body mb-4">
                    Collected data is used for:
                </p>
                <ul className="list-disc ml-6 space-y-2 text-body">
                    <li>Conference registration and badge issuance</li>
                    <li>Communication regarding schedule changes or announcements</li>
                    <li>Providing certificate of attendance</li>
                </ul>
            </section>

            <section className="mb-8">
                <h2 className="text-heading-3 text-eregi-primary mb-3">3. Data Retention</h2>
                <p className="text-body">
                    Personal data is retained for a period of 1 year after the conference ends, or as required by applicable laws,
                    after which it is securely deleted.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-heading-3 text-eregi-primary mb-3">4. Third-Party Provision</h2>
                <p className="text-body mb-4">
                    We may share limited data with:
                </p>
                <ul className="list-disc ml-6 space-y-2 text-body">
                    <li>Payment Gateways (Toss Payments) for transaction processing</li>
                    <li>Exhibitors/Vendors (Only if you explicitly consent via QR scan)</li>
                </ul>
            </section>

            <section className="mb-8">
                <h2 className="text-heading-3 text-eregi-primary mb-3">5. Contact Us</h2>
                <p className="text-body">
                    If you have questions about your data, please contact the administration of {confTitle}.
                </p>
            </section>

            <div className="mt-12 pt-6 border-t border-eregi-neutral-100">
                <a href="/" className="text-eregi-secondary hover:text-eregi-primary font-medium underline">Back to Home</a>
            </div>
        </div>
    );
};

export default PrivacyPage;
