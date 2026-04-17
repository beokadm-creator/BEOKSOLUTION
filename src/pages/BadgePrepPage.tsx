import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { httpsCallable } from "firebase/functions";
import { getFunctions } from "firebase/functions";
import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  type DocumentData,
  type DocumentSnapshot,
} from "firebase/firestore";
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader2,
  Clock,
  FileText,
  Calendar,
  Languages,
  Download,
  User,
  MapPin,
  TrendingUp,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  resolveConferenceIdFromRoute,
  resolvePublicSlugFromConferenceId,
} from "../utils/conferenceRoute";
import { TranslationPanel } from "../components/translation/TranslationPanel";

interface TokenValidationResult {
  valid: boolean;
  error?: string;
  tokenStatus?: "ACTIVE" | "ISSUED" | "EXPIRED";
  newToken?: string;
  redirectRequired?: boolean;
  registration?: {
    id: string;
    name: string;
    email: string;
    phone: string;
    affiliation: string;
    licenseNumber: string;
    confirmationQr: string;
    badgeQr: string | null;
    badgeIssued: boolean;
    attendanceStatus: "INSIDE" | "OUTSIDE";
    currentZone: string | null;
    totalMinutes: number;
    receiptNumber: string;
    amount?: number;
    lastCheckIn?: { toDate?: () => Date } | null;
    isCompleted?: boolean;
    // Additional fields for enhanced badge
    sessionsCompleted?: number;
    sessionsTotal?: number;
    conference?: {
      name: string;
      dates: {
        start: { toDate: () => Date } | null;
        end: { toDate: () => Date } | null;
      };
      venue: { name?: string } | null;
    };
  };
}

type TimestampLike = {
  toDate?: () => Date;
};

type ZoneBreak = {
  start: string;
  end: string;
};

type AttendanceZone = {
  id: string;
  start?: string;
  end?: string;
  breaks?: ZoneBreak[];
  ruleDate?: string;
};

type AttendanceRule = {
  zones?: Array<Omit<AttendanceZone, "ruleDate">>;
};

type AttendanceSettings = {
  rules?: Record<string, AttendanceRule>;
};

type BadgeConfig = {
  materialsUrls?: Array<{ name: string; url: string }>;
  translationUrl?: string;
  menuVisibility?: {
    status?: boolean;
    sessions?: boolean;
    materials?: boolean;
    program?: boolean;
    translation?: boolean;
    stampTour?: boolean;
    home?: boolean;
  };
  menuLabels?: {
    status?: { ko?: string; en?: string };
    sessions?: { ko?: string; en?: string };
    materials?: { ko?: string; en?: string };
    program?: { ko?: string; en?: string };
    translation?: { ko?: string; en?: string };
    stampTour?: { ko?: string; en?: string };
    home?: { ko?: string; en?: string };
  };
};

