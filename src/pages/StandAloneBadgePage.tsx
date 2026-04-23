import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth"; // RAW SDK
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  type Query,
  getDocs,
} from "firebase/firestore"; // RAW SDK
import { useNavigate } from "react-router-dom";
import { SESSION_KEYS } from "../utils/cookie";
import {
  Loader2,
  Clock,
  CheckCircle,
  FileText,
  Calendar,
  Languages,
  Download,
  MapPin,
  TrendingUp,
} from "lucide-react";
import { TranslationPanel } from "../components/translation/TranslationPanel";
import { QnAPanel } from "../components/badge/QnAPanel";
import { CertificateDownloader } from "../components/badge/CertificateDownloader";
import { StampTourPanel } from "../components/badge/StampTourPanel";
import {
  getBadgeDisplayAffiliation,
  getBadgeDisplayName,
  isBadgeIssued,
  type BadgeRecordSource,
} from "../utils/badgeRecord";
import {
  resolveConferenceIdFromRoute,
  resolvePublicSlugFromConferenceId,
} from "../utils/conferenceRoute";
import { getKstToday } from "../utils/dateUtils";
import type {
  AttendanceZone,
  AttendanceSettings,
  BadgeConfig,
  BadgeUiState,
} from "@/types/badge";
import {
  t as tFn,
  formatBadgeMinutes,
  effectiveMenuVisibility,
} from "@/utils/badgeUi";
import {
  UnifiedBadgeView,
} from "../components/badge/UnifiedBadgeView";

