import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { Registration } from '../types/schema';
import { DOMAIN_CONFIG, extractSocietyFromHost } from '../utils/domainHelper';
import { normalizeFieldSettings } from '../utils/registrationFieldSettings';
import type { RegistrationFieldSettings } from '../types/schema';

// Extended type for flattened data in UI
export interface ExtendedRegistration extends Omit<Registration, 'baseAmount' | 'optionsTotal' | 'selectedOptions'> {
    tier?: string;
    grade?: string;
    categoryName?: string;
    userOrg?: string;
    paymentKey?: string;
    paidAt?: { seconds: number; nanoseconds?: number } | Date | string;
    orderId?: string;
    paymentType?: string;
    method?: string;
    userInfo?: {
        licenseNumber?: string;
        grade?: string;
        [key: string]: unknown;
    };
    license?: string; // For explicit fallback
    baseAmount?: number;
    optionsTotal?: number;
    options?: Array<{
        optionId: string;
        name: { ko: string; en?: string } | string;
        price: number;
        quantity: number;
        totalPrice: number;
    }>;
    selectedOptions?: Array<{
        optionId: string;
        name: { ko: string; en?: string } | string;
        price: number;
        quantity: number;
        totalPrice: number;
    }>;
}

const getConferenceIdByDomain = () => {
    const hostname = window.location.hostname;
    const societyId = extractSocietyFromHost(hostname) || DOMAIN_CONFIG.DEFAULT_SOCIETY;
    return `${societyId}_2026spring`;
};

export const paymentMethodToKorean = (method: string | undefined): string => {
    if (!method) return '-';
    switch (method) {
        case 'CARD': return '카드';
        case 'TRANSFER': return '계좌이체';
        case 'VIRTUAL': return '가상계좌';
        case 'CASH': return '현금';
        case 'ADMIN_FREE': return '관리자 무료 등록';
        case 'FREE': return '무료 등록';
        default: return method;
    }
};

export interface EditFormData {
    userName: string;
    userPhone: string;
    userEmail: string;
    userOrg: string;
    position: string;
    licenseNumber: string;
}

