import React from 'react';
import { useConference } from '../hooks/useConference';

const PrivacyPage: React.FC = () => {
    const { info, loading, isPlatform } = useConference();

    if (loading) return <div className="min-h-screen flex items-center justify-center text-body text-slate-600">Loading...</div>;

    const confTitle = info?.title?.ko || (isPlatform ? 'e-Regi Platform' : 'Conference');

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-12">
            <div className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-10">
                <h1 className="text-heading-1 font-display text-slate-900">Privacy Policy</h1>
                <p className="mt-2 text-body-sm text-slate-500">Last Updated: {new Date().toLocaleDateString()}</p>

                <div className="mt-10 space-y-10 text-body text-slate-700">
                    <section className="space-y-3">
                        <h2 className="text-heading-4 font-semibold text-slate-900">1. Data Collection</h2>
                        <p>
                            <strong>{confTitle}</strong> collects the following personal information for registration and operation purposes:
                        </p>
                        <ul className="list-disc space-y-1 pl-5">
                            <li>Name, Email, Phone Number, Affiliation</li>
                            <li>Payment information (processed via PG, not stored directly)</li>
                            <li>Access logs and booth visit history</li>
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-heading-4 font-semibold text-slate-900">2. Purpose of Use</h2>
                        <p>Collected data is used for:</p>
                        <ul className="list-disc space-y-1 pl-5">
                            <li>Conference registration and badge issuance</li>
                            <li>Communication regarding schedule changes or announcements</li>
                            <li>Providing certificate of attendance</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-heading-4 font-semibold text-slate-900">3. Data Retention</h2>
                        <p>
                            Personal data is retained for a period of 1 year after the conference ends, or as required by applicable laws,
                            after which it is securely deleted.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-heading-4 font-semibold text-slate-900">4. Third-Party Provision</h2>
                        <p>We may share limited data with:</p>
                        <ul className="list-disc space-y-1 pl-5">
                            <li>Payment Gateways (Toss Payments) for transaction processing</li>
                            <li>Exhibitors/Vendors (Only if you explicitly consent via QR scan)</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-heading-4 font-semibold text-slate-900">5. Contact Us</h2>
                        <p>If you have questions about your data, please contact the administration of {confTitle}.</p>
                    </section>
                </div>

                <div className="mt-12 border-t border-slate-100 pt-6">
                    <a href="/" className="text-body-sm font-medium text-blue-700 underline underline-offset-4 hover:text-blue-800">
                        Back to Home
                    </a>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPage;
