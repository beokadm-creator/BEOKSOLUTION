import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { getFunctions } from "firebase/functions";
import { getKstToday } from "../utils/dateUtils";
import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  type DocumentData,
  type DocumentSnapshot,
} from "firebase/firestore";
import {
  AlertCircle,
  Loader2,
  Clock,
  FileText,
  Calendar,
  Languages,
  Download,
  MapPin,
  TrendingUp,
  CheckCircle,
} from "lucide-react";
import { QnAPanel } from "../components/badge/QnAPanel";
import { CertificateDownloader } from "../components/badge/CertificateDownloader";
import {
  UnifiedBadgeView,
  type AttendanceData,
} from "../components/badge/UnifiedBadgeView";
import {
  resolveConferenceIdFromRoute,
  resolvePublicSlugFromConferenceId,
} from "../utils/conferenceRoute";
import { getBadgeDisplayName, getBadgeDisplayAffiliation } from "../utils/badgeRecord";
import { TranslationPanel } from "../components/translation/TranslationPanel";
import type {
  AttendanceZone,
  AttendanceSettings,
  BadgeConfig,
  BadgeUiState,
} from "@/types/badge";
import { effectiveMenuVisibility as computeEffectiveMenuVisibility } from "@/utils/badgeUi";

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
    isCheckedIn?: boolean;
    paymentStatus?: string;
    userId?: string;
    orderId?: string;
    sessionsCompleted?: number;
    sessionsTotal?: number;
    conference?: {
      name: string;
      dates: {
        start: { toDate?: () => Date } | null;
        end: { toDate?: () => Date } | null;
      };
      venue: { name?: string } | null;
    };
  };
}

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

  const getConfIdToUse = useCallback(
    (slugVal: string | undefined): string =>
      resolveConferenceIdFromRoute(slugVal),
    [],
  );

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

  useEffect(() => {
    requestAnimationFrame(() => {
      validateToken();
    });
  }, [validateToken]);

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

  const [liveAttendance, setLiveAttendance] = useState<AttendanceData | null>(null);

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
          currentZone: d.currentZone || null,
          isCheckedIn: !!d.isCheckedIn,
          paymentStatus: String(d.paymentStatus || ""),
          amount: d.amount || 0,
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

  useEffect(() => {
    const reg = result?.registration;
    if (!reg) return;

    const updateLiveMinutes = () => {
      const status = liveAttendance
        ? liveAttendance.status
        : reg.attendanceStatus;
      const baseMinutes = liveAttendance
        ? 0
        : reg.totalMinutes || 0;
      const currentCheckIn = reg.lastCheckIn;
      const currentZoneId = liveAttendance
        ? liveAttendance.currentZone
        : reg.currentZone;

      if (status !== "INSIDE" || !currentCheckIn) {
        setLiveMinutes(baseMinutes);
        return;
      }

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

  const hostname = window.location.hostname;

  useEffect(() => {
    if (result?.redirectRequired && result.newToken) {
      window.location.href = `https://${hostname}/${slug}/badge-prep/${result.newToken}`;
    }
  }, [result?.redirectRequired, result?.newToken, hostname, slug]);

  useEffect(() => {
    if (result?.valid && result.tokenStatus === "ACTIVE") {
      const interval = setInterval(async () => {
        setRefreshing(true);
        await validateToken();
        setRefreshing(false);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [result?.valid, result?.tokenStatus, validateToken]);

  const voucherQrValue = useMemo(() => {
    if (!result?.registration) return "";
    return result.registration.confirmationQr || result.registration.id || "";
  }, [result?.registration]);

  const effectiveMenuVis = computeEffectiveMenuVisibility(badgeConfig?.menuVisibility);
  const certificateEnabled = effectiveMenuVis.certificate;

  const buildBadgeUiState = useCallback((): BadgeUiState => {
    const reg = result?.registration;
    if (!reg) {
      return {
        name: "",
        aff: "",
        id: "",
        userId: "",
        issued: false,
        status: "OUTSIDE",
        badgeQr: null,
      };
    }
    return {
      name: getBadgeDisplayName(reg),
      aff: getBadgeDisplayAffiliation(reg),
      id: String(reg.id),
      userId: String(reg.userId || reg.id),
      issued: !!reg.badgeIssued || !!reg.badgeQr,
      status: liveAttendance?.status || reg.attendanceStatus || "OUTSIDE",
      badgeQr: reg.badgeQr || null,
      receiptNumber: String(reg.receiptNumber || reg.orderId || "-"),
      isCheckedIn: liveAttendance?.isCheckedIn ?? !!reg.isCheckedIn,
      paymentStatus: liveAttendance?.paymentStatus ?? String(reg.paymentStatus || ""),
      amount: liveAttendance?.amount ?? (reg.amount || 0),
      license: String(reg.licenseNumber || "-"),
    };
  }, [result?.registration, liveAttendance]);

  const confId = useMemo(() => getConfIdToUse(slug), [slug, getConfIdToUse]);
  const reg = result?.registration;

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
            {error || "이 링크은 만료되었거나 유효하지 않습니다."}
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

  if (!reg) return null;

  const attendanceStatus = liveAttendance?.status || reg.attendanceStatus;
  const currentZone = liveAttendance?.currentZone || reg.currentZone;
  const isCheckedIn = liveAttendance?.isCheckedIn ?? !!reg.isCheckedIn;
  const paymentStatus = liveAttendance?.paymentStatus ?? String(reg.paymentStatus || "");
  const amount = liveAttendance?.amount ?? (reg.amount || 0);

  return (
    <UnifiedBadgeView
      mode={result.tokenStatus === "ISSUED" ? "issued" : "voucher"}
      ui={buildBadgeUiState()}
      menuVis={effectiveMenuVis}
      badgeConfig={badgeConfig}
      badgeLang={badgeLang}
      setBadgeLang={setBadgeLang}
      attendance={liveAttendance}
      liveMinutes={liveMinutes}
      refreshing={refreshing}
      isCompleted={isCompleted}
      voucherQr={voucherQrValue}
      onNavigateHome={() => navigate(`/${publicSlug}`)}
      renderStatusTab={() => (
        <>
          <div
            className={`py-4 px-5 rounded-lg font-body font-semibold text-center border shadow-sm transition-all ${
              attendanceStatus === "INSIDE"
                ? "bg-gradient-to-br from-emerald-50 via-green-50/80 to-teal-50/60 text-emerald-700 border-emerald-200/70 shadow-emerald-100/50"
                : "bg-card text-muted-foreground border-eregi-neutral-200"
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              {attendanceStatus === "INSIDE" ? (
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

          {currentZone && attendanceStatus === "INSIDE" && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl py-3 px-4 flex justify-between items-center">
              <p className="text-xs text-blue-600 font-bold">현재 위치</p>
              <p className="text-sm font-black text-blue-800 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-blue-500" />
                {currentZone}
              </p>
            </div>
          )}

          {liveMinutes > 0 && (
            <div className="bg-purple-50/50 border border-purple-100 rounded-xl py-3 px-4 flex justify-between items-center">
              <div className="flex flex-col text-left">
                <p className="text-xs text-purple-600 font-bold">인정 수강 시간 (실시간)</p>
                {attendanceStatus === "INSIDE" && (
                  <p className="text-[10px] text-purple-400">현재 수강 시간 포함</p>
                )}
              </div>
              <p className="text-sm font-black text-purple-800 flex items-center gap-1">
                <Clock className="w-3 h-3 text-purple-500" />
                {Math.floor(liveMinutes / 60)}시간 {liveMinutes % 60}분
              </p>
            </div>
          )}

          {certificateEnabled && (
            <div className="mt-4">
              <CertificateDownloader
                confId={confId}
                ui={{
                  name: getBadgeDisplayName(reg),
                  aff: getBadgeDisplayAffiliation(reg),
                  id: String(reg.id),
                  userId: String(reg.userId || reg.id),
                  issued: true,
                  status: attendanceStatus,
                  badgeQr: reg.badgeQr || null,
                  receiptNumber: String(reg.receiptNumber || reg.orderId || "-"),
                  isCheckedIn,
                  paymentStatus,
                  amount,
                  license: String(reg.licenseNumber || "-"),
                }}
                badgeLang={badgeLang}
                badgeToken={token}
              />
            </div>
          )}
        </>
      )}
      renderSessionsTab={() => (
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
                {Math.floor(liveMinutes / 60)}시간 {liveMinutes % 60}분
              </span>
            </span>
          </div>
        </div>
      )}
      renderMaterialsTab={() =>
        badgeConfig?.materialsUrls && badgeConfig.materialsUrls.length > 0 ? (
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
                <p className="text-sm font-bold text-gray-900">{mat.name}</p>
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
                <p className="text-sm font-bold text-gray-900">강의 자료실</p>
                <p className="text-xs text-gray-500">발표자료 다운로드</p>
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
                <p className="text-sm font-bold text-gray-900">초록집 (Abstract)</p>
                <p className="text-xs text-gray-500">학술대회 초록 모음</p>
              </div>
            </a>
          </>
        )
      }
      renderProgramTab={() => (
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
            <p className="text-lg font-bold text-gray-900">전체 프로그램 보기</p>
            <p className="text-sm text-gray-500">Google Calendar / App</p>
          </div>
        </a>
      )}
      renderTranslationTab={() =>
        badgeConfig?.translationUrl &&
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
        )
      }
      renderQnATab={() => (
        <QnAPanel
          confId={confId}
          userId={reg.userId || String(reg.id)}
          userName={getBadgeDisplayName(reg)}
          userAff={getBadgeDisplayAffiliation(reg)}
          badgeLang={badgeLang}
        />
      )}
    />
  );
};

export default BadgePrepPage;
