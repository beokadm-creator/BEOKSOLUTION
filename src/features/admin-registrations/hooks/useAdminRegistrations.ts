import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import toast from "react-hot-toast";

import { db } from "@/firebase";
import { useBixolon } from "@/hooks/useBixolon";
import { useExcel } from "@/hooks/useExcel";
import { useRegistrationsPagination } from "@/hooks/useRegistrationsPagination";
import { safeFormatDate } from "@/utils/dateUtils";
import { handleDeleteRegistrationWithCleanup } from "@/utils/registrationDeleteHandler";
import type { BadgeElement } from "@/types/schema";

import { fetchAllRegistrations } from "../services/fetchAllRegistrations";
import { badgeConfigRepo } from "../services/badgeConfigRepo";
import { registrationFunctions } from "../services/registrationFunctions";
import type { BulkSendModalState, RegistrationOptionSummary, RootRegistration } from "../types";
import { displayTier, getRegistrationDisplayAmount, statusToKorean } from "../utils/formatters";

const FALLBACK_BADGE_LAYOUT: { width: number; height: number; elements: BadgeElement[]; enableCutting?: boolean; unit?: 'px' | 'mm' } = {
  width: 100,
  height: 240,
  unit: 'mm',
  elements: [
    { x: 50, y: 20, fontSize: 25, isVisible: true, type: "QR" },
    { x: 50, y: 60, fontSize: 6, isVisible: true, type: "NAME" },
    { x: 50, y: 80, fontSize: 4, isVisible: true, type: "ORG" },
  ],
};

