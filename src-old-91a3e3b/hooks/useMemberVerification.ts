import { useState } from 'react';
import { db, auth, functions } from '../firebase';
import { collection, doc, setDoc, addDoc, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';

interface VerificationResult {
    success: boolean;
    message: string;
    isExpired?: boolean; // ✅ [FIX] 유효기간 만료 여부 플래그
    memberData?: any;
}

export const useMemberVerification = () => {
    const [loading, setLoading] = useState(false);

    const verifyMember = async (
        societyId: string, 
        name: string, 
        code: string, 
        consent: boolean,
        targetGradeId?: string | null, // [Fix-Step 345] Made optional for Smart Verification
        guestEmail?: string,      
        guestPhone?: string,      
        guestPassword?: string,
        lockNow?: boolean // [Fix-Step 357] Immediate Lock
    ): Promise<VerificationResult> => {
        
        // 1. Basic Validation
        if (!consent) {
            toast.error("개인정보 제공에 동의해야 합니다.");
            return { success: false, message: "Consent required" };
        }
        if (!name || !code) {
            toast.error("이름과 면허번호(코드)를 입력해주세요.");
            return { success: false, message: "Missing inputs" };
        }
        
        setLoading(true);

        try {
            const currentUser = auth.currentUser;
            const isAnonymous = currentUser?.isAnonymous || false;
            const uid = currentUser?.uid;

            // [Fix-Step 346] Ensure UID exists for storage (Guests should be anon-signed-in by now)
            if (!uid) {
                 setLoading(false);
                 return { success: false, message: "Session not initialized. Please refresh the page." };
            }

            // [Fix-Step 292] Use Cloud Function
            const verifyFn = httpsCallable(functions, 'verifyMemberIdentity');
            const { data }: any = await verifyFn({
                societyId,
                name,
                code,
                lockNow: lockNow || false // Pass lock flag
                // The function will use context.auth to identify user/guest
            });

            if (!data.success) {
                setLoading(false);
                return { success: false, message: data.message || "Verification failed" };
            }

            // [Fix-Step 345] Auto-Grade Selection Support (Removed Mismatch Check)
            const serverGrade = data.grade; // e.g., 'Dental Hygienist' or 'MEMBER'
            
            // [Deleted] Mismatch Logic
            // We now trust the server's returned grade and will use it to auto-select in the UI.

            // 3. Persistence (Fix-Step 292)
            // Guests -> users/{uid}/society_guests (Subcollection)
            
            if (!isAnonymous && uid) {
                // PERMANENT USER -> Update Profile
                const serverExpiry = data.memberData?.expiryDate || data.memberData?.expiry;
                const userRef = doc(db, 'users', uid);
                await setDoc(userRef, {
                    affiliations: {
                        [societyId.toLowerCase()]: {
                            verified: true,
                            grade: serverGrade,
                            verifiedAt: Timestamp.now(),
                            expiry: serverExpiry,     // 화면 표시용
                            expiryDate: serverExpiry  // 관리자/백업용
                        }
                    }
                }, { merge: true });

            } else {
                // ANONYMOUS GUEST -> users/{uid}/society_guests
                // [Fix-Step 292] Changed from root 'society_guests' to subcollection
                
                const simpleHash = guestPassword 
                    ? btoa(guestPassword + "_SALT_" + guestEmail) 
                    : 'NO_PASS';
                
                await addDoc(collection(db, 'users', uid, 'society_guests'), {
                    email: guestEmail || 'unknown@guest.com',
                    name: name,
                    phone: guestPhone || '',
                    societyId: societyId.toLowerCase(),
                    isVerifiedGuest: true,
                    simplePassword: simpleHash,
                    createdAt: Timestamp.now(),
                    grade: serverGrade
                });
            }

            setLoading(false);
            return { success: true, message: "Verified", memberData: data };

        } catch (error: any) {
            console.error("Verification Error:", error);
            setLoading(false);
            return { success: false, message: error.message || "System Error" };
        }
    };

    return { verifyMember, loading };
};
