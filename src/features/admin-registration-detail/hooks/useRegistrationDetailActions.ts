import { useCallback, useState } from "react";
import { Timestamp, addDoc, collection, doc, getDoc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import toast from "react-hot-toast";

import { db, functions } from "@/firebase";

import type { EditFormData, ExtendedRegistration } from "../types";

export const useRegistrationDetailActions = (params: {
  effectiveCid: string | null;
  regId: string | undefined;
  data: ExtendedRegistration | null;
  setData: React.Dispatch<React.SetStateAction<ExtendedRegistration | null>>;
}) => {
  const { effectiveCid, regId, data, setData } = params;

  const [canceling, setCanceling] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handlePaymentCancel = useCallback(async () => {
    if (!effectiveCid || !regId || !data) return;
    if (!confirm("정말로 결제를 취소하시겠습니까? PG 승인 취소가 진행되며, 이 작업은 되돌릴 수 없습니다.")) return;

    setCanceling(true);
    try {
      const cancelFn = httpsCallable(functions, "cancelTossPayment");

      await cancelFn({
        paymentKey: data.paymentKey,
        cancelReason: "Admin Manual Cancel",
        confId: effectiveCid,
        regId,
      });

      toast.success("결제가 취소되었습니다.");
      setData((prev) => (prev ? { ...prev, status: "CANCELED" as const } : null));
    } catch (error) {
      console.error("Cancel error:", error);
      toast.error(`취소 실패: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setCanceling(false);
    }
  }, [data, effectiveCid, regId, setData]);

  const handleRefundRequest = useCallback(async () => {
    if (!effectiveCid || !regId || !data) return;
    if (!confirm("환불 요청 상태로 변경하시겠습니까?")) return;

    try {
      const regRef = doc(db, "conferences", effectiveCid, "registrations", regId);
      await updateDoc(regRef, {
        status: "REFUND_REQUESTED",
        refundRequestedAt: Timestamp.now(),
      });

      if (data.userId && data.userId !== "GUEST") {
        try {
          const participationRef = doc(db, "users", data.userId, "participations", regId);
          await updateDoc(participationRef, {
            status: "REFUND_REQUESTED",
            updatedAt: Timestamp.now(),
          });
        } catch (pError) {
          console.error("Failed to update participation:", pError);
        }
      }

      await addDoc(collection(db, `conferences/${effectiveCid}/registrations/${regId}/logs`), {
        type: "REFUND_REQUESTED",
        timestamp: Timestamp.now(),
        method: "ADMIN_MANUAL",
      });

      toast.success("환불 요청 상태로 변경되었습니다.");
      setData((prev) => (prev ? { ...prev, status: "REFUND_REQUESTED" as const } : null));
    } catch (error) {
      console.error("Refund request error:", error);
      toast.error("상태 변경 실패");
    }
  }, [data, effectiveCid, regId, setData]);

  const handleResendNotification = useCallback(async () => {
    if (!effectiveCid || !regId || !data) return;
    if (data.badgeIssued) {
      toast.error("이미 명찰이 발급되었습니다.");
      return;
    }
    if (!confirm(`${data.userName || "사용자"} 님의 알림톡을 재발송하시겠습니까?`)) return;

    setIsResending(true);
    try {
      const resendNotificationFn = httpsCallable(functions, "resendBadgePrepToken");
      const result = (await resendNotificationFn({
        confId: effectiveCid,
        regId,
      })) as { data: { success: boolean } };

      if (result?.data?.success) {
        toast.success("알림톡이 발송되었습니다.");
      } else {
        throw new Error("Failed to send notification");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : (error as { message?: string } | null)?.message;
      console.error("Failed to send notification:", error);
      toast.error(`발송 실패: ${message || "알 수 없는 오류"}`);
    } finally {
      setIsResending(false);
    }
  }, [data, effectiveCid, regId]);

  const handleManualApprove = useCallback(async () => {
    if (!effectiveCid || !regId || !data) return;
    if (!confirm("수동으로 결제 완료 처리하시겠습니까? (시스템 오류로 결제되었으나 반영되지 않은 경우 등)")) return;

    try {
      const regRef = doc(db, "conferences", effectiveCid, "registrations", regId);
      await updateDoc(regRef, {
        status: "PAID",
        paymentStatus: "PAID",
        paidAt: Timestamp.now(),
        paymentMethod: "ADMIN_MANUAL",
        "paymentDetails.status": "DONE",
        updatedAt: Timestamp.now(),
      });

      if (data.userId && data.userId !== "GUEST") {
        try {
          const participationRef = doc(db, "users", data.userId, "participations", regId);
          await updateDoc(participationRef, {
            status: "PAID",
            updatedAt: Timestamp.now(),
          });
        } catch (pError) {
          console.error("Failed to update participation:", pError);
        }
      }

      await addDoc(collection(db, `conferences/${effectiveCid}/registrations/${regId}/logs`), {
        type: "MANUAL_APPROVE",
        timestamp: Timestamp.now(),
        method: "ADMIN_MANUAL",
      });

      toast.success("결제 완료 처리되었습니다.");
      setData((prev) => (prev ? { ...prev, status: "PAID" as const } : null));
    } catch (error) {
      console.error("Manual approve error:", error);
      toast.error("처리 실패");
    }
  }, [data, effectiveCid, regId, setData]);

  const handleSaveEdit = useCallback(
    async (editData: EditFormData, onSuccess: () => void) => {
      if (!effectiveCid || !regId || !data) return;
      setIsSaving(true);
      try {
        const regRef = doc(db, "conferences", effectiveCid, "registrations", regId);
        const regUpdatePayload: Record<string, unknown> = {
          userName: editData.userName,
          userPhone: editData.userPhone,
          affiliation: editData.userOrg,
          organization: editData.userOrg,
          licenseNumber: editData.licenseNumber,
          updatedAt: Timestamp.now(),
        };

        if ((data as unknown as { userInfo?: unknown }).userInfo) {
          regUpdatePayload["userInfo.name"] = editData.userName;
          regUpdatePayload["userInfo.phone"] = editData.userPhone;
          regUpdatePayload["userInfo.affiliation"] = editData.userOrg;
          regUpdatePayload["userInfo.licenseNumber"] = editData.licenseNumber;
        }

        if ((data as unknown as { userAffiliation?: unknown }).userAffiliation) regUpdatePayload.userAffiliation = editData.userOrg;
        if ((data as unknown as { license?: unknown }).license) regUpdatePayload.license = editData.licenseNumber;

        await updateDoc(regRef, regUpdatePayload);

        if (data.userId && data.userId !== "GUEST" && !data.userId.startsWith("offline_")) {
          try {
            const userRef = doc(db, "users", data.userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              await updateDoc(userRef, {
                name: editData.userName,
                phone: editData.userPhone,
                organization: editData.userOrg,
                affiliation: editData.userOrg,
                licenseNumber: editData.licenseNumber,
              });
            }
          } catch (uErr) {
            console.error("Failed to update user document:", uErr);
          }
        }

        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            userName: editData.userName,
            userPhone: editData.userPhone,
            userOrg: editData.userOrg,
            affiliation: editData.userOrg,
            licenseNumber: editData.licenseNumber,
          };
        });

        toast.success("등록 정보가 수정되었습니다.\n(회원 정보 및 명찰에 즉시 반영됨)");
        onSuccess();
      } catch (error) {
        console.error("Error saving edits:", error);
        toast.error("정보 수정에 실패했습니다.");
      } finally {
        setIsSaving(false);
      }
    },
    [data, effectiveCid, regId, setData],
  );

  return {
    canceling,
    isResending,
    isSaving,
    actions: {
      handlePaymentCancel,
      handleRefundRequest,
      handleResendNotification,
      handleManualApprove,
      handleSaveEdit,
    },
  };
};

