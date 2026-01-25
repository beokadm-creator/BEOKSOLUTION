import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';

const RegistrationDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            const ref = doc(db, 'registrations', id);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                setData(snap.data());
            }
        };
        fetchData();
    }, [id]);

    if (!data) return <div className="p-8">Loading...</div>;

    return (
        <div className="p-8 max-w-4xl mx-auto bg-white min-h-screen">
            <div className="flex items-center mb-6">
                <Button variant="ghost" onClick={() => navigate(-1)} className="mr-4">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <h1 className="text-2xl font-bold">등록 상세 (Registration Detail)</h1>
                <Button variant="outline" className="ml-auto" onClick={() => window.print()}>
                    <Printer className="w-4 h-4 mr-2" /> Print
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-8 border p-6 rounded-lg">
                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">주문번호 (Order ID)</h3>
                    <p className="font-mono text-lg">{data.id}</p>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">등록상태 (Status)</h3>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-bold">{data.status}</span>
                </div>

                <div className="col-span-2 border-t my-2"></div>

                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">이름 (Name)</h3>
                    <p className="text-lg">{data.userName}</p>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">소속 (Affiliation)</h3>
                    <p className="text-lg">{data.affiliation || '-'}</p>
                </div>

                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">이메일 (Email)</h3>
                    <p className="text-lg">{data.userEmail}</p>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">전화번호 (Phone)</h3>
                    <p className="text-lg">{data.userPhone}</p>
                </div>

                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">면허번호 (License)</h3>
                    <p className="text-lg">{data.licenseNumber || '-'}</p>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">등록등급 (Grade)</h3>
                    <p className="text-lg">{data.grade}</p>
                </div>
                
                <div className="col-span-2 border-t my-2"></div>

                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">결제금액 (Amount)</h3>
                    <p className="text-xl font-bold text-blue-600">{Number(data.amount).toLocaleString()}원</p>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-500 mb-1">결제일시 (Paid At)</h3>
                    <p className="text-lg">{data.paidAt?.toDate().toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
};

export default RegistrationDetailPage;
