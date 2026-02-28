import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { VendorProfile } from '../../hooks/useVendor';

const VendorIntroPage: React.FC = () => {
    const { slug, vid } = useParams();
    const navigate = useNavigate();
    const [vendor, setVendor] = useState<VendorProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchVendor = async () => {
            if (!vid) return;
            try {
                const vendorRef = doc(db, 'vendors', vid);
                const vendorSnap = await getDoc(vendorRef);
                if (vendorSnap.exists()) {
                    setVendor({ id: vendorSnap.id, ...vendorSnap.data() } as VendorProfile);
                }
            } catch (error) {
                console.error("Error fetching vendor", error);
            } finally {
                setLoading(false);
            }
        };

        fetchVendor();
    }, [vid]);

    if (loading) return <div className="flex h-screen items-center justify-center p-10 text-gray-500">정보를 불러오는 중입니다...</div>;

    if (!vendor) return (
        <div className="flex flex-col h-screen items-center justify-center p-10 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">파트너사를 찾을 수 없습니다.</h2>
            <button onClick={() => navigate(-1)} className="text-indigo-600 underline">뒤로 가기</button>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 py-10 font-sans">
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden text-center relative">

                {/* Header Decoration */}
                <div className="h-32 bg-gradient-to-br from-indigo-500 to-purple-600 w-full relative">
                    {/* Logo Overlay */}
                    <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 w-24 h-24 bg-white rounded-2xl shadow-lg border-4 border-white flex items-center justify-center overflow-hidden">
                        {vendor.logoUrl ? (
                            <img src={vendor.logoUrl} alt={vendor.name} className="w-full h-full object-contain" />
                        ) : (
                            <span className="text-3xl font-bold text-gray-300">{vendor.name.charAt(0)}</span>
                        )}
                    </div>
                </div>

                <div className="pt-16 pb-8 px-6">
                    <h1 className="text-2xl font-black text-gray-900 mb-2">{vendor.name}</h1>
                    <div className="w-12 h-1 bg-indigo-500 mx-auto rounded-full mb-6"></div>

                    {vendor.description ? (
                        <p className="text-gray-600 leading-relaxed mb-8 whitespace-pre-wrap text-sm text-left bg-gray-50 p-4 rounded-xl border border-gray-100">
                            {vendor.description}
                        </p>
                    ) : (
                        <p className="text-gray-400 italic mb-8">소개글이 없습니다.</p>
                    )}

                    <div className="flex flex-col gap-3">
                        {vendor.homeUrl && (
                            <a
                                href={vendor.homeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-3.5 px-4 bg-gray-900 text-white font-bold rounded-xl shadow-md hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                            >
                                🌐 회사 홈페이지 방문
                            </a>
                        )}
                        {vendor.productUrl && (
                            <a
                                href={vendor.productUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-3.5 px-4 bg-indigo-100 text-indigo-700 font-bold rounded-xl shadow-sm hover:bg-indigo-200 transition-colors flex items-center justify-center gap-2"
                            >
                                📄 제품 소개서 보기
                            </a>
                        )}
                    </div>
                </div>
            </div>

            <button
                onClick={() => navigate(-1)}
                className="mt-8 text-gray-500 font-medium px-6 py-2 rounded-full border border-gray-300 hover:bg-white transition-colors"
            >
                돌아가기
            </button>
        </div>
    );
};

export default VendorIntroPage;