const BadgePrepPage: React.FC = () => {
  const { slug, token } = useParams<{ slug: string; token: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(true);
  const [result, setResult] = useState<TokenValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [badgeConfig, setBadgeConfig] = useState<BadgeConfig | null>(null);
  const [badgeLang, setBadgeLang] = useState<"ko" | "en">("ko");
  const [zones, setZones] = useState<AttendanceZone[]>([]);
  const [liveMinutes, setLiveMinutes] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const publicSlug = resolvePublicSlugFromConferenceId(slug);

  const t = useCallback(
    (ko: string, en: string) => (badgeLang === "ko" ? ko : en),
    [badgeLang],
  );

  const voucherQrValue = useMemo(() => {
    if (!result?.registration) return "";
    // Use regId directly for InfoDesk scanning (no CONF- prefix)
    const value =
      result.registration.confirmationQr || result.registration.id || "";
    return value;
  }, [result?.registration]);

  const menuVisibility = {
    status: badgeConfig?.menuVisibility?.status ?? true,
    sessions: badgeConfig?.menuVisibility?.sessions ?? true,
    materials: badgeConfig?.menuVisibility?.materials ?? true,
    program: badgeConfig?.menuVisibility?.program ?? true,
    translation: badgeConfig?.menuVisibility?.translation ?? true,
    home: badgeConfig?.menuVisibility?.home ?? true,
  };
  const effectiveMenuVisibility =
    menuVisibility.status ||
    menuVisibility.sessions ||
    menuVisibility.materials ||
    menuVisibility.program ||
    menuVisibility.translation
      ? menuVisibility
      : { ...menuVisibility, status: true };
  const translationEnabled =
    badgeConfig?.translationUrl !== "HIDE" && effectiveMenuVisibility.translation;
  const tabsOrder = [
    effectiveMenuVisibility.status ? "status" : null,
    effectiveMenuVisibility.sessions ? "sessions" : null,
    effectiveMenuVisibility.materials ? "materials" : null,
    effectiveMenuVisibility.program ? "program" : null,
    translationEnabled ? "translation" : null,
  ].filter(Boolean) as string[];
  const defaultTab = tabsOrder[0] || "status";
  const gridColsClass =
    tabsOrder.length === 1
      ? "grid-cols-1"
      : tabsOrder.length === 2
        ? "grid-cols-2"
        : tabsOrder.length === 3
          ? "grid-cols-3"
          : tabsOrder.length === 4
            ? "grid-cols-4"
            : "grid-cols-5";

  const getMenuLabel = useCallback(
    (key: keyof NonNullable<BadgeConfig["menuLabels"]>, fallbackKo: string, fallbackEn: string) => {
      const labels = badgeConfig?.menuLabels?.[key];
      if (badgeLang === "ko") return labels?.ko || fallbackKo;
      return labels?.en || fallbackEn;
    },
    [badgeConfig?.menuLabels, badgeLang],
  );

  // Helper to determine correct confId
  const getConfIdToUse = useCallback(
    (slugVal: string | undefined): string =>
      resolveConferenceIdFromRoute(slugVal),
    [],
  );

  // Validate token
  const validateToken = useCallback(async () => {
    if (!token) {
      setError("토큰이 제공되지 않았습니다.");
      setLoading(false);
      return;
    }

    try {
      const functions = getFunctions();
      const validateBadgePrepTokenFn = httpsCallable(
        functions,
        "validateBadgePrepToken",
      );

      const confId = getConfIdToUse(slug);

      const [response, configSnap] = await Promise.all([
        validateBadgePrepTokenFn({ confId, token }) as Promise<{
          data: TokenValidationResult;
        }>,
        (async () => {
          try {
            const db = getFirestore();
            const configRef = doc(
              db,
              `conferences/${confId}/settings/badge_config`,
            );
            return await getDoc(configRef);
          } catch (err) {
            console.error("[BadgePrepPage] Failed to load badge config", err);
            return null;
          }
        })(),
      ]);

      if (configSnap && configSnap.exists()) {
        setBadgeConfig(configSnap.data());
      }

      setResult(response.data);
      setLoading(false);
      setValidating(false);
    } catch (err) {
      console.error("[BadgePrepPage] Token validation error:", err);
      setError("토큰 검증에 실패했습니다.");
      setLoading(false);
      setValidating(false);
    }
  }, [token, slug, getConfIdToUse]);

  // Initial validation
  useEffect(() => {
    requestAnimationFrame(() => {
      validateToken();
    });
  }, [validateToken]);

  // Load Zones for attendance calculation
  useEffect(() => {
    if (!result?.registration) return;
    const db = getFirestore();
    const confId = getConfIdToUse(slug);

    const attendanceRef = doc(db, `conferences/${confId}/settings/attendance`);
    getDoc(attendanceRef).then((snap) => {
      if (snap.exists()) {
        const rules = (snap.data() as AttendanceSettings).rules || {};
        const allZones: AttendanceZone[] = [];
        Object.entries(rules).forEach(([dateStr, rule]) => {
          if (rule && rule.zones) {
            rule.zones.forEach((z) => {
              allZones.push({ ...z, ruleDate: dateStr });
            });
          }
        });
        setZones(allZones);
      }
    });
  }, [result?.registration, slug, getConfIdToUse]);

  const [liveAttendance, setLiveAttendance] = useState<{
    status: "INSIDE" | "OUTSIDE";
    totalMinutes: number;
    lastCheckIn: TimestampLike | null;
    currentZone: string | null;
  } | null>(null);

  // Enhanced: Sync detailed registration data directly from Firestore
  useEffect(() => {
    if (!result?.registration?.id) return;
    const db = getFirestore();
    const confId = getConfIdToUse(slug);
    const regId = result.registration.id;

    const regRef = doc(db, `conferences/${confId}/registrations`, regId);
    const extRef = doc(db, `conferences/${confId}/external_attendees`, regId);

    let regularSnap: DocumentSnapshot<DocumentData> | null = null;
    let externalSnap: DocumentSnapshot<DocumentData> | null = null;

    const processSnap = (snap: DocumentSnapshot<DocumentData>) => {
      if (snap.exists()) {
        const d = snap.data();
        setLiveAttendance({
          status: d.attendanceStatus || "OUTSIDE",
          totalMinutes: d.totalMinutes || 0,
          lastCheckIn: d.lastCheckIn,
          currentZone: d.currentZone || null,
        });
        setIsCompleted(!!d.isCompleted);
      } else {
        setLiveAttendance(null);
        setIsCompleted(false);
      }
    };

    const syncPreferredSnapshot = () => {
      if (regularSnap?.exists()) {
        processSnap(regularSnap);
        return;
      }

      if (externalSnap?.exists()) {
        processSnap(externalSnap);
        return;
      }

      setLiveAttendance(null);
      setIsCompleted(false);
    };

    const unsubscribeReg = onSnapshot(
      regRef,
      (snap) => {
        regularSnap = snap;
        syncPreferredSnapshot();
      },
      (err) => {
        console.warn("[BadgePrepPage] Registration doc sync restricted:", err);
      },
    );

    const unsubscribeExt = onSnapshot(
      extRef,
      (snap) => {
        externalSnap = snap;
        syncPreferredSnapshot();
      },
      (err) => {
        console.warn(
          "[BadgePrepPage] External attendee doc sync restricted:",
          err,
        );
      },
    );

    return () => {
      unsubscribeReg();
      unsubscribeExt();
    };
  }, [result?.registration?.id, slug, getConfIdToUse]);

  // Live Ticker Logic (calculates time passed precisely)
  useEffect(() => {
    // We prioritize liveAttendance from Firestore, fallback to result.registration
    const reg = result?.registration;
    if (!reg) return;

    const updateLiveMinutes = () => {
      // Step 1: Determine the base data
      const status = liveAttendance
        ? liveAttendance.status
        : reg.attendanceStatus;
      const baseMinutes = liveAttendance
        ? liveAttendance.totalMinutes
        : reg.totalMinutes || 0;
      const currentCheckIn = liveAttendance
        ? liveAttendance.lastCheckIn
        : reg.lastCheckIn;
      const currentZoneId = liveAttendance
        ? liveAttendance.currentZone
        : reg.currentZone;

      // Step 2: If not inside, just show base minutes
      if (status !== "INSIDE" || !currentCheckIn) {
        setLiveMinutes(baseMinutes);
        return;
      }

      // Step 3: Calculate the live duration for the current session
      const now = new Date();
      const start = currentCheckIn.toDate
        ? currentCheckIn.toDate()
        : new Date();
      let sessionDuration = 0;
      const todayStr = getKstToday();
      const zoneRule = zones.find(z => z.id === currentZoneId && z.ruleDate === todayStr) || zones.find((z) => z.id === currentZoneId);
      let deduction = 0;

      let boundedStart = start;
      let boundedEnd = now;

      if (zoneRule && zoneRule.start && zoneRule.end) {
        const localDateStr =
          zoneRule.ruleDate ||
          start.getFullYear() +
            "-" +
            String(start.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(start.getDate()).padStart(2, "0");
        // Force strings to be interpreted as KST (+09:00)
        const sessionStart = new Date(
          `${localDateStr}T${zoneRule.start}:00+09:00`,
        );
        const sessionEnd = new Date(`${localDateStr}T${zoneRule.end}:00+09:00`);

        boundedStart = new Date(
          Math.max(start.getTime(), sessionStart.getTime()),
        );
        boundedEnd = new Date(Math.min(now.getTime(), sessionEnd.getTime()));
      }

      if (boundedEnd > boundedStart) {
        sessionDuration = Math.floor(
          (boundedEnd.getTime() - boundedStart.getTime()) / 60000,
        );

        if (zoneRule && zoneRule.breaks && Array.isArray(zoneRule.breaks)) {
          zoneRule.breaks.forEach((brk) => {
            const localDateStr =
              zoneRule.ruleDate ||
              start.getFullYear() +
                "-" +
                String(start.getMonth() + 1).padStart(2, "0") +
                "-" +
                String(start.getDate()).padStart(2, "0");
            // Force breaks to KST
            const breakStart = new Date(
              `${localDateStr}T${brk.start}:00+09:00`,
            );
            const breakEnd = new Date(`${localDateStr}T${brk.end}:00+09:00`);
            const overlapStart = Math.max(
              boundedStart.getTime(),
              breakStart.getTime(),
            );
            const overlapEnd = Math.min(
              boundedEnd.getTime(),
              breakEnd.getTime(),
            );
            if (overlapEnd > overlapStart) {
              const overlapMins = Math.floor(
                (overlapEnd - overlapStart) / 60000,
              );
              deduction += overlapMins;
            }
          });
        }
      }

      const activeSessionMinutes = Math.max(0, sessionDuration - deduction);
      setLiveMinutes(baseMinutes + activeSessionMinutes);
    };

    updateLiveMinutes();
    const ticker = setInterval(updateLiveMinutes, 30000);
    return () => clearInterval(ticker);
  }, [result?.registration, liveAttendance, zones]);

  // Get hostname for URL
  const hostname = window.location.hostname;

  // Handle token reissue redirect
  useEffect(() => {
    if (result?.redirectRequired && result.newToken) {
      // Redirect to new token URL
      window.location.href = `https://${hostname}/${slug}/badge-prep/${result.newToken}`;
    }
  }, [result?.redirectRequired, result?.newToken, hostname, slug]);

  // Auto-refresh when badge is issued
  useEffect(() => {
    if (result?.valid && result.tokenStatus === "ACTIVE") {
      // Poll every 10 seconds to check if badge has been issued
      // Reduced polling frequency to prevent server overload
      const interval = setInterval(async () => {
        setRefreshing(true);
        await validateToken();
        setRefreshing(false);
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [result?.valid, result?.tokenStatus, validateToken]);

  if (loading || validating) {
    return (
      <div className="min-h-screen bg-eregi-neutral-50 flex items-center justify-center font-body">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-eregi-primary mx-auto mb-4" />
          <p className="text-xl font-body font-medium text-muted-foreground">데이터 로드 중...</p>
        </div>
      </div>
    );
  }

  if (error || !result?.valid) {
    return (
      <div className="min-h-screen bg-eregi-neutral-50 flex items-center justify-center font-body p-4">
        <div className="max-w-md w-full bg-card rounded-xl shadow-lg p-8 text-center border border-eregi-neutral-100">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-display font-semibold text-foreground mb-3">
            유효하지 않은 링크
          </h1>
          <p className="text-base font-body text-muted-foreground mb-8 leading-relaxed">
            {error || "이 링크는 만료되었거나 유효하지 않습니다."}
          </p>
          <button
            onClick={() => navigate(`/${publicSlug}`)}
            className="inline-block w-full py-3 px-6 bg-eregi-neutral-100 text-foreground font-body font-semibold rounded-xl hover:bg-eregi-neutral-200 transition-colors text-center"
          >
            학술대회 홈페이지로 이동
          </button>
        </div>
      </div>
    );
  }

  // Active → Show Voucher (Temporary)
  if (result.tokenStatus === "ACTIVE" && result.registration) {
    const reg = result.registration;

    return (
      <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.06),_transparent_40%),linear-gradient(180deg,_#f8fafc_0%,_#eef4ff_52%,_#f8fafc_100%)] flex flex-col items-center justify-center p-4 font-body">
        <div className="w-full max-w-sm">
          <div className="mb-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setBadgeLang("ko")}
              className={`rounded-full px-4 py-2 text-sm font-body font-semibold transition-all ${badgeLang === "ko" ? "bg-slate-900 text-white shadow-lg shadow-slate-900/15" : "border border-white/70 bg-white/80 text-slate-600 backdrop-blur hover:bg-white"}`}
            >
              한국어
            </button>
            <button
              type="button"
              onClick={() => setBadgeLang("en")}
              className={`rounded-full px-4 py-2 text-sm font-body font-semibold transition-all ${badgeLang === "en" ? "bg-slate-900 text-white shadow-lg shadow-slate-900/15" : "border border-white/70 bg-white/80 text-slate-600 backdrop-blur hover:bg-white"}`}
            >
              English
            </button>
          </div>
          <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.45)] flex flex-col">
            {/* Header Area */}
            <div className="relative bg-gradient-to-r from-amber-600 via-orange-500 to-amber-500 px-6 pt-6 pb-12 text-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.2),_transparent_28%),linear-gradient(90deg,_transparent,_rgba(255,255,255,0.08),_transparent)]" />
              {refreshing && (
                <div className="absolute top-4 right-4 z-10">
                  <RefreshCw className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
              <div className="relative flex items-start justify-between gap-4">
                <div className="text-left flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/80">
                    Conference Pass
                  </p>
                  <h1 className="mt-2 text-2xl font-display font-semibold tracking-tight break-keep">
                    {t("등록 확인 바우처", "Registration Voucher")}
                  </h1>
                  <p className="mt-2 text-sm text-white/90 break-keep">
                    {t(
                      "현장 등록 데스크에서 확인 후 디지털 명찰로 전환됩니다.",
                      "Present this at the on-site desk to activate your digital badge.",
                    )}
                  </p>
                </div>
                <div className="rounded-full border border-white/20 bg-white/20 p-3 backdrop-blur shrink-0 mt-1">
                  <Clock className="h-5 w-5 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Body Area */}
            <div className="relative px-6 pb-6 -mt-6">
              <div className="rounded-[1.6rem] border border-slate-200/70 bg-white p-6 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] relative z-20">
                <div className="mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                      Status
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {t("명찰 발급 대기 중", "Badge issuance pending")}
                    </p>
                  </div>
                  <FileText className="h-5 w-5 text-slate-400" />
                </div>

                <div className="flex flex-col items-center justify-center text-center">
                  <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-400 break-keep">
                    {reg.affiliation || "-"}
                  </p>
                  <h2 className="mt-3 text-3xl font-display font-semibold tracking-tight text-slate-950">
                    {reg.name}
                  </h2>

                  {reg.licenseNumber && reg.licenseNumber !== "-" && (
                    <div className="mt-4 inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                      {t("면허번호", "License No.")}: {reg.licenseNumber}
                    </div>
                  )}
                </div>

                <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-slate-50/50 p-5">
                  <div className="mb-5 flex flex-col items-center justify-center text-center">
                    <div className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white mb-3">
                      Voucher
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                      Desk QR
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-600 break-keep">
                      {t("인포데스크 제시용 QR 코드", "Show this QR at the info desk")}
                    </p>
                  </div>
                  <div className="mx-auto flex justify-center rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm w-fit">
                    <QRCodeSVG
                      key={voucherQrValue}
                      value={voucherQrValue}
                      size={176}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 text-center">
                  <p className="flex items-center justify-center gap-2 text-sm font-semibold text-amber-900">
                    <User className="h-4 w-4" />
                    {t("현장 안내", "On-site guidance")}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-amber-800 break-keep">
                    {t(
                      "위 QR 코드를 현장 인포데스크에 제시하면 디지털 명찰이 발급됩니다.",
                      "Present the QR code above at the desk to receive your digital badge.",
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Refresh Indicator */}
          {refreshing && (
            <div className="mt-6 flex items-center justify-center gap-2 rounded-full border border-sky-100 bg-white/80 px-5 py-3 text-center text-sm font-body text-sky-800 shadow-sm backdrop-blur">
              <RefreshCw className="w-5 h-5 animate-spin" />
              {t("명찰 발급 상태 확인 중...", "Checking badge issuance...")}
            </div>
          )}

          {/* Home Button */}
          {effectiveMenuVisibility.home && (
            <button
              onClick={() => navigate(`/${publicSlug}`)}
              className="mt-6 block w-full rounded-full border border-slate-200 bg-white/85 px-6 py-4 text-center font-body font-semibold text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-white"
            >
              {getMenuLabel("home", "학술대회 홈페이지로 이동", "Conference Home")}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Issued → Show Digital Badge with Tabbed Interface
  if (result.tokenStatus === "ISSUED" && result.registration) {
    const reg = result.registration;

    // ISSUED BADGE STATE
    return (
      <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.16),_transparent_36%),linear-gradient(180deg,_#eff6ff_0%,_#f8fafc_48%,_#eef2ff_100%)] flex flex-col p-4 font-body">
        <div className="w-full max-w-sm mx-auto flex-1 flex flex-col justify-start sm:justify-center py-4 sm:py-6">
          <div className="mb-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setBadgeLang("ko")}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${badgeLang === "ko" ? "bg-slate-900 text-white shadow-lg shadow-slate-900/15" : "border border-white/70 bg-white/80 text-slate-600 backdrop-blur hover:bg-white"}`}
            >
              한국어
            </button>
            <button
              type="button"
              onClick={() => setBadgeLang("en")}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${badgeLang === "en" ? "bg-slate-900 text-white shadow-lg shadow-slate-900/15" : "border border-white/70 bg-white/80 text-slate-600 backdrop-blur hover:bg-white"}`}
            >
              English
            </button>
          </div>
          
          <div className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/90 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.45)] backdrop-blur flex flex-col">
            <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-eregi-primary to-sky-700 px-6 pb-6 pt-5 text-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.2),_transparent_28%),linear-gradient(90deg,_transparent,_rgba(255,255,255,0.08),_transparent)]" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/70">
                    Conference Badge
                  </p>
                  <h2 className="mt-2 text-[1.75rem] font-display font-semibold tracking-tight">
                    {badgeLang === "en" ? "Digital Badge" : "디지털 명찰"}
                  </h2>
                  <p className="mt-2 text-sm text-white/80">
                    {badgeLang === "en" ? "You can enter/exit with the QR code." : "QR로 입장/퇴장 하실 수 있습니다."}
                  </p>
                </div>
                <div className="rounded-full border border-white/20 bg-white/10 p-3 backdrop-blur">
                  <CheckCircle className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="relative p-6 flex flex-col items-center text-center bg-[linear-gradient(180deg,_rgba(248,250,252,0.92)_0%,_white_100%)]">
              <div className="absolute right-[-18%] top-5 h-36 w-36 rounded-full bg-sky-100/60 blur-2xl" />
              <div className="absolute left-[-20%] bottom-10 h-32 w-32 rounded-full bg-indigo-100/60 blur-2xl" />

              <div className="relative z-10 w-full">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400 break-keep">
                  {reg.affiliation || "-"}
                </p>
                <h3 className="mt-3 text-3xl font-display font-semibold tracking-tight text-slate-950">
                  {reg.name}
                </h3>

                {reg.licenseNumber && reg.licenseNumber !== "-" && (
                  <div className="mx-auto mt-5 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
                    {badgeLang === "en" ? "License" : "면허번호"}: {reg.licenseNumber}
                  </div>
                )}

                <div className="mx-auto mt-6 max-w-[18rem] rounded-[1.8rem] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.5)]">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-400">
                      Access QR
                    </p>
                    <div className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white">
                      Active
                    </div>
                  </div>
                  <div className="mt-4 rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm flex justify-center items-center">
                    <QRCodeSVG
                      key={reg.badgeQr || `BADGE-${reg.id}`}
                      value={reg.badgeQr || `BADGE-${reg.id}`}
                      size={176}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-600 text-center">
                    {badgeLang === "en" ? "You can enter/exit with the QR code." : "QR로 입장/퇴장 하실 수 있습니다."}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200/80 bg-[linear-gradient(180deg,_rgba(248,250,252,0.78)_0%,_rgba(255,255,255,0.98)_100%)] p-3">
              <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList
                  className={`grid w-full h-auto rounded-2xl border border-slate-200 bg-white/90 p-1.5 shadow-sm ${gridColsClass}`}
                >
                  {effectiveMenuVisibility.status && (
                    <TabsTrigger
                      value="status"
                      className="flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                    >
                      <User className="w-4 h-4" />
                      <span className="text-xs font-body font-medium">
                        {getMenuLabel("status", "상태", "Status")}
                      </span>
                    </TabsTrigger>
                  )}
                  {effectiveMenuVisibility.sessions && (
                    <TabsTrigger
                      value="sessions"
                      className="flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                    >
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs font-body font-medium">
                        {getMenuLabel("sessions", "수강", "Sessions")}
                      </span>
                    </TabsTrigger>
                  )}
                  {effectiveMenuVisibility.materials && (
                    <TabsTrigger
                      value="materials"
                      className="flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="text-xs font-body font-medium">
                        {getMenuLabel("materials", "자료", "Materials")}
                      </span>
                    </TabsTrigger>
                  )}
                  {effectiveMenuVisibility.program && (
                    <TabsTrigger
                      value="program"
                      className="flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                    >
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs font-body font-medium">
                        {getMenuLabel("program", "일정", "Program")}
                      </span>
                    </TabsTrigger>
                  )}
                  {translationEnabled && (
                    <TabsTrigger
                      value="translation"
                      className="flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                    >
                      <Languages className="w-4 h-4" />
                      <span className="text-xs font-body font-medium">
                        {getMenuLabel("translation", "번역", "Translation")}
                      </span>
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* Status Tab */}
                {effectiveMenuVisibility.status && (
                  <TabsContent value="status" className="mt-3 p-2 space-y-3">
                  <div
                    className={`py-4 px-5 rounded-lg font-body font-semibold text-center border shadow-sm transition-all ${
                      (liveAttendance?.status || reg.attendanceStatus) ===
                      "INSIDE"
                        ? "bg-gradient-to-br from-emerald-50 via-green-50/80 to-teal-50/60 text-emerald-700 border-emerald-200/70 shadow-emerald-100/50"
                        : "bg-card text-muted-foreground border-eregi-neutral-200"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-3">
                      {(liveAttendance?.status || reg.attendanceStatus) ===
                      "INSIDE" ? (
                        <>
                          <span className="w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
                          <span>입장 완료</span>
                        </>
                      ) : (
                        <>
                          <span className="w-3 h-3 bg-muted-foreground rounded-full" />
                          <span>퇴장 상태</span>
                        </>
                      )}
                    </div>
                  </div>

                  {(liveAttendance?.currentZone || reg.currentZone) &&
                    (liveAttendance?.status || reg.attendanceStatus) ===
                      "INSIDE" && (
                      <div className="bg-blue-50/50 border border-blue-100 rounded-xl py-3 px-4 flex justify-between items-center">
                        <p className="text-xs text-blue-600 font-bold">
                          현재 위치
                        </p>
                        <p className="text-sm font-black text-blue-800 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-blue-500" />
                          {liveAttendance?.currentZone || reg.currentZone}
                        </p>
                      </div>
                    )}

                  {liveMinutes > 0 && (
                    <div className="bg-purple-50/50 border border-purple-100 rounded-xl py-3 px-4 flex justify-between items-center">
                      <div className="flex flex-col text-left">
                        <p className="text-xs text-purple-600 font-bold">
                          인정 수강 시간 (실시간)
                        </p>
                        {(liveAttendance?.status || reg.attendanceStatus) ===
                          "INSIDE" && (
                          <p className="text-[10px] text-purple-400">
                            현재 수강 시간 포함
                          </p>
                        )}
                      </div>
                      <p className="text-sm font-black text-purple-800 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-purple-500" />
                        {Math.floor(liveMinutes / 60)}시간 {liveMinutes % 60}분
                      </p>
                    </div>
                  )}
                  </TabsContent>
                )}

                {/* Sessions Tab */}
                {effectiveMenuVisibility.sessions && (
                  <TabsContent value="sessions" className="mt-2 p-1">
                  <div className="bg-white rounded-2xl py-6 px-4 border border-gray-100 shadow-sm text-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${isCompleted ? "bg-gradient-to-br from-emerald-50 to-green-100/80 text-emerald-600 border-emerald-200 shadow-emerald-100/50" : "bg-gray-100 text-gray-600"}`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <TrendingUp className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 font-bold mb-1 uppercase tracking-wider">
                      Session Progress
                    </p>
                    <p className="text-sm text-gray-500 font-medium mb-4">
                      평점(출결) 이수 현황
                    </p>

                    <div className="flex flex-col items-center gap-1 mb-4">
                      <span
                        className={`text-3xl font-black tracking-tight ${isCompleted ? "text-emerald-600" : "text-gray-900"}`}
                      >
                        {isCompleted ? "이수 완료" : "진행 중"}
                      </span>
                      <span className="text-sm font-bold text-gray-500 mt-2 bg-gray-50 px-4 py-2 rounded-lg">
                        누적 인정 시간:{" "}
                        <span className="text-purple-600">
                          {Math.floor(liveMinutes / 60)}시간 {liveMinutes % 60}
                          분
                        </span>
                      </span>
                    </div>
                  </div>
                  </TabsContent>
                )}

                {/* Materials Tab */}
                {effectiveMenuVisibility.materials && (
                  <TabsContent value="materials" className="mt-2 p-1 space-y-2">
                  {badgeConfig?.materialsUrls &&
                  badgeConfig.materialsUrls.length > 0 ? (
                    badgeConfig.materialsUrls.map((mat, idx: number) => (
                      <a
                        key={idx}
                        href={mat.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center p-4 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl transition-all group"
                      >
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-blue-200 transition-colors">
                          <Download className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-gray-900">
                            {mat.name}
                          </p>
                          <p className="text-xs text-gray-500">자료실 이동</p>
                        </div>
                      </a>
                    ))
                  ) : (
                    <>
                      <a
                        href={`https://${hostname}/${slug}/materials`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center p-4 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl transition-all group"
                      >
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-blue-200 transition-colors">
                          <Download className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-gray-900">
                            강의 자료실
                          </p>
                          <p className="text-xs text-gray-500">
                            발표자료 다운로드
                          </p>
                        </div>
                      </a>
                      <a
                        href={`https://${hostname}/${slug}/abstracts`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center p-4 bg-white hover:bg-purple-50 border border-gray-200 hover:border-purple-200 rounded-xl transition-all group"
                      >
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-purple-200 transition-colors">
                          <FileText className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-gray-900">
                            초록집 (Abstract)
                          </p>
                          <p className="text-xs text-gray-500">
                            학술대회 초록 모음
                          </p>
                        </div>
                      </a>
                    </>
                  )}
                  </TabsContent>
                )}

                {/* Program Tab */}
                {effectiveMenuVisibility.program && (
                  <TabsContent value="program" className="mt-2 p-1">
                  <a
                    href={`https://${hostname}/${slug}/program`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center p-8 bg-white border border-gray-200 rounded-2xl hover:border-amber-300 hover:bg-amber-50 transition-all text-center gap-3"
                  >
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                      <Calendar className="w-8 h-8 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">
                        전체 프로그램 보기
                      </p>
                      <p className="text-sm text-gray-500">
                        Google Calendar / App
                      </p>
                    </div>
                  </a>
                  </TabsContent>
                )}

                {/* Translation Tab */}
                {translationEnabled && (
                  <TabsContent value="translation" className="mt-2 p-1">
                    {badgeConfig?.translationUrl &&
                    badgeConfig.translationUrl.startsWith("http") ? (
                      <a
                        href={badgeConfig.translationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full"
                      >
                        <div className="bg-blue-50 rounded-2xl py-12 px-4 border border-blue-200 text-center hover:bg-blue-100 transition-colors cursor-pointer shadow-sm">
                          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 relative overflow-hidden">
                            <Languages className="w-8 h-8 relative z-10" />
                            <span className="absolute inset-0 bg-blue-400 opacity-20 animate-ping rounded-full" />
                          </div>
                          <p className="text-sm text-blue-900 font-bold mb-1">
                            실시간 번역 서비스 연결
                          </p>
                          <p className="text-xs text-blue-600">
                            클릭하면 번역 서비스로 이동합니다
                          </p>
                        </div>
                      </a>
                    ) : (
                      <TranslationPanel
                        defaultConferenceId={resolveConferenceIdFromRoute(slug)}
                      />
                    )}
                  </TabsContent>
                )}
              </Tabs>
            </div>
          </div>

          {/* Home Button - Floating Bottom aesthetics */}
          {effectiveMenuVisibility.home && (
            <div className="mt-6 text-center">
              <button
                onClick={() => navigate(`/${publicSlug}`)}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/85 px-8 py-3 text-sm font-body font-semibold text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-white"
              >
                {getMenuLabel("home", "학술대회 홈페이지로 이동", "Conference Home")}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default BadgePrepPage;
