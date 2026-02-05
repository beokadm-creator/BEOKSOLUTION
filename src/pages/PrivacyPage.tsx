import React from 'react';
import { useConference } from '../hooks/useConference';
import { LEGAL_CONTENT } from '../data/legal_content';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPage: React.FC = () => {
    const { info, loading, isPlatform } = useConference();
    const navigate = useNavigate();

    const { title, sections, lastUpdated } = LEGAL_CONTENT.privacyPolicy;

    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

    const confTitle = info?.title?.ko || (isPlatform ? 'e-Regi Platform' : 'Conference');

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="bg-slate-900 px-8 py-8 text-white">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 text-sm font-bold uppercase tracking-wider"
                    >
                        <ChevronLeft size={16} /> Back
                    </button>
                    <h1 className="text-3xl font-extrabold tracking-tight mb-2">{title}</h1>
                    <p className="text-slate-400 text-sm font-medium">최종 수정일: {lastUpdated}</p>
                </div>

                <div className="p-8 lg:p-12 space-y-10">
                    <div className="prose prose-slate max-w-none">
                        <p className="text-slate-500 font-medium">
                            <strong>{confTitle}</strong>(이하 "서비스")은 회원의 개인정보를 중요시하며, 개인정보보호법을 준수하고 있습니다.
                        </p>
                    </div>

                    <div className="space-y-8">
                        {sections.map((section, idx) => (
                            <section key={idx} className="scroll-mt-20">
                                <h2 className="text-lg font-bold text-slate-900 mb-3">{section.heading}</h2>
                                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                                    {section.content}
                                </p>
                            </section>
                        ))}
                    </div>

                    <div className="pt-10 border-t border-slate-100 mt-10 flex justify-center">
                        <button
                            onClick={() => navigate('/')}
                            className="text-eregi-600 font-bold hover:underline"
                        >
                            메인으로 돌아가기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPage;