const StandAloneBadgePage: React.FC = () => {
  // BUGFIX-20250124: Fixed React error #130 by moving unsubscribeDB to outer scope
  const { slug } = useParams();
  const navigate = useNavigate();
  const db = getFirestore();
  const [status, setStatus] = useState("INIT"); // INIT, LOADING, READY, NO_AUTH, NO_DATA, REDIRECTING
  const [ui, setUi] = useState<BadgeUiState | null>(null);
  const [zones, setZones] = useState<AttendanceZone[]>([]);
  const [liveMinutes, setLiveMinutes] = useState<number>(0);
  const [liveSessionMinutes, setLiveSessionMinutes] = useState<number>(0);
  const [attendanceMode, setAttendanceMode] = useState<
    "DAILY_SEPARATE" | "CUMULATIVE"
  >("DAILY_SEPARATE");
  const [attendanceGoalMinutes, setAttendanceGoalMinutes] = useState<number>(0);
  const [badgeConfig, setBadgeConfig] = useState<BadgeConfig | null>(null);
  const [msg, setMsg] = useState("초기화 중...");
  const [refreshing, setRefreshing] = useState(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const lastQueryRef = useRef<Query | null>(null);
  const lastSourceRef = useRef<BadgeRecordSource | null>(null);
  const [badgeLang, setBadgeLang] = useState<"ko" | "en">("ko");

  const t = useCallback(
    (ko: string, en: string) => tFn(badgeLang, ko, en),
    [badgeLang],
  );

  const formatMinutes = useCallback(
    (minutes: number) => formatBadgeMinutes(badgeLang, minutes),
    [badgeLang],
  );

  // Helper to determine correct confId
  const getConfIdToUse = useCallback(
    (slugVal: string | undefined): string =>
      resolveConferenceIdFromRoute(slugVal),
    [],
  );
  const publicSlug = resolvePublicSlugFromConferenceId(slug);

  useEffect(() => {
    const auth = getAuth();
    const db = getFirestore();

    let unsubscribeDB: (() => void) | null = null; // Track DB subscription in outer scope

    // 1. Listen for Firebase Auth FIRST (for regular members)
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Clean up previous DB listener if user changes
      if (unsubscribeDB) {
        unsubscribeDB();
        unsubscribeDB = null;
      }

      if (user) {
        // Firebase user authenticated - proceed to show badge
        setStatus("LOADING");
        setMsg("?곗씠?곕? 遺덈윭?ㅻ뒗 以묒엯?덈떎...");

        const confIdToUse = getConfIdToUse(slug);

        console.log(
          "[StandAloneBadgePage] Firebase user authenticated, fetching badge:",
          { userId: user.uid, confId: confIdToUse },
        );

        // STRATEGY: Try Regular Registrations FIRST, then External Attendees

        // 1. Define Queries
        const qReg = query(
          collection(db, "conferences", confIdToUse, "registrations"),
          where("userId", "==", user.uid),
          where("paymentStatus", "==", "PAID"),
          orderBy("createdAt", "desc"),
        );

        const qExt = query(
          collection(db, "conferences", confIdToUse, "external_attendees"),
          where("userId", "==", user.uid),
          where("paymentStatus", "==", "PAID"), // Admin created ones are PAID
        );

        // Fetch Zones for real-time break exclusion logic and Badge Config
        import("firebase/firestore").then(async ({ doc, getDoc }) => {
          try {
            const rulesRef = doc(
              db,
              `conferences/${confIdToUse}/settings/attendance`,
            );
            const configRef = doc(
              db,
              `conferences/${confIdToUse}/settings/badge_config`,
            );

            const [rulesSnap, configSnap] = await Promise.all([
              getDoc(rulesRef),
              getDoc(configRef),
            ]);

            if (rulesSnap.exists()) {
              const attendanceSettings = rulesSnap.data() as AttendanceSettings;
              const allRules = attendanceSettings.rules || {};
              const allZones: AttendanceZone[] = [];
              Object.entries(allRules).forEach(([dateStr, rule]) => {
                if (rule && rule.zones) {
                  rule.zones.forEach((z) => {
                    allZones.push({ ...z, ruleDate: dateStr });
                  });
                }
              });
              setZones(allZones);

              const kstToday = new Date().toLocaleDateString("sv-SE", {
                timeZone: "Asia/Seoul",
              });
              const todayRule = allRules[kstToday];
              const ruleEntries = Object.entries(allRules);
              const cumulativeRule =
                ruleEntries.find(
                  ([, r]) =>
                    r?.completionMode === "CUMULATIVE" &&
                    Number(r.cumulativeGoalMinutes || 0) > 0,
                ) ||
                ruleEntries.find(([, r]) => r?.completionMode === "CUMULATIVE");

              const resolvedMode: "DAILY_SEPARATE" | "CUMULATIVE" =
                (cumulativeRule?.[1]?.completionMode as
                  | "DAILY_SEPARATE"
                  | "CUMULATIVE"
                  | undefined) ||
                (todayRule?.completionMode as
                  | "DAILY_SEPARATE"
                  | "CUMULATIVE"
                  | undefined) ||
                "DAILY_SEPARATE";

              const resolvedGoal =
                resolvedMode === "CUMULATIVE"
                  ? Number(
                      cumulativeRule?.[1]?.cumulativeGoalMinutes ||
                        todayRule?.cumulativeGoalMinutes ||
                        0,
                    )
                  : Number(todayRule?.globalGoalMinutes || 0);

              setAttendanceMode(resolvedMode);
              setAttendanceGoalMinutes(resolvedGoal);
            }

            if (configSnap.exists()) {
              setBadgeConfig(configSnap.data());
            }
          } catch (e) {
            console.error("Failed to load rules and badge config", e);
          }
        });

        // 2. Helper to process snapshot data
        const processSnapshot = (
          snap: import("firebase/firestore").QuerySnapshot,
          source: BadgeRecordSource,
        ) => {
          if (snap.empty) {
            // This should only happen if the document was deleted after we found it
            console.log(
              `[StandAloneBadgePage] ${source} registration disappeared`,
            );
            setStatus("NO_DATA");
            setMsg("?깅줉 ?뺣낫媛 ?놁뒿?덈떎.");
            return;
          }

          const d = snap.docs[0].data();
          console.log(`[StandAloneBadgePage] ${source} Registration found:`, d);

          // Common Field Mapping
          const uiName = getBadgeDisplayName(d);
          const uiAff = getBadgeDisplayAffiliation(d);
          const uiId = String(snap.docs[0].id);
          const uiIssued = isBadgeIssued(d, source);

          // External might not have attendanceStatus, default to OUTSIDE
          const uiZone = String(
            d.attendanceStatus === "INSIDE"
              ? d.currentZone || "Inside"
              : "OUTSIDE",
          );
          const uiTime = String(d.totalMinutes || "0");
          const uiLicense = String(
            d.licenseNumber || d.userInfo?.licenseNumber || "-",
          );
          const uiStatus = String(d.attendanceStatus || "OUTSIDE");
          const uiBadgeQr = d.badgeQr || null;
          const uiReceiptNumber = String(d.receiptNumber || "");
          const uiIsCompleted = !!d.isCompleted;
          const lastCheckIn = d.lastCheckIn;
          const baseMinutes = Number(d.totalMinutes || 0);
          const dailyMinutes = d.dailyMinutes as
            | Record<string, number>
            | undefined;
          const zoneMinutes = d.zoneMinutes as
            | Record<string, number>
            | undefined;
          const zoneCompleted = d.zoneCompleted as
            | Record<string, boolean>
            | undefined;

          setUi({
            name: uiName,
            aff: uiAff,
            id: uiId,
            userId: String(d.userId || uiId),
            issued: uiIssued,
            zone: uiZone,
            time: uiTime,
            license: uiLicense,
            status: uiStatus,
            badgeQr: uiBadgeQr,
            receiptNumber: uiReceiptNumber,
            isCompleted: uiIsCompleted,
            lastCheckIn,
            baseMinutes,
            dailyMinutes,
            zoneMinutes,
            zoneCompleted,
            isCheckedIn: !!d.isCheckedIn,
            paymentStatus: String(d.paymentStatus || ""),
            amount: d.amount || 0,
          });
          setLiveMinutes(baseMinutes); // Will be recalculated by the interval if inside
          setLiveSessionMinutes(0);
          setStatus("READY");
          setMsg("");
        };

        // 3. Execution
        try {
          // Check Regular first
          const snapReg = await getDocs(qReg);
          if (!snapReg.empty) {
            console.log("[StandAloneBadgePage] Found in REGISTRATIONS");
            lastQueryRef.current = qReg;
            lastSourceRef.current = "REGULAR";
            unsubscribeDB = onSnapshot(qReg, (snap) =>
              processSnapshot(snap, "REGULAR"),
            );
          } else {
            // Check External
            const snapExt = await getDocs(qExt);
            if (!snapExt.empty) {
              console.log("[StandAloneBadgePage] Found in EXTERNAL_ATTENDEES");
              lastQueryRef.current = qExt;
              lastSourceRef.current = "EXTERNAL";
              unsubscribeDB = onSnapshot(qExt, (snap) =>
                processSnapshot(snap, "EXTERNAL"),
              );
            } else {
              // No data in either
              console.log(
                "[StandAloneBadgePage] No PAID registration found in either collection",
              );
              setStatus("NO_DATA");
              setMsg("?깅줉 ?뺣낫媛 ?놁뒿?덈떎.");
            }
          }
        } catch (err) {
          console.error(
            "[StandAloneBadgePage] Error fetching badge data:",
            err,
          );
          setStatus("NO_DATA");
          setMsg("?곗씠?곕? 遺덈윭?ㅻ뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.");
        }
      } else {
        // No Firebase user - check for non-member session
        const nonMemberSession = sessionStorage.getItem(
          SESSION_KEYS.NON_MEMBER,
        );
        if (nonMemberSession) {
          try {
            const session = JSON.parse(nonMemberSession);
            const currentConfId = session.cid;

            // Verify session is for current conference
            if (!slug) return;

            const confIdToUse = getConfIdToUse(slug);

            // Check if session is for different conference
            if (currentConfId !== confIdToUse) {
              console.log(
                "[StandAloneBadgePage] Session for different conference, redirecting to check-status",
              );
              navigate(`/${publicSlug}/check-status?lang=ko`, {
                replace: true,
              });
              return;
            }

            // For non-members, redirect to NonMemberHubPage which has QR code
            console.log(
              "[StandAloneBadgePage] Non-member detected, redirecting to hub",
              { registrationId: session.registrationId },
            );
            navigate(`/${publicSlug}/non-member/hub`, { replace: true });
            return;
          } catch (err) {
            console.error(
              "[StandAloneBadgePage] Failed to parse non-member session:",
              err,
            );
          }
        } else {
          setStatus("NO_AUTH");
          setMsg("濡쒓렇?몄씠 ?꾩슂?⑸땲??");
        }
      }
    });

    return () => {
      if (unsubscribeDB) unsubscribeDB(); // Clean up DB subscription first
      if (unsubscribeAuth) unsubscribeAuth(); // Then clean up auth subscription
    };
  }, [getConfIdToUse, navigate, publicSlug, slug]);

  // Auto-refresh when badge is NOT issued (voucher state)
  useEffect(() => {
    if (status === "READY" && ui && !ui.issued && lastQueryRef?.current) {
      // Poll every 2 seconds to check if badge has been issued
      // Faster polling for immediate switch after InfoDesk scan
      refreshIntervalRef.current = setInterval(() => {
        const currentQuery = lastQueryRef.current;
        if (!currentQuery) return; // H2 Fix: Safe type guard

        setRefreshing(true);
        getDocs(currentQuery)
          .then((snap) => {
            if (snap.empty || !lastSourceRef.current) return;

            const d = snap.docs[0].data();
            const uiIssued = isBadgeIssued(d, lastSourceRef.current);
            if (!uiIssued) return;

            setUi((prev) => ({
              ...prev!,
              issued: true,
              badgeQr: d.badgeQr || null,
              status: String(d.attendanceStatus || "OUTSIDE"),
              zone: String(
                d.attendanceStatus === "INSIDE"
                  ? d.currentZone || "Inside"
                  : "OUTSIDE",
              ),
              time: String(d.totalMinutes || "0"),
            }));
          })
          .finally(() => {
            setRefreshing(false);
          });
      }, 2000);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      };
    } else if (refreshIntervalRef.current) {
      // Clear interval if badge is issued
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    // ui object excluded to prevent excessive re-runs - only ui?.issued is needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, ui?.issued]);

  // Live Duration Ticker calculation
  useEffect(() => {
    if (!ui || status !== "READY") return;

    const updateLiveMinutes = () => {
      if (ui.status !== "INSIDE" || !ui.lastCheckIn) {
        setLiveMinutes(ui.baseMinutes || 0);
          setLiveSessionMinutes(0);
        return;
      }

      const now = new Date();
      const start = ui.lastCheckIn.toDate
        ? ui.lastCheckIn.toDate()
        : new Date();
      let durationMinutes = 0;
      const currentZoneId = ui.zone;
      const todayStr = getKstToday();
      const zoneRule = zones.find(z => z.id === currentZoneId && z.ruleDate === todayStr) || zones.find((z) => z.id === currentZoneId);
      let deduction = 0;

      let boundedStart = start;
      let boundedEnd = now;

      if (zoneRule && zoneRule.start && zoneRule.end) {
        const localDateStr =
          zoneRule.ruleDate || getKstToday(start);
        const sessionStart = new Date(
          `${localDateStr}T${zoneRule.start}:00+09:00`,
        );
        const sessionEnd = new Date(`${localDateStr}T${zoneRule.end}:00+09:00`);

        if (sessionEnd < sessionStart) {
          sessionEnd.setDate(sessionEnd.getDate() + 1);
        }

        boundedStart = new Date(
          Math.max(start.getTime(), sessionStart.getTime()),
        );
        boundedEnd = new Date(Math.min(now.getTime(), sessionEnd.getTime()));
      }

      if (boundedEnd > boundedStart) {
        durationMinutes = Math.floor(
          (boundedEnd.getTime() - boundedStart.getTime()) / 60000,
        );

        if (zoneRule && zoneRule.breaks && Array.isArray(zoneRule.breaks)) {
          zoneRule.breaks.forEach((brk) => {
            const localDateStr =
              zoneRule.ruleDate || getKstToday(start);
            const breakStart = new Date(
              `${localDateStr}T${brk.start}:00+09:00`,
            );
            const breakEnd = new Date(`${localDateStr}T${brk.end}:00+09:00`);
            
            if (breakEnd < breakStart) {
              breakEnd.setDate(breakEnd.getDate() + 1);
            }

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

      const activeMinutes = Math.max(0, durationMinutes - deduction);
      setLiveSessionMinutes(activeMinutes);
      setLiveMinutes((ui.baseMinutes || 0) + activeMinutes);
    };

    // Run immediately
    updateLiveMinutes();

    // Then run every 30 seconds
    const timer = setInterval(updateLiveMinutes, 30000);
    return () => clearInterval(timer);
  }, [ui, status, zones]);

  useEffect(() => {
    const confIdToUse = getConfIdToUse(slug);
    if (!confIdToUse || !ui?.userId || !ui.issued) {
      return;
    }
  }, [db, getConfIdToUse, slug, ui?.issued, ui?.userId]);
  
  if (msg && status !== "READY")
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center font-sans">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-xl font-medium text-gray-600">{msg}</p>
        </div>
      </div>
    );
  if (!ui)
    return (
      <div className="p-10 text-center flex items-center justify-center min-h-screen">
        {t(
          "명찰 정보를 찾을 수 없습니다.",
          "Badge information is not available.",
        )}
      </div>
    );

  const showBadgeQr = ui.issued;
  const qrValue = showBadgeQr ? ui.badgeQr || `BADGE-${ui.id}` : ui.id;

  const effectiveMenuVis = effectiveMenuVisibility(badgeConfig?.menuVisibility);
  const certificateEnabled = effectiveMenuVis.certificate;

  const todayKey = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Seoul",
  });
  const todayAccumulated =
    (ui?.dailyMinutes?.[todayKey] || 0) +
    (ui?.status === "INSIDE" ? liveSessionMinutes : 0);
  const remainingMinutes =
    attendanceGoalMinutes > 0
      ? Math.max(0, attendanceGoalMinutes - liveMinutes)
      : 0;
  const progressPercent =
    attendanceGoalMinutes > 0
      ? Math.min(100, Math.floor((liveMinutes / attendanceGoalMinutes) * 100))
      : 0;

  const confId = getConfIdToUse(slug);

  return (
    <UnifiedBadgeView
      mode={ui.issued ? "issued" : "voucher"}
      ui={ui}
      menuVis={effectiveMenuVis}
      badgeConfig={badgeConfig}
      badgeLang={badgeLang}
      setBadgeLang={setBadgeLang}
      attendance={ui ? {
        status: ui.status as "INSIDE" | "OUTSIDE",
        currentZone: ui.zone !== "OUTSIDE" ? ui.zone : null,
        isCheckedIn: ui.isCheckedIn,
        paymentStatus: ui.paymentStatus,
        amount: ui.amount,
      } : null}
      liveMinutes={liveMinutes}
      refreshing={refreshing}
      isCompleted={ui.isCompleted}
      voucherQr={qrValue}
      onNavigateHome={() => navigate(`/${publicSlug}`)}
      renderStatusTab={() => (
        <>
          <div
            className={`py-6 px-6 rounded-2xl font-body font-semibold text-center border-2 shadow-lg transition-all relative overflow-hidden ${
              ui.status === "INSIDE"
                ? "bg-gradient-to-br from-emerald-50 via-green-50/80 to-teal-50/60 text-emerald-700 border-emerald-200/70 shadow-emerald-100/50"
                : "bg-gradient-to-br from-slate-50 to-gray-50/80 text-slate-600 border-slate-200/70 shadow-slate-100/50"
            }`}
          >
            {ui.status === "INSIDE" && (
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 via-transparent to-green-400/10 animate-pulse"></div>
            )}
            <div className="flex items-center justify-center gap-3 relative z-10">
              {ui.status === "INSIDE" ? (
                <>
                  <div className="relative">
                    <span className="w-4 h-4 bg-emerald-500 rounded-full flex animate-pulse shadow-lg" />
                    <span className="absolute inset-0 w-4 h-4 bg-emerald-400 rounded-full animate-ping" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-display font-semibold">{t("학술대회 입장중", "Conference Active")}</span>
                    <span className="text-sm opacity-80">{t("출석 인정 중", "Attendance Active")}</span>
                  </div>
                </>
              ) : (
                <>
                  <span className="w-4 h-4 bg-slate-400 rounded-full shadow-md" />
                  <div className="flex flex-col">
                    <span className="text-lg font-display font-semibold">{t("대기중", "Standby")}</span>
                    <span className="text-sm opacity-80">{t("입장 전 상태", "Pre-entry")}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {ui.zone && ui.zone !== "OUTSIDE" && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl py-3 px-4 flex justify-between items-center">
              <p className="text-xs text-blue-600 font-bold">
                {t("현재 구역", "Current zone")}
              </p>
              <p className="text-sm font-black text-blue-800 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-blue-500" />
                {zones.find((z) => z.id === ui.zone)?.name || ui.zone}
              </p>
            </div>
          )}

          {liveMinutes > 0 && (
            <div className="bg-purple-50/50 border border-purple-100 rounded-xl py-3 px-4 flex justify-between items-center">
              <div className="flex flex-col">
                <p className="text-xs text-purple-600 font-bold">
                  {t("누적 체류 시간", "Total attendance time")}
                </p>
                {ui.status === "INSIDE" && (
                  <p className="text-[10px] text-purple-400">
                    {t(
                      "현재 세션 시간이 계속 반영됩니다.",
                      "Current session time is updating live.",
                    )}
                  </p>
                )}
              </div>
              <p className="text-sm font-black text-purple-800 flex items-center gap-1">
                <Clock className="w-3 h-3 text-purple-500" />
                {formatMinutes(liveMinutes)}
              </p>
            </div>
          )}

          {certificateEnabled && (
            <div className="mt-4">
              <CertificateDownloader
                confId={confId}
                ui={ui}
                badgeLang={badgeLang}
              />
            </div>
          )}

          {(attendanceMode === "CUMULATIVE" && attendanceGoalMinutes > 0) && (
            <div className="bg-eregi-primary/5 border border-eregi-primary/10 rounded-xl py-3 px-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-eregi-primary font-body font-semibold">
                  {t("이수 목표 / 남은 시간", "Goal / Remaining")}
                </p>
                <p className="text-xs font-body font-bold text-eregi-primary">
                  {progressPercent}%
                </p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-eregi-primary/10 overflow-hidden">
                <div
                  className="h-full bg-eregi-primary"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between items-center text-sm font-body font-semibold">
                <span className="text-eregi-primary">
                  {formatMinutes(attendanceGoalMinutes)}
                </span>
                <span className="text-gray-500">{t("남음", "Left")}</span>
                <span className="text-gray-900">
                  {formatMinutes(remainingMinutes)}
                </span>
              </div>
            </div>
          )}

          {(attendanceMode === "CUMULATIVE" && (attendanceGoalMinutes > 0 || todayAccumulated > 0)) && (
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl py-3 px-4 flex justify-between items-center">
              <div className="flex flex-col">
                <p className="text-xs text-indigo-700 font-bold">
                  {t("오늘 인정 시간", "Today tracked time")}
                </p>
                {ui.status === "INSIDE" && (
                  <p className="text-[10px] text-indigo-400">
                    {t(
                      "현재 세션 시간이 계속 반영됩니다.",
                      "Current session time is updating live.",
                    )}
                  </p>
                )}
              </div>
              <p className="text-sm font-black text-indigo-900 flex items-center gap-1">
                <Clock className="w-3 h-3 text-indigo-500" />
                {formatMinutes(todayAccumulated)}
              </p>
            </div>
          )}
        </>
      )}
      renderSessionsTab={() => (
        <div className="bg-white rounded-2xl py-6 px-4 border border-gray-100 shadow-sm text-center">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg border-3 transition-all ${ui.isCompleted ? "bg-gradient-to-br from-emerald-50 to-green-100/80 text-emerald-600 border-emerald-200 shadow-emerald-100/50" : "bg-gradient-to-br from-slate-50 to-gray-100/80 text-slate-500 border-slate-200 shadow-slate-100/50"}`}
          >
            {ui.isCompleted ? (
              <CheckCircle className="w-8 h-8 text-emerald-600 drop-shadow-sm" />
            ) : (
              <TrendingUp className="w-8 h-8 text-slate-500" />
            )}
          </div>
          <p className="text-xs text-gray-500 font-bold mb-1 uppercase tracking-wider">
            {t("세션 진행", "Session Progress")}
          </p>
          <p className="text-sm text-gray-500 font-medium mb-4">
            {t(
              "참가자의 출석 진행 상태입니다.",
              "This shows the attendee session progress.",
            )}
          </p>

          <div className="flex flex-col items-center gap-1 mb-4">
            <span
              className={`text-3xl font-display font-semibold tracking-tight ${ui.isCompleted ? "text-eregi-primary" : "text-foreground"}`}
            >
              {ui.isCompleted
                ? t("이수 완료", "Completed")
                : t("진행 중", "In Progress")}
            </span>
            <span className="text-sm font-bold text-gray-500 mt-2 bg-gray-50 px-4 py-2 rounded-lg">
              {t("누적 인정 시간", "Tracked time")}:{" "}
              <span className="text-purple-600">
                {formatMinutes(liveMinutes)}
              </span>
            </span>
            {(attendanceMode === "CUMULATIVE" &&
              attendanceGoalMinutes > 0) && (
              <div className="mt-3 w-full bg-eregi-primary/5 border border-eregi-primary/10 rounded-xl px-4 py-3">
                <div className="flex justify-between items-center text-xs font-body font-semibold text-eregi-primary">
                  <span>
                    {t("목표", "Goal")}:{" "}
                    {formatMinutes(attendanceGoalMinutes)}
                  </span>
                  <span>
                    {t("남은 시간", "Remaining")}:{" "}
                    {formatMinutes(remainingMinutes)}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-eregi-primary/10 overflow-hidden">
                  <div
                    className="h-full bg-eregi-primary"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      renderMaterialsTab={() =>
        badgeConfig?.materialsUrls &&
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
                <p className="text-xs text-gray-500">
                  {t(
                    "자료를 새 창에서 엽니다.",
                    "Open material in a new window.",
                  )}
                </p>
              </div>
            </a>
          ))
        ) : (
          <>
            <a
              href={`/${slug}/materials`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center p-4 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl transition-all group"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-blue-200 transition-colors">
                <Download className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-gray-900">
                  {t("강의 자료집", "Lecture materials")}
                </p>
                <p className="text-xs text-gray-500">
                  {t(
                    "발표 자료를 확인할 수 있습니다.",
                    "Open presentation materials.",
                  )}
                </p>
              </div>
            </a>
            <a
              href={`/${slug}/abstracts`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center p-4 bg-white hover:bg-purple-50 border border-gray-200 hover:border-purple-200 rounded-xl transition-all group"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-purple-200 transition-colors">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-gray-900">
                  {t("초록집", "Abstract book")}
                </p>
                <p className="text-xs text-gray-500">
                  {t(
                    "초록 자료를 확인할 수 있습니다.",
                    "Open the abstract book.",
                  )}
                </p>
              </div>
            </a>
          </>
        )
      }
      renderProgramTab={() => (
        <a
          href={`/${slug}/program`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center p-8 bg-white border border-gray-200 rounded-2xl hover:border-amber-300 hover:bg-amber-50 transition-all text-center gap-3"
        >
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
            <Calendar className="w-8 h-8 text-amber-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">
              {t("프로그램 일정 보기", "Open program schedule")}
            </p>
            <p className="text-sm text-gray-500">
              Google Calendar / App
            </p>
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
                {t(
                  "실시간 번역 서비스 연결",
                  "Real-time Translation",
                )}
              </p>
              <p className="text-xs text-blue-600">
                {t(
                  "클릭하면 번역 서비스로 이동합니다",
                  "Click to open translation service",
                )}
              </p>
            </div>
          </a>
        ) : (
          <TranslationPanel
            defaultConferenceId={getConfIdToUse(slug)}
          />
        )
      }
      renderStampTourTab={() => (
        <StampTourPanel
          confId={getConfIdToUse(slug)}
          userId={ui.userId}
          userName={ui.name}
          userAff={ui.aff}
          badgeLang={badgeLang}
        />
      )}
      renderQnATab={() => (
        <QnAPanel
          confId={getConfIdToUse(slug)}
          userId={ui.userId}
          userName={ui.name}
          userAff={ui.aff}
          badgeLang={badgeLang}
        />
      )}
    />
  );
};

export default StandAloneBadgePage;