export const useRegistrationDetail = (confId: string | null, regId: string | null) => {
    const navigate = useNavigate();
    const [data, setData] = useState<ExtendedRegistration | null>(null);
    const [loading, setLoading] = useState(true);
    const [canceling, setCanceling] = useState(false);
    const [effectiveCid, setEffectiveCid] = useState<string | null>(null);

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<EditFormData>({
        userName: '',
        userPhone: '',
        userEmail: '',
        userOrg: '',
        position: '',
        licenseNumber: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    // Resend notification state
    const [isResending, setIsResending] = useState(false);

    const [fieldSettings, setFieldSettings] = useState<RegistrationFieldSettings>(normalizeFieldSettings());

    // Load Registration Settings for field visibility
    useEffect(() => {
        if (!effectiveCid) return;
        const fetchSettings = async () => {
            try {
                const regDoc = await getDoc(doc(db, `conferences/${effectiveCid}/settings/registration`));
                if (regDoc.exists()) {
                    setFieldSettings(normalizeFieldSettings(regDoc.data().fieldSettings));
                }
            } catch (err) {
                console.error("Failed to fetch fieldSettings", err);
            }
        };
        fetchSettings();
    }, [effectiveCid]);

    useEffect(() => {
        const fetchData = async () => {
            let targetCid = confId;

            if (!targetCid) {
                targetCid = getConferenceIdByDomain();
                setEffectiveCid(targetCid);
            } else {
                setEffectiveCid(targetCid);
            }

            if (!regId || !targetCid) return;
            try {
                const ref = doc(db, 'conferences', targetCid, 'registrations', regId);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const docData = snap.data();
                    const flattened = { id: snap.id, ...docData } as ExtendedRegistration;

                    // Flatten userInfo fields to top level for display
                    if (docData.userInfo) {
                        flattened.userName = docData.userInfo.name || docData.userName;
                        flattened.userEmail = docData.userInfo.email || docData.userEmail;
                        flattened.userPhone = docData.userInfo.phone || docData.userPhone;
                        flattened.affiliation = docData.userInfo.affiliation || docData.affiliation;
                        flattened.position = docData.userInfo.position || docData.position;
                        flattened.licenseNumber = docData.userInfo.licenseNumber || docData.licenseNumber;

                        // [Fix] Map grade/tier from userInfo if available
                        if (!flattened.tier && docData.userInfo.grade) {
                            flattened.tier = docData.userInfo.grade;
                        }
                    }

                    // [Fix] Ensure optionsTotal is accurate by calculating from array if missing/zero
                    const optionsList = flattened.options || flattened.selectedOptions || [];
                    const calculatedOptionsTotal = optionsList.reduce((sum: number, opt: unknown) => sum + ((opt as Record<string, unknown>).totalPrice || ((opt as Record<string, unknown>).price as number | undefined) * ((opt as Record<string, unknown>).quantity as number | undefined) || 0), 0);

                    if (calculatedOptionsTotal > 0 && (!flattened.optionsTotal || flattened.optionsTotal === 0)) {
                        flattened.optionsTotal = calculatedOptionsTotal;
                    }

                    // [Fix] Map schema-defined userTier to tier if tier is missing
                    if (!flattened.tier && docData.userTier) {
                        flattened.tier = docData.userTier as string;
                    }

                    // [Fix] Fallback for licenseNumber
                    if (!flattened.licenseNumber && docData.license) {
                        flattened.licenseNumber = docData.license;
                    }

                    // [Fix] Extract payment details from nested object if available
                    if (docData.paymentDetails) {
                        if (!flattened.paymentKey && docData.paymentDetails.paymentKey) {
                            flattened.paymentKey = docData.paymentDetails.paymentKey;
                        }
                        if (!flattened.paymentMethod && docData.paymentDetails.method) {
                            flattened.paymentMethod = docData.paymentDetails.method;
                        }
                        // Handle paidAt / approvedAt
                        if (!flattened.paidAt && docData.paymentDetails.approvedAt) {
                            // approvedAt is ISO string, convert to Date object for consistent handling
                            flattened.paidAt = new Date(docData.paymentDetails.approvedAt);
                        }
                    }

                    setData(flattened);
                    // Initialize edit data
                    setEditData({
                        userName: flattened.userName || '',
                        userOrg: flattened.userOrg || flattened.affiliation || '',
                        userPhone: flattened.userPhone || '',
                        userEmail: flattened.userEmail || '',
                        position: flattened.position || (flattened.userInfo?.position as string) || '',
                        licenseNumber: flattened.licenseNumber || ''
                    });
                } else {
                    toast.error('등록 정보를 찾을 수 없습니다.');
                    navigate(-1);
                }
            } catch (error) {
                console.error('Fetch error:', error);
                toast.error('데이터를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [confId, regId, navigate]);

    const handlePaymentCancel = async () => {
        if (!effectiveCid || !regId || !data) return;
        if (!confirm('정말로 결제를 취소하시겠습니까? PG 승인 취소가 진행되며, 이 작업은 되돌릴 수 없습니다.')) return;

        setCanceling(true);
        try {
            // [Modified] Call Cloud Function to Cancel Payment via PG API
            const cancelFn = httpsCallable(functions, 'cancelTossPayment');

            await cancelFn({
                paymentKey: data.paymentKey,
                cancelReason: 'Admin Manual Cancel',
                confId: effectiveCid,
                regId: regId
            });

            // DB Updates are handled by Cloud Function now (or we can double check/refresh here)
            // But for UI feedback:
            toast.success('결제가 취소되었습니다.');
            setData((prev) => prev ? { ...prev, status: 'CANCELED' as const } : null);
        } catch (error) {
            console.error('Cancel error:', error);
            toast.error('취소 실패: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setCanceling(false);
        }
    };

    const handleRefundRequest = async () => {
        if (!effectiveCid || !regId || !data) return;
        if (!confirm('환불 요청 상태로 변경하시겠습니까?')) return;

        try {
            const regRef = doc(db, 'conferences', effectiveCid, 'registrations', regId);
            await updateDoc(regRef, {
                status: 'REFUND_REQUESTED',
                refundRequestedAt: Timestamp.now()
            });

            // Update Participation if userId exists
            if (data.userId && data.userId !== 'GUEST') {
                try {
                    const participationRef = doc(db, 'users', data.userId, 'participations', regId);
                    await updateDoc(participationRef, {
                        status: 'REFUND_REQUESTED',
                        updatedAt: Timestamp.now()
                    });
                } catch (pError) {
                    console.error("Failed to update participation:", pError);
                }
            }

            await addDoc(collection(db, `conferences/${effectiveCid}/registrations/${regId}/logs`), {
                type: 'REFUND_REQUESTED',
                timestamp: Timestamp.now(),
                method: 'ADMIN_MANUAL'
            });

            toast.success('환불 요청 상태로 변경되었습니다.');
            setData((prev) => prev ? { ...prev, status: 'REFUND_REQUESTED' as const } : null);
        } catch (error) {
            console.error('Refund request error:', error);
            toast.error('상태 변경 실패');
        }
    };

    const handleResendNotification = async () => {
        if (!effectiveCid || !regId || !data) return;
        if (data.badgeIssued) {
            toast.error("이미 명찰이 발급되었습니다.");
            return;
        }
        if (!confirm(`${data.userName || '사용자'} 님의 알림톡을 재발송하시겠습니까?`)) return;

        setIsResending(true);
        try {
            const resendNotificationFn = httpsCallable(functions, 'resendBadgePrepToken');
            const result = await resendNotificationFn({
                confId: effectiveCid,
                regId: regId
            }) as { data: { success: boolean } };

            if (result?.data?.success) {
                toast.success('알림톡이 발송되었습니다.');
            } else {
                throw new Error('Failed to send notification');
            }
        } catch (error: unknown) {
            console.error('Failed to send notification:', error);
            toast.error(`발송 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        } finally {
            setIsResending(false);
        }
    };

    const handleManualApprove = async () => {
        if (!effectiveCid || !regId || !data) return;
        if (!confirm('수동으로 결제 완료 처리하시겠습니까? (시스템 오류로 결제되었으나 반영되지 않은 경우 등)')) return;

        try {
            const regRef = doc(db, 'conferences', effectiveCid, 'registrations', regId);
            await updateDoc(regRef, {
                status: 'PAID',
                paymentStatus: 'PAID',
                paidAt: Timestamp.now(),
                paymentMethod: 'ADMIN_MANUAL',
                'paymentDetails.status': 'DONE',
                updatedAt: Timestamp.now()
            });

            // Update Participation if userId exists
            if (data.userId && data.userId !== 'GUEST') {
                try {
                    const participationRef = doc(db, 'users', data.userId, 'participations', regId);
                    await updateDoc(participationRef, {
                        status: 'PAID',
                        updatedAt: Timestamp.now()
                    });
                } catch (pError) {
                    console.error("Failed to update participation:", pError);
                }
            }

            await addDoc(collection(db, `conferences/${effectiveCid}/registrations/${regId}/logs`), {
                type: 'MANUAL_APPROVE',
                timestamp: Timestamp.now(),
                method: 'ADMIN_MANUAL'
            });

            toast.success('결제 완료 처리되었습니다.');
            setData((prev) => prev ? { ...prev, status: 'PAID' as const } : null);
        } catch (error) {
            console.error('Manual approve error:', error);
            toast.error('처리 실패');
        }
    };

    const handleSaveEdit = async () => {
        if (!effectiveCid || !regId || !data) return;
        setIsSaving(true);
        try {
            // 1. Update Registration Document
            const regRef = doc(db, 'conferences', effectiveCid, 'registrations', regId);
            const regUpdatePayload: Record<string, unknown> = {
                userName: editData.userName,
                userPhone: editData.userPhone,
                affiliation: editData.userOrg,
                organization: editData.userOrg,
                position: editData.position,
                licenseNumber: editData.licenseNumber,
                updatedAt: Timestamp.now()
            };

            // Also update nested userInfo if it exists to keep structure consistent
            if ((data as Record<string, unknown>).userInfo) {
                regUpdatePayload['userInfo.name'] = editData.userName;
                regUpdatePayload['userInfo.phone'] = editData.userPhone;
                regUpdatePayload['userInfo.affiliation'] = editData.userOrg;
                regUpdatePayload['userInfo.position'] = editData.position;
                regUpdatePayload['userInfo.licenseNumber'] = editData.licenseNumber;
            }

            // Also update legacy fields if they existed
            if ((data as Record<string, unknown>).userAffiliation) regUpdatePayload.userAffiliation = editData.userOrg;
            if ((data as Record<string, unknown>).license) regUpdatePayload.license = editData.licenseNumber;

            await updateDoc(regRef, regUpdatePayload);

            // 2. Update Glob User Document (if valid user ID)
            if (data.userId && data.userId !== 'GUEST' && !data.userId.startsWith('offline_')) {
                try {
                    const userRef = doc(db, 'users', data.userId);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        await updateDoc(userRef, {
                            name: editData.userName,
                            phone: editData.userPhone,
                            organization: editData.userOrg,
                            affiliation: editData.userOrg, // legacy support fallback
                            position: editData.position,
                            licenseNumber: editData.licenseNumber,
                        });
                    }
                } catch (uErr) {
                    console.error('Failed to update user document:', uErr);
                    // Non-blocking error. Continue
                }
            }

            // Update local state
            setData(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    userName: editData.userName,
                    userPhone: editData.userPhone,
                    userOrg: editData.userOrg,
                    affiliation: editData.userOrg,
                    position: editData.position,
                    licenseNumber: editData.licenseNumber
                };
            });

            toast.success('등록 정보가 수정되었습니다.\n(회원 정보 및 명찰에 즉시 반영됨)');
            setIsEditing(false);
        } catch (error) {
            console.error('Error saving edits:', error);
            toast.error('정보 수정에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const cancelEdit = () => {
        if (!data) return;
        setIsEditing(false);
        setEditData({
            userName: data.userName || '',
            userOrg: data.userOrg || data.affiliation || '',
            userPhone: data.userPhone || '',
            userEmail: data.userEmail || '',
            position: data.position || (data.userInfo?.position as string) || '',
            licenseNumber: data.licenseNumber || ''
        });
    };

    const canCancel = data?.status === 'PAID' && !!data.paymentKey;
    const canRequestRefund = data?.status === 'PAID';
    const canManualApprove = !!data && (
        data.status === 'PENDING' ||
        data.status === 'FAILED' ||
        data.status === 'WAITING_FOR_DEPOSIT' ||
        data.status === 'PENDING_PAYMENT' ||
        (data.status === 'PAID' && (data as Record<string, unknown>).paymentStatus !== 'PAID')
    );

    return {
        // Data
        data,
        loading,
        effectiveCid,
        fieldSettings,

        // Edit mode
        isEditing,
        setIsEditing,
        editData,
        setEditData,
        isSaving,
        handleSaveEdit,
        cancelEdit,

        // Actions
        canceling,
        handlePaymentCancel,
        handleRefundRequest,
        isResending,
        handleResendNotification,
        handleManualApprove,

        // Computed
        canCancel,
        canRequestRefund,
        canManualApprove,
    };
};
