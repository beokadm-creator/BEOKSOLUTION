import { useState, useEffect } from 'react';
import { doc, runTransaction, Timestamp, collection, getDoc, setDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db, auth as firebaseAuth } from '../firebase';
import { Registration, RegistrationPeriod, ConferenceUser, RegistrationSettings } from '../types/schema';
import { generateReceiptNumber, generateConfirmationQr } from '../utils/transaction';
import { signInAnonymously } from 'firebase/auth';
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

    // [Fix-Step 368] Guest Hijacking Prevention
    const initializeGuest = async (mode: string | null) => {
        // 1. If Login Mode, skip guest creation
        if (mode === 'login') return null;

        const currentUser = firebaseAuth.currentUser;

        // 2. If already logged in as regular user, skip
        if (currentUser && !currentUser.isAnonymous) return null;

        // 3. If already anonymous, reuse
        if (currentUser && currentUser.isAnonymous) return currentUser;

        // 4. Create Guest
        try {
            const { user: guestUser } = await signInAnonymously(firebaseAuth);
            
            // Create User Doc (Anti-Zombie)
            await setDoc(doc(db, 'users', guestUser.uid), {
                uid: guestUser.uid,
                id: guestUser.uid,
                name: 'Guest',
                tier: 'NON_MEMBER',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                isAnonymous: true
            }, { merge: true });

            return guestUser;
        } catch (error) {
            console.error("Guest Init Error:", error);
            throw error;
        }
    };

    // [Fix-Step 368] Resume Registration
    const resumeRegistration = async (userId: string): Promise<any> => {
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
                docs.sort((a: any, b: any) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
                
                const pending = docs[0];
                toast("작성 중인 신청서를 불러왔습니다.");
                return pending;
            }
        } catch (e) {
            console.error("Resume Error:", e);
        }
        return null;
    };

    // Helper function to remove undefined values recursively
    const removeUndefined = (obj: any): any => {
        if (obj === null || obj === undefined) {
            return null;
        }
        if (typeof obj !== 'object') {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(removeUndefined);
        }
        const result: any = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = removeUndefined(obj[key]);
                if (value !== undefined) {
                    result[key] = value;
                }
            }
        }
        return result;
    };

    // [Fix-Step 368] Auto-Save
    // [Fix-Step 369] Support guest/anonymous users in auto-save
    // CRITICAL FIX: Update users/{uid} with actual form data for final registration
    const autoSave = async (step: number, formData: any, regId?: string | null) => {
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
                userId: currentUser.uid, // Use currentUser.uid (supports both authenticated and anonymous users)
                conferenceId,
                status: 'PENDING',
                currentStep: step,
                formData: cleanedFormData,
                isAnonymous: currentUser.isAnonymous, // Track if this is a guest registration
                lastUpdated: serverTimestamp(),
                // Basic info if creating
                ...(regId ? {} : { createdAt: serverTimestamp() })
            };

            await setDoc(ref, dataToSave, { merge: true });

            // CRITICAL FIX: Also update users/{uid} with actual form data
            // This ensures form data (name, email, phone, affiliation, licenseNumber) is available
            // when register() is called for final payment processing
            // [FIX-20250124] Update for both anonymous and non-anonymous users
            if (cleanedFormData.name) {
                await setDoc(doc(db, 'users', currentUser.uid), {
                    name: cleanedFormData.name, // Actual name from form
                    email: cleanedFormData.email, // Actual email from form
                    userName: cleanedFormData.name, // For compatibility
                    phoneNumber: cleanedFormData.phone, // Actual phone from form
                    affiliation: cleanedFormData.affiliation, // Actual affiliation from form
                    licenseNumber: cleanedFormData.licenseNumber, // Actual license number
                    simplePassword: cleanedFormData.simplePassword, // Password for non-member login
                    isAnonymous: currentUser.isAnonymous, // Preserve anonymity status
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
                    isAnonymous: true,
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

        } catch (err: any) {
            console.error(err);
            setStatus({ loading: false, error: err.message, success: false, regId: null });
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
        initializeGuest,
        resumeRegistration,
        autoSave
    };
};
