import { useState, useCallback } from 'react';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';

interface VerificationResult {
    success: boolean;
    message: string;
    isExpired?: boolean;
    isReserved?: boolean;
    isAlreadyUsed?: boolean;
    memberData?: Record<string, unknown>;
}

export const useMemberVerification = () => {
    const [loading, setLoading] = useState(false);

    const verifyMember = useCallback(async (
        societyId: string,
        name: string,
        code: string,
        consent: boolean,
        reserveTTLMinutes: number = 5, // NEW: 5-minute TTL for reservation
        lockNow: boolean = false
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
            const verifyFn = httpsCallable(functions, 'verifyMemberIdentity');
            const { data } = await verifyFn<{
                success: boolean;
                message: string;
                memberData?: Record<string, unknown>;
                isExpired?: boolean;
                isReserved?: boolean;
                isAlreadyUsed?: boolean;
            }>({
                societyId,
                name,
                code,
                lockNow,
                reserveTTLMinutes
            });

            if (!data.success) {
                setLoading(false);
                return {
                    success: false,
                    message: data.message || "회원 정보를 찾을 수 없습니다.",
                    isExpired: data.isExpired || false,
                    isReserved: data.isReserved || false, // NEW: Reserved flag
                    isAlreadyUsed: data.isAlreadyUsed || false // NEW: Already Used flag
                };
            }

            // Member found - return verification data
            setLoading(false);

            // Debug: Log the member data received from Cloud Function
            console.log('[useMemberVerification] Member verified successfully, memberData:', {
                success: true,
                message: "회원 인증이 완료되었습니다.",
                isExpired: data.isExpired || false,
                memberData: {
                    name: data.memberData?.name,
                    grade: data.grade || data.memberData?.grade,  // FIX: grade는 top-level data.grade에서 읽기
                    code: data.memberData?.code,
                    expiry: data.memberData?.expiry,
                    fullData: data.memberData
                }
            });

            return {
                success: true,
                message: "회원 인증이 완료되었습니다.",
                isExpired: data.isExpired || false,
                memberData: {
                    ...data.memberData,
                    grade: data.grade
                }
            };
        } catch (error: unknown) {
            console.error("Verification Error:", error);
            setLoading(false);
            const message = error instanceof Error ? error.message : "System Error";
            return { success: false, message };
        }
    }, []);

    return { verifyMember, loading };
};
