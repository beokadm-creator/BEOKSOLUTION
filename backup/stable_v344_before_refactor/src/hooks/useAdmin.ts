import { useState } from 'react';
import { doc, updateDoc, collection, getDocs, query, where, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { BadgeElement, Registration } from '../types/schema';

// Mock Toss Cancel
const mockCancelPayment = async (amount: number, paymentKey: string): Promise<boolean> => {
    console.log(`[TossPayment] Cancelling ${amount} for ${paymentKey}`);
    return new Promise(resolve => setTimeout(() => resolve(true), 1000));
};

export const useAdmin = (conferenceId: string) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 1. Save Badge Layout
    const saveBadgeLayout = async (width: number, height: number, elements: BadgeElement[]) => {
        setLoading(true);
        try {
            const infoRef = doc(db, `conferences/${conferenceId}/info/general`);
            await updateDoc(infoRef, {
                'badgeLayout.width': width,
                'badgeLayout.height': height,
                'badgeLayout.elements': elements
            });
            setLoading(false);
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    // 2. Fetch Refund Requests
    const fetchRefundRequests = async (): Promise<Registration[]> => {
        const regRef = collection(db, `conferences/${conferenceId}/registrations`);
        const q = query(regRef, where('paymentStatus', '==', 'REFUND_REQUESTED'));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as Registration);
    };

    // 3. Process Refund
    const processRefund = async (regId: string, amount: number) => {
        setLoading(true);
        try {
            // Get current reg to check payment details (mocking paymentKey retrieval)
            const regRef = doc(db, `conferences/${conferenceId}/registrations/${regId}`);
            
            // Call API
            await mockCancelPayment(amount, 'mock_payment_key');

            // Update DB
            await updateDoc(regRef, {
                paymentStatus: amount > 0 ? 'PARTIAL_REFUNDED' : 'REFUNDED', // Simplification
                refundAmount: amount,
                updatedAt: Timestamp.now()
            });

            setLoading(false);
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    return {
        loading,
        error,
        saveBadgeLayout,
        fetchRefundRequests,
        processRefund
    };
};
