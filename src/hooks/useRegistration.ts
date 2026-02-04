import { useState, useEffect } from 'react';
import { doc, runTransaction, Timestamp, collection, getDoc, setDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db, auth as firebaseAuth } from '../firebase';
import { Registration, RegistrationPeriod, ConferenceUser, RegistrationSettings } from '../types/schema';
import { generateReceiptNumber, generateConfirmationQr } from '../utils/transaction';
import toast from 'react-hot-toast';

interface RegistrationState {
    loading: boolean;
    error: string | null;
    success: boolean;
    regId: string | null;
}

// Mock Toss Payment
const mockRequestPayment = async (amount: number, orderId: string): Promise<boolean> => {
    console.log(`[TossPayment] Requesting ${amount} for ${orderId}`);
    return new Promise(resolve => setTimeout(() => resolve(true), 1500));
};

export const useRegistration = (conferenceId: string, user: ConferenceUser | null) => {
    const [status, setStatus] = useState<RegistrationState>({
        loading: false,
        error: null,
        success: false,
        regId: null
    });

    const [availablePeriods, setAvailablePeriods] = useState<RegistrationPeriod[]>([]);

    useEffect(() => {
        const fetchPeriods = async () => {
            if (!conferenceId) return;
            try {
                const ref = doc(db, `conferences/${conferenceId}/settings/registration`);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data() as RegistrationSettings;
                    // Filter active periods
                    const now = Timestamp.now();
                    const active = data.periods.filter(p =>
                        p.startDate <= now && p.endDate >= now
                    );
                    setAvailablePeriods(active);
                }
            } catch (e) {
                console.error("Failed to fetch periods", e);
            }
        };
        fetchPeriods();
    }, [conferenceId]);

    // [Fix-Step 368] Resume Registration
    const resumeRegistration = async (userId: string): Promise<Record<string, unknown> | null> => {
        if (!conferenceId || !userId) return null;

        try {
            const q = query(
                collection(db, `conferences/${conferenceId}/registrations`),
                where('userId', '==', userId),
                where('status', '==', 'PENDING')
            );
            const snap = await getDocs(q);

            if (!snap.empty) {
                // Get most recent
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                docs.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
                    const aTime = (a.updatedAt as { seconds: number })?.seconds || 0;
                    const bTime = (b.updatedAt as { seconds: number })?.seconds || 0;
                    return bTime - aTime;
                });

                const pending = docs[0];
                toast("작성 중인 신청서를 불러왔습니다.");
                return pending;
            }
        } catch (e) {
            console.error("Resume Error:", e);
        }
        return null;
    };

    const removeUndefined = (obj: Record<string, unknown>): Record<string, unknown> | null => {
        if (obj === null || obj === undefined) {
            return null;
        }
        if (typeof obj !== 'object') {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(removeUndefined) as unknown as Record<string, unknown>;
        }
        const result: Record<string, unknown> = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = removeUndefined(obj[key] as Record<string, unknown>);
                if (value !== undefined) {
                    result[key] = value;
                }
            }
        }
        return result;
    };

    const autoSave = async (step: number, formData: Record<string, unknown>, regId?: string | null) => {
        const currentUser = firebaseAuth.currentUser;
        if (!user || !conferenceId || !currentUser) return null;

        try {
            // Determine Doc Ref
            let ref;
            if (regId) {
                ref = doc(db, `conferences/${conferenceId}/registrations`, regId);
            } else {
                // Create or Find Draft by User
                // For anonymous/guest users, allow auto-save by creating a new document
                // Firestore rules now allow writing with userId = currentUser.uid for guests
                ref = doc(collection(db, `conferences/${conferenceId}/registrations`));
            }

            const cleanedFormData = removeUndefined(formData);

            const dataToSave = {
                userId: currentUser.uid, // All users are authenticated (email/password)
                conferenceId,
                status: 'PENDING',
                currentStep: step,
                formData: cleanedFormData,
                lastUpdated: serverTimestamp(),
                // Basic info if creating
                ...(regId ? {} : { createdAt: serverTimestamp() })
            };

            await setDoc(ref, dataToSave, { merge: true });

            if (cleanedFormData.name) {
                await setDoc(doc(db, 'users', currentUser.uid), {
                    name: cleanedFormData.name,
                    email: cleanedFormData.email,
                    userName: cleanedFormData.name,
                    phoneNumber: cleanedFormData.phone,
                    affiliation: cleanedFormData.affiliation,
                    licenseNumber: cleanedFormData.licenseNumber,
                    simplePassword: cleanedFormData.simplePassword,
                    lastUpdated: serverTimestamp()
                }, { merge: true });
            }

            return ref.id;

        } catch (e) {
            console.error("Auto-Save Error:", e);
            return null;
        }
    };

    const calculatePrice = (period: RegistrationPeriod): number => {
        if (!user) return 0;
        // Logic: Check user tier and find price
        // If price not defined for tier, fallback to NON_MEMBER or default
        const price = period.prices[user.tier] ?? period.prices['NON_MEMBER'] ?? 0;
        return price;
    };

    const register = async (period: RegistrationPeriod): Promise<boolean> => {
        if (!user) {
            setStatus({ ...status, error: "User not logged in" });
            return false;
        }

        const amount = calculatePrice(period);
        const paymentMethod = 'CARD'; // Hardcoded for now, could be passed

        setStatus({ loading: true, error: null, success: false, regId: null });

        try {
            // 1. Process Payment (if not free/admin)
            if (amount > 0 && paymentMethod === 'CARD') {
                const orderId = `ORDER-${user.id}-${Date.now()}`;
                const paymentSuccess = await mockRequestPayment(amount, orderId);
                if (!paymentSuccess) throw new Error("Payment Failed");
            }

            // 2. Create Registration (Atomic Transaction)
            const newRegId = await runTransaction(db, async (transaction) => {
                // Generate ID
                const regRef = doc(collection(db, `conferences/${conferenceId}/registrations`));
                const regId = regRef.id;

                // Generate Receipt Number (Atomic Increment)
                const receiptNumber = await generateReceiptNumber(conferenceId, transaction);

                // Generate Confirmation QR (Phase 1)
                const confirmationQr = generateConfirmationQr(regId, user.id);

                const newRegistration: Registration = {
                    id: regId,
                    userId: user.id,
                    conferenceId,
                    paymentStatus: 'PAID',
                    paymentMethod,
                    amount,
                    refundAmount: 0,
                    receiptNumber,
                    userTier: user.tier,

                    // Snapshot User Info
                    userName: user.name,
                    userEmail: user.email,
                    userPhone: user.phone,
                    affiliation: user.affiliation,
                    licenseNumber: user.licenseNumber,
                    lastUpdated: serverTimestamp(),

                    confirmationQr,
                    badgeQr: null, // Phase 2: Null until check-in
                    isCheckedIn: false,
                    checkInTime: null,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                };

                transaction.set(regRef, newRegistration);

                return regId;
            });

            // 3. Send Notification (Async, non-blocking)
            console.log(`[Notification] Sending confirmation for ${newRegId}`);

            setStatus({ loading: false, error: null, success: true, regId: newRegId });
            return true;

        } catch (err: unknown) {
            console.error(err);
            const message = err instanceof Error ? err.message : 'Unknown error';
            setStatus({ loading: false, error: message, success: false, regId: null });
            return false;
        }
    };

    return {
        register,
        loading: status.loading,
        error: status.error,
        success: status.success,
        availablePeriods,
        calculatePrice,
        resumeRegistration,
        autoSave
    };
};
