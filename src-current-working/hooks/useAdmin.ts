import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, setDoc, collection, getDocs, query, where, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { BadgeElement, Registration } from '../types/schema';

export const useAdmin = () => {
    const { cid } = useParams<{ cid: string }>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const saveBadgeLayout = async (width: number, height: number, elements: BadgeElement[], backgroundImageUrl?: string, enableCutting?: boolean) => {
        if (!cid) return;

        setLoading(true);
        setError(null);
        try {
            // Sanitize elements for Firestore (remove undefined)
            const sanitizedElements = elements.map(el => {
                const clean = { ...el };
                Object.keys(clean).forEach(key => {
                    if ((clean as any)[key] === undefined) delete (clean as any)[key];
                });
                return clean;
            });

            const configRef = doc(db, `conferences/${cid}/settings`, 'badge_config');
            await setDoc(configRef, {
                badgeLayout: {
                    width,
                    height,
                    elements: sanitizedElements,
                    backgroundImageUrl: backgroundImageUrl || null,
                    enableCutting: enableCutting || false
                },
                badgeLayoutEnabled: true,
                updatedAt: Timestamp.now()
            }, { merge: true });

            setLoading(false);
            return true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('[useAdmin] saveBadgeLayout failed:', err);
            setError(errorMessage);
            setLoading(false);
            throw err;
        }
    };

    const processRefund = async (conferenceId: string, regId: string, amount: number) => {
        setLoading(true);
        try {
            const regRef = doc(db, `conferences/${conferenceId}/registrations/${regId}`);
            await updateDoc(regRef, {
                paymentStatus: 'REFUNDED',
                refundAmount: amount,
                updatedAt: Timestamp.now()
            });
            setLoading(false);
            return true;
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
            return false;
        }
    };

    return {
        loading,
        error,
        saveBadgeLayout,
        processRefund
    };
};
