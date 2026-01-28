import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const CheckStatusPage: React.FC = () => {
    const { slug } = useParams();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-3xl">🔍</span>
                </div>
                <h1 className="text-2xl font-black text-slate-900 mb-2">비회원 등록 조회</h1>
                <p className="text-slate-500 mb-8">
                    현재 이 기능은 준비 중입니다.<br/>
                    관리자에게 문의해주세요.
                </p>
                <div className="bg-slate-100 p-4 rounded-xl text-xs font-mono text-slate-400 mb-8 break-all">
                    Slug: {slug}
                </div>
                <button 
                    onClick={() => navigate(-1)}
                    className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all active:scale-95"
                >
                    Go Back
                </button>
            </div>
        </div>
    );
};

export default CheckStatusPage;