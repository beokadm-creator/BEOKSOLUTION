import React from 'react';
import { useConference } from '../../hooks/useConference';
import { PaymentIntegrationCenter } from '../../components/shared/PaymentIntegrationCenter';

const AdminRefundPage: React.FC = () => {
    const { id: confId } = useConference();

    if (!confId) return <div>Loading Conference Data...</div>;

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-900">환불 요청 관리</h1>
            <PaymentIntegrationCenter conferenceId={confId} />
        </div>
    );
};

export default AdminRefundPage;
