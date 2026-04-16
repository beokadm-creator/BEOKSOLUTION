import React from 'react';
import { useConference } from '../hooks/useConference';

const TermsPage: React.FC = () => {
    const { info, loading, isPlatform } = useConference();

    if (loading) return <div className="min-h-screen flex items-center justify-center text-body text-slate-600">Loading...</div>;

    const confTitle = info?.title?.ko || (isPlatform ? 'e-Regi Platform' : 'Conference');

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-12">
            <div className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-10">
                <h1 className="text-heading-1 font-display text-slate-900">Terms of Service</h1>
                <p className="mt-2 text-body-sm text-slate-500">Last Updated: {new Date().toLocaleDateString()}</p>

                <div className="mt-10 space-y-10 text-body text-slate-700">
                    <section className="space-y-2">
                        <h2 className="text-heading-4 font-semibold text-slate-900">1. Introduction</h2>
                        <p>
                            Welcome to <strong>{confTitle}</strong>. By accessing or using our registration and conference services,
                            you agree to be bound by these Terms of Service.
                        </p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-heading-4 font-semibold text-slate-900">2. Registration & Payments</h2>
                        <p>
                            All registrations are subject to approval. Payments are processed securely via our payment partners (Toss Payments).
                            Refund policies are determined by the specific conference administration settings.
                        </p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-heading-4 font-semibold text-slate-900">3. User Obligations</h2>
                        <p>
                            You agree to provide accurate information during registration.
                            You are responsible for maintaining the confidentiality of your account credentials.
                        </p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-heading-4 font-semibold text-slate-900">4. Intellectual Property</h2>
                        <p>
                            All content presented at {confTitle}, including abstracts and presentation materials,
                            remains the property of the respective authors or the conference organization.
                        </p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-heading-4 font-semibold text-slate-900">5. Limitation of Liability</h2>
                        <p>
                            {confTitle} and e-Regi Inc. are not liable for any indirect, incidental, or consequential damages
                            arising from your use of the service.
                        </p>
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

export default TermsPage;
