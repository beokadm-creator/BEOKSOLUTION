import { useState } from 'react';
import { doc, updateDoc, collection, getDocs, query, where, Timestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { BadgeElement, Registration } from '../types/schema';
import { clearConferenceCache } from './useConference';

// Mock Toss Cancel
const mockCancelPayment = async (amount: number, paymentKey: string): Promise<boolean> => {
    console.log(`[TossPayment] Cancelling ${amount} for ${paymentKey}`);
    return new Promise(resolve => setTimeout(() => resolve(true), 1000));
};

export const useAdmin = (conferenceId: string) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 1. Save Badge Layout
    const saveBadgeLayout = async (width: number, height: number, elements: BadgeElement[], backgroundImageUrl?: string, extraSettings?: any) => {
        setLoading(true);
        try {
            // [Fix] Firestore는 undefined 값을 허용하지 않으므로 저장 전 제거
            const sanitizeElements = (els: BadgeElement[]) =>
                els.map(el => {
                    const clean: Record<string, unknown> = {};
                    for (const [k, v] of Object.entries(el)) {
                        if (v !== undefined) clean[k] = v;
                    }
                    return clean;
                });

            const cleanElements = sanitizeElements(elements);
            const badgeLayoutData = {
                width,
                height,
                elements: cleanElements,
                backgroundImageUrl: backgroundImageUrl ?? null,
                ...extraSettings // printXOffset 등이 여기에 포함됨
            };

            // 1. Legacy Location: info/general
            const infoRef = doc(db, `conferences/${conferenceId}/info/general`);
            await setDoc(infoRef, {
                badgeLayout: badgeLayoutData
            }, { merge: true });

            // 2. New Location: settings/badge_config
            const settingsRef = doc(db, `conferences/${conferenceId}/settings/badge_config`);
            await setDoc(settingsRef, {
                badgeLayout: {
                    ...badgeLayoutData,
                    enableCutting: true
                },
                badgeLayoutEnabled: true,
                updatedAt: Timestamp.now()
            }, { merge: true });

            // [Fix] Invalidate Cache to reflect changes immediately
            clearConferenceCache();

            setLoading(false);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            setError(errorMessage);
            setLoading(false);
            throw err; // Re-throw to allow component to handle success/failure
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
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message);
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
