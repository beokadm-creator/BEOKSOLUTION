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
      const zoneRule = zones.find((z) => z.id === currentZoneId);
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
      <div className="min-h-screen bg-eregi-neutral-50 flex flex-col items-center justify-center p-4 font-body">
        <div className="w-full max-w-sm">
          <div className="mb-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setBadgeLang("ko")}
              className={`rounded-full px-4 py-2 text-sm font-body font-semibold transition-colors ${badgeLang === "ko" ? "bg-eregi-primary text-eregi-primary-foreground" : "bg-card text-muted-foreground border border-eregi-neutral-200 hover:bg-eregi-neutral-50"}`}
            >
              한국어
            </button>
            <button
              type="button"
              onClick={() => setBadgeLang("en")}
              className={`rounded-full px-4 py-2 text-sm font-body font-semibold transition-colors ${badgeLang === "en" ? "bg-eregi-primary text-eregi-primary-foreground" : "bg-card text-muted-foreground border border-eregi-neutral-200 hover:bg-eregi-neutral-50"}`}
            >
              English
            </button>
          </div>
          {/* Temporary Voucher Card - Academic Elegance Design */}
          <div className="bg-card border-2 border-eregi-primary/20 rounded-xl p-6 text-center shadow-lg relative overflow-hidden">
            {refreshing && (
              <div className="absolute top-4 right-4 z-10">
                <RefreshCw className="w-5 h-5 text-eregi-primary animate-spin" />
              </div>
            )}

            {/* Pending Badge Indicator - Top Banner */}
            <div className="absolute top-0 left-0 right-0 bg-eregi-primary/10 border-b border-eregi-primary/20 py-3 px-4">
              <div className="flex items-center justify-center gap-2 text-eregi-primary">
                <Clock className="w-4 h-4 animate-pulse" />
                <span className="text-sm font-body font-semibold tracking-wide">
                  명찰 발급 대기 중
                </span>
              </div>
            </div>

            {/* Watermark Background */}
            <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none mt-12">
              <div className="text-6xl font-display font-semibold text-muted-foreground/50 transform -rotate-12">
                VOUCHER
              </div>
            </div>

            {/* Content Container - Relative to sit above watermark */}
            <div className="relative z-10 mt-12">
              {/* Header with Icon */}
              <div className="mb-6">
                <div className="w-16 h-16 bg-eregi-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-eregi-primary" />
                </div>
                <h1 className="text-xl font-display font-semibold mb-2 tracking-wide text-eregi-primary">
                  {t("등록 확인 바우처", "Registration Voucher")}
                </h1>
                <p className="text-sm font-body font-medium text-muted-foreground tracking-wide">
                  {t("현장에서 디지털 명찰을 발급받으세요", "Get your digital badge on-site")}
                </p>
              </div>

              {/* Warning Notice */}
              <div className="bg-eregi-primary/5 border border-eregi-primary/20 rounded-xl py-3 px-4 mb-6">
                <p className="text-sm font-body font-medium text-eregi-primary leading-relaxed">
                  💡 현장 인포데스크에서 아래 QR코드를 제시하여 디지털 명찰을 발급받으세요
                </p>
              </div>

              {/* Organization */}
              <p className="text-base font-body font-medium text-muted-foreground mb-2">
                {reg.affiliation || "-"}
              </p>

              {/* Name */}
              <h2 className="text-3xl font-display font-semibold text-foreground mb-6 tracking-tight">
                {reg.name}
              </h2>

              <div className="bg-eregi-primary/5 border border-eregi-primary/20 rounded-xl py-4 px-5 mb-6">
                <div className="flex flex-col items-center">
                  <p className="text-sm font-body font-medium text-eregi-primary mb-1">
                    등록 번호
                  </p>
                  <p className="text-xl font-display font-semibold text-eregi-primary tracking-wider">
                    {reg.receiptNumber}
                  </p>
                </div>
              </div>

              {/* License Number */}
              {reg.licenseNumber && reg.licenseNumber !== "-" && (
                <div className="bg-eregi-neutral-50 border border-eregi-neutral-200 rounded-lg py-3 px-4 mb-6">
                  <p className="text-sm font-body font-medium text-muted-foreground mb-1">
                    면허번호
                  </p>
                  <p className="text-base font-body font-semibold text-foreground">
                    {reg.licenseNumber}
                  </p>
                </div>
              )}

              {/* QR Code - The Main Element */}
              <div className="bg-card p-5 inline-block rounded-xl shadow-md border border-eregi-neutral-200 mb-6">
                <div className="text-sm font-body font-medium text-muted-foreground mb-3 text-center">
                  인포데스크 제시용 QR 코드
                </div>
                <QRCodeSVG
                  key={voucherQrValue}
                  value={voucherQrValue}
                  size={160}
                  level="M"
                  includeMargin={false}
                />
              </div>

              {/* Instruction */}
              <div className="bg-eregi-primary/10 border border-eregi-primary/20 rounded-xl py-4 px-5">
                <p className="text-base font-body font-semibold text-eregi-primary flex items-center justify-center gap-2 mb-2">
                  <User className="w-5 h-5" />
                  현장 안내
                </p>
                <p className="text-sm font-body text-eregi-primary/80 leading-relaxed text-center">
                  위 QR 코드를 현장 인포데스크에 제시하면 디지털 명찰을 발급받을 수 있습니다
                </p>
              </div>
            </div>
          </div>

          {/* Refresh Indicator */}
          {refreshing && (
            <div className="mt-6 text-center text-base font-body text-eregi-primary flex items-center justify-center gap-2 bg-card/90 rounded-lg py-3 px-5 border border-eregi-neutral-200">
              <RefreshCw className="w-5 h-5 animate-spin" />
              명찰 발급 상태 확인 중...
            </div>
          )}

          {/* Home Button */}
          {effectiveMenuVisibility.home && (
            <button
              onClick={() => navigate(`/${publicSlug}`)}
              className="block w-full mt-6 py-4 px-6 bg-card text-eregi-primary font-body font-semibold rounded-xl hover:bg-eregi-neutral-50 transition-colors text-center border border-eregi-neutral-200 shadow-sm"
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
      <div className="min-h-[100dvh] bg-slate-50 flex flex-col p-4 font-body">
        <div className="w-full max-w-sm mx-auto flex-1 flex flex-col justify-start sm:justify-center py-4 sm:py-6">
          <div className="mb-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setBadgeLang("ko")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${badgeLang === "ko" ? "bg-slate-800 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"}`}
            >
              한국어
            </button>
            <button
              type="button"
              onClick={() => setBadgeLang("en")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${badgeLang === "en" ? "bg-slate-800 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"}`}
            >
              English
            </button>
          </div>
          
          {/* Digital Badge Card - Clean Modern Design */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
            {/* Clean Badge Header */}
            <div className="bg-slate-800 py-4 px-6 text-center">
              <span className="text-base font-semibold text-white tracking-wide">
                {badgeLang === "en" ? "Digital Badge" : "디지털 명찰"}
              </span>
            </div>

            {/* Badge Info - Main Content */}
            <div className="p-6 flex flex-col items-center text-center">
              {/* Affiliation */}
              <p className="text-sm font-medium text-slate-500 mb-2 break-keep leading-tight px-4 max-w-xs">
                {reg.affiliation || "-"}
              </p>

              {/* Name */}
              <h2 className="text-2xl font-bold text-slate-900 mb-5 tracking-tight">
                {reg.name}
              </h2>

              {/* License Number Chip */}
              {reg.licenseNumber && reg.licenseNumber !== "-" && (
                <div className="bg-slate-100 text-slate-700 rounded-md py-1.5 px-4 mb-6 inline-flex items-center">
                  <span className="text-xs font-semibold">
                    {badgeLang === "en" ? "License:" : "면허번호:"} {reg.licenseNumber}
                  </span>
                </div>
              )}

              {/* QR Code Container */}
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-4 flex flex-col items-center justify-center">
                <QRCodeSVG
                  key={reg.badgeQr || `BADGE-${reg.id}`}
                  value={reg.badgeQr || `BADGE-${reg.id}`}
                  size={160}
                  level="H"
                  includeMargin={true}
                />
                <div className="h-px w-full bg-slate-100 my-4"></div>
                <p className="text-xs font-bold text-slate-400 tracking-widest">
                  ACCESS CODE
                </p>
              </div>
              <p className="text-sm font-medium text-slate-600">
                {badgeLang === "en" ? "Scan this QR code at the kiosk" : "출입 시 위 QR코드를 스캔하세요"}
              </p>
            </div>

            {/* Tabbed Interface */}
            <div className="bg-slate-50 border-t border-slate-100 p-3">
              <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList
                  className={`grid w-full h-auto p-1 bg-white border border-slate-200 shadow-sm rounded-lg ${gridColsClass}`}
                >
                  {effectiveMenuVisibility.status && (
                    <TabsTrigger
                      value="status"
                      className="flex flex-col items-center justify-center py-3 px-1 gap-1 data-[state=active]:bg-eregi-primary/10 data-[state=active]:text-eregi-primary rounded-md transition-all"
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
                      className="flex flex-col items-center justify-center py-3 px-1 gap-1 data-[state=active]:bg-eregi-primary/10 data-[state=active]:text-eregi-primary rounded-md transition-all"
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
                      className="flex flex-col items-center justify-center py-3 px-1 gap-1 data-[state=active]:bg-eregi-primary/10 data-[state=active]:text-eregi-primary rounded-md transition-all"
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
                      className="flex flex-col items-center justify-center py-3 px-1 gap-1 data-[state=active]:bg-eregi-primary/10 data-[state=active]:text-eregi-primary rounded-md transition-all"
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
                      className="flex flex-col items-center justify-center py-3 px-1 gap-1 data-[state=active]:bg-eregi-primary/10 data-[state=active]:text-eregi-primary rounded-md transition-all"
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
                className="inline-flex items-center justify-center py-3 px-8 bg-white/80 backdrop-blur-sm text-eregi-primary font-body font-semibold rounded-full hover:bg-white transition-colors border border-eregi-primary/20 shadow-sm text-sm"
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