export const useAdminRegistrations = (params: { conferenceId: string | null }) => {
  const { conferenceId } = params;
  const navigate = useNavigate();

  const { exportToExcel, processing: exporting } = useExcel();
  const { printBadge, printing: bixolonPrinting, error: bixolonError } = useBixolon();

  const [filterStatus, setFilterStatus] = useState("SUCCESSFUL");
  const [searchName, setSearchName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const [bulkModal, setBulkModal] = useState<BulkSendModalState>({
    open: false,
    step: "confirm",
    targetIds: [],
    confirmInput: "",
    checks: [false, false, false],
    result: null,
  });

  const {
    registrations,
    loading,
    error,
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    hasMore,
    refresh: refreshPagination,
  } = useRegistrationsPagination({
    conferenceId,
    itemsPerPage: 50,
    searchQuery: searchName,
  });

  const handleIssueBadge = useCallback(
    async (e: MouseEvent, reg: RootRegistration) => {
      e.stopPropagation();
      if (!confirm(`${reg.userName || "사용자"} 님의 명찰을 발급 처리하시겠습니까?`)) return;

      setIsProcessing(true);
      try {
        if (!conferenceId) {
          toast.error("Conference ID missing");
          return;
        }

        const result = await registrationFunctions.issueDigitalBadge({
          confId: conferenceId,
          regId: reg.id,
          issueOption: "DIGITAL_PRINT",
        });

        if (result.data.success) {
          toast.success("명찰 발급 처리 완료");
          refreshPagination();
        } else {
          throw new Error("발급 처리에 실패했습니다.");
        }
      } catch (err: unknown) {
        console.error("Badge issue failed:", err);
        toast.error(`처리 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [conferenceId, refreshPagination],
  );

  const handleResendNotification = useCallback(
    async (e: MouseEvent, reg: RootRegistration) => {
      e.stopPropagation();
      if (reg.badgeIssued) {
        toast.error("이미 명찰이 발급되었습니다.");
        return;
      }
      if (!confirm(`${reg.userName || "사용자"} 님에게 알림톡을 재발송하시겠습니까?`)) return;
      if (!conferenceId) return;

      setIsProcessing(true);
      try {
        const result = await registrationFunctions.resendBadgePrepToken({
          confId: conferenceId,
          regId: reg.id,
        });

        if (result.data.success) {
          toast.success("알림톡이 발송되었습니다.");
        } else {
          throw new Error("Failed to send notification");
        }
      } catch (err: unknown) {
        console.error("Failed to send notification:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Error: ${message}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [conferenceId],
  );

  const filteredData = useMemo(() => {
    const seenOrderIds = new Set<string>();
    const deduplicatedRegs: RootRegistration[] = [];

    registrations.forEach((r) => {
      const orderId = r.orderId || r.id;
      if (!seenOrderIds.has(orderId)) {
        seenOrderIds.add(orderId);
        if (
          ["PAID", "REFUNDED", "CANCELED", "REFUND_REQUESTED", "WAITING_FOR_DEPOSIT", "PENDING_PAYMENT"].includes(
            r.status,
          )
        ) {
          deduplicatedRegs.push(r);
        }
      }
    });

    return deduplicatedRegs.filter((r) => {
      try {
        let matchesStatus = false;
        if (filterStatus === "ALL") {
          matchesStatus = true;
        } else if (filterStatus === "SUCCESSFUL") {
          matchesStatus = r.status === "PAID";
        } else if (filterStatus === "CANCELED") {
          matchesStatus = r.status === "CANCELED" || r.status === "REFUNDED" || r.status === "REFUND_REQUESTED";
        } else if (filterStatus === "WAITING") {
          matchesStatus = r.status === "WAITING_FOR_DEPOSIT" || r.status === "PENDING_PAYMENT";
        } else {
          matchesStatus = r.status === filterStatus;
        }

        const searchTerm = searchName.toLowerCase();
        const matchesName =
          (r.userName ?? "").toLowerCase().includes(searchTerm) ||
          (r.orderId ?? "").toLowerCase().includes(searchTerm) ||
          (r.id ?? "").toLowerCase().includes(searchTerm) ||
          (r.userEmail ?? "").toLowerCase().includes(searchTerm) ||
          (r.userPhone ?? "").toLowerCase().includes(searchTerm);

        return matchesStatus && matchesName;
      } catch (err) {
        console.error("데이터 오류 발생 레코드 ID:", r.id, err);
        return false;
      }
    });
  }, [filterStatus, registrations, searchName]);

  const toggleSelection = useCallback((e: MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.length === filteredData.length && filteredData.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredData.map((r) => r.id));
    }
  }, [filteredData, selectedIds.length]);

  const prepareBulkSend = useCallback(
    async (mode: "selected" | "all") => {
      if (!conferenceId) return;

      let targetIds: string[];
      if (mode === "selected") {
        targetIds = registrations.filter((r) => selectedIds.includes(r.id) && !r.badgeIssued).map((r) => r.id);
        if (targetIds.length !== selectedIds.length) {
          toast.error(`선택된 인원 중 이미 명찰이 발급된 ${selectedIds.length - targetIds.length}명은 발송 대상에서 제외되었습니다.`, {
            duration: 4000,
          });
        }
      } else {
        const toastId = toast.loading("전체 등록자 목록을 불러오는 중...");
        try {
          const allRegs = await fetchAllRegistrations(conferenceId);
          const seenIds = new Set<string>();
          const deduped: RootRegistration[] = [];
          allRegs.forEach((r) => {
            const oid = r.orderId || r.id;
            if (!seenIds.has(oid)) {
              seenIds.add(oid);
              deduped.push(r);
            }
          });
          targetIds = deduped
            .filter((r) => {
              let matchesStatus = false;
              if (filterStatus === "ALL") matchesStatus = true;
              else if (filterStatus === "SUCCESSFUL") matchesStatus = r.status === "PAID";
              else if (filterStatus === "CANCELED")
                matchesStatus = ["CANCELED", "REFUNDED", "REFUND_REQUESTED"].includes(r.status);
              else if (filterStatus === "WAITING")
                matchesStatus = ["WAITING_FOR_DEPOSIT", "PENDING_PAYMENT"].includes(r.status);
              else matchesStatus = r.status === filterStatus;

              const searchTerm = searchName.trim().toLowerCase();
              const matchesSearch = searchTerm
                ? (r.userName ?? "").toLowerCase().includes(searchTerm) ||
                  (r.userEmail ?? "").toLowerCase().includes(searchTerm) ||
                  (r.userPhone ?? "").toLowerCase().includes(searchTerm) ||
                  (r.orderId ?? "").toLowerCase().includes(searchTerm) ||
                  (r.id ?? "").toLowerCase().includes(searchTerm)
                : true;

              const isNotIssued = !r.badgeIssued;
              return matchesStatus && matchesSearch && isNotIssued;
            })
            .map((r) => r.id);
          toast.dismiss(toastId);
        } catch {
          toast.error("전체 목록을 불러오는데 실패했습니다.", { id: toastId });
          return;
        }
      }

      if (targetIds.length === 0) {
        toast.error("발송할 대상이 없습니다.");
        return;
      }

      setBulkModal({
        open: true,
        step: "confirm",
        targetIds,
        confirmInput: "",
        checks: [false, false, false],
        result: null,
      });
    },
    [conferenceId, filterStatus, registrations, searchName, selectedIds],
  );

  const executeBulkSend = useCallback(async () => {
    if (!conferenceId) return;
    setBulkModal((prev) => ({ ...prev, step: "processing" }));
    try {
      const result = await registrationFunctions.bulkSendNotifications({
        confId: conferenceId,
        regIds: bulkModal.targetIds,
      });

      setBulkModal((prev) => ({
        ...prev,
        step: "done",
        result: {
          sent: result.data.sent,
          failed: result.data.failed,
          skipped: result.data.skipped,
          tokenGenerated: result.data.tokenGenerated,
        },
      }));
      setSelectedIds([]);
    } catch (err: unknown) {
      console.error("Bulk send failed:", err);
      const message = err instanceof Error ? err.message : (err as { message?: string } | null)?.message;
      toast.error(`발송 실패: ${message || "알 수 없는 오류"}`);
      setBulkModal((prev) => ({ ...prev, step: "confirm" }));
    }
  }, [bulkModal.targetIds, conferenceId]);

  const closeBulkModal = useCallback(() => {
    setBulkModal((prev) => ({ ...prev, open: false }));
  }, []);

  const setBulkConfirmInput = useCallback((value: string) => {
    setBulkModal((prev) => ({ ...prev, confirmInput: value }));
  }, []);

  const toggleBulkCheck = useCallback((index: number) => {
    setBulkModal((prev) => ({
      ...prev,
      checks: prev.checks.map((c, i) => (i === index ? !c : c)),
    }));
  }, []);

  const handleBixolonPrint = useCallback(
    async (e: MouseEvent, reg: RootRegistration) => {
      e.stopPropagation();

      if (bixolonPrinting) return;

      const qrData = reg.badgeQr || reg.id;
      toast.loading("라벨 프린터 전송 중...", { id: "bixolon-print" });

      try {
        let badgeLayout: { width: number; height: number; elements: BadgeElement[]; enableCutting?: boolean } | null =
          null;

        if (conferenceId) {
          console.log("[Bixolon] Fetching latest layout from settings/badge_config...");
          try {
            badgeLayout = await badgeConfigRepo.getActiveBadgeLayout(conferenceId);
            if (badgeLayout) {
              console.log("[Bixolon] 최신 로드 완료:", badgeLayout);
            }
          } catch (fetchErr) {
            console.error("[Bixolon] badge_config fetch failed:", fetchErr);
          }
        }

        const activeLayout = badgeLayout || FALLBACK_BADGE_LAYOUT;

        let userName = reg.userName || "";
        let userAffiliation = reg.userOrg || reg.affiliation || "";

        if ((!userAffiliation || userAffiliation.includes("@")) && reg.userId && conferenceId) {
          try {
            const userRef = doc(db, `conferences/${conferenceId}/users`, reg.userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const userData = userSnap.data() as { organization?: string; affiliation?: string; name?: string };
              userAffiliation = userData.organization || userData.affiliation || userAffiliation;
              userName = userName || userData.name || "";
            }
          } catch (err) {
            console.error("Failed to fetch user doc for affiliation fallback (print):", err);
          }
        }

        const displayAmount = getRegistrationDisplayAmount(reg);
        const printSuccess = await printBadge(activeLayout, {
          name: userName,
          org: userAffiliation,
          category: displayTier(reg.tier),
          license: reg.licenseNumber || "",
          price: displayAmount.toLocaleString() + "원",
          affiliation: userAffiliation,
          qrData: qrData,
        });

        if (printSuccess) {
          toast.success("라벨 출력 성공", { id: "bixolon-print" });
        } else {
          const errMsg = bixolonError || "라벨 출력 실패 - 프린터 에이전트 연결을 확인하세요 (ws://127.0.0.1:18082)";
          toast.error(errMsg, { id: "bixolon-print", duration: 6000 });
        }
      } catch (err) {
        console.error(err);
        toast.error("프린터 오류 발생", { id: "bixolon-print" });
      }
    },
    [bixolonError, bixolonPrinting, conferenceId, printBadge],
  );

  const handleDeleteRegistration = useCallback(
    async (e: MouseEvent, reg: RootRegistration) => {
      e.stopPropagation();

      const confirmMessage =
        `다음 등록 정보를 삭제하시겠습니까?\n\n` +
        `이름: ${reg.userName || "미상"}\n` +
        `이메일: ${reg.userEmail || "미상"}\n` +
        `주문번호: ${reg.id}\n\n` +
        `⚠️ 관련된 모든 출결 데이터가 함께 삭제됩니다.\n` +
        `⚠️ 이 작업은 되돌릴 수 없습니다.`;

      if (!confirm(confirmMessage)) return;

      try {
        if (!conferenceId) {
          toast.error("Conference ID가 없습니다.");
          return;
        }

        await handleDeleteRegistrationWithCleanup(reg, conferenceId, refreshPagination);
      } catch (err: unknown) {
        toast.error(`삭제 중 오류가 발생했습니다: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    },
    [conferenceId, refreshPagination],
  );

  const handleExport = useCallback(async () => {
    const toastId = toast.loading("전체 등록자 데이터를 불러오는 중...");
    try {
      const allRegs = await fetchAllRegistrations(conferenceId);
      const seenOrderIds = new Set<string>();
      const deduped: RootRegistration[] = [];
      allRegs.forEach((r) => {
        const oid = r.orderId || r.id;
        if (!seenOrderIds.has(oid)) {
          seenOrderIds.add(oid);
          deduped.push(r);
        }
      });

      const fullFilteredData = deduped.filter((r) => {
        let matchesStatus = false;
        if (filterStatus === "ALL") matchesStatus = true;
        else if (filterStatus === "SUCCESSFUL") matchesStatus = r.status === "PAID";
        else if (filterStatus === "CANCELED")
          matchesStatus = ["CANCELED", "REFUNDED", "REFUND_REQUESTED"].includes(r.status);
        else if (filterStatus === "WAITING")
          matchesStatus = ["WAITING_FOR_DEPOSIT", "PENDING_PAYMENT"].includes(r.status);
        else matchesStatus = r.status === filterStatus;

        const searchTerm = searchName.trim().toLowerCase();
        const matchesSearch = searchTerm
          ? (r.userName ?? "").toLowerCase().includes(searchTerm) ||
            (r.userEmail ?? "").toLowerCase().includes(searchTerm) ||
            (r.userPhone ?? "").toLowerCase().includes(searchTerm) ||
            (r.orderId ?? "").toLowerCase().includes(searchTerm) ||
            (r.id ?? "").toLowerCase().includes(searchTerm)
          : true;
        return matchesStatus && matchesSearch;
      });

      toast.dismiss(toastId);

      const data = fullFilteredData.map((r) => ({
        주문번호: r.id,
        이름: r.userName,
        이메일: r.userEmail || "-",
        전화번호: r.userPhone || "-",
        소속: r.userOrg || r.affiliation || "-",
        면허번호: r.licenseNumber || "-",
        등급: displayTier(r.tier),
        결제금액: r.amount,
        선택옵션: Array.isArray(r.options)
          ? (r.options as unknown as RegistrationOptionSummary[])
              .map((o) => `${typeof o.name === "string" ? o.name : o.name?.ko || ""}(${o.quantity})`)
              .join(", ")
          : "-",
        결제수단: r.paymentType || r.paymentMethod || r.method || "카드",
        상태: statusToKorean(r.status),
        등록일: safeFormatDate(r.createdAt),
      }));

      exportToExcel(data, `Registrants_${conferenceId || "unknown"}_${new Date().toISOString().slice(0, 10)}`);
      toast.success(`총 ${data.length}명의 데이터를 다운로드했습니다.`);
    } catch {
      toast.dismiss(toastId);
      toast.error("데이터를 불러오는데 실패했습니다.");
    }
  }, [conferenceId, exportToExcel, filterStatus, searchName]);

  const handleRowClick = useCallback(
    (regId: string) => {
      if (!conferenceId) return;
      navigate(`/admin/conf/${conferenceId}/registrations/${regId}`);
    },
    [conferenceId, navigate],
  );

  return {
    conferenceId,
    filterStatus,
    setFilterStatus,
    searchName,
    setSearchName,
    selectedIds,
    isProcessing,
    exporting,
    bixolonPrinting,
    bulkModal,
    registrations,
    filteredData,
    loading,
    error,
    currentPage,
    itemsPerPage,
    hasMore,
    setCurrentPage,
    setItemsPerPage,
    refreshPagination,
    actions: {
      handleRowClick,
      toggleSelection,
      toggleSelectAll,
      handleIssueBadge,
      handleResendNotification,
      prepareBulkSend,
      executeBulkSend,
      closeBulkModal,
      setBulkConfirmInput,
      toggleBulkCheck,
      handleBixolonPrint,
      handleDeleteRegistration,
      handleExport,
    },
  };
};
