import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
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
import toast from "react-hot-toast";
import { SESSION_KEYS } from "@/utils/cookie";
import {
  getBadgeDisplayAffiliation,
  getBadgeDisplayName,
  isBadgeIssued,
  type BadgeRecordSource,
} from "@/utils/badgeRecord";
import {
  resolveConferenceIdFromRoute,
  resolvePublicSlugFromConferenceId,
} from "@/utils/conferenceRoute";
import { getKstToday } from "@/utils/dateUtils";
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

export const useStandAloneBadge = (slug: string | undefined) => {
  const navigate = useNavigate();

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
        setMsg("사용자 인증을 확인하고 있습니다...");

        const confIdToUse = getConfIdToUse(slug);

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
            toast.error('명찰 설정을 불러오지 못했습니다.');
          }
        });

        // 2. Helper to process snapshot data
        const processSnapshot = (
          snap: import("firebase/firestore").QuerySnapshot,
          source: BadgeRecordSource,
        ) => {
          if (snap.empty) {
            // This should only happen if the document was deleted after we found it
            setStatus("NO_DATA");
            setMsg("등록 정보를 찾을 수 없습니다.");
            return;
          }

          const d = snap.docs[0].data();

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
            position: String(d.position || d.userInfo?.position || ""),
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
            lastQueryRef.current = qReg;
            lastSourceRef.current = "REGULAR";
            unsubscribeDB = onSnapshot(qReg, (snap) =>
              processSnapshot(snap, "REGULAR"),
            );
          } else {
            // Check External
            const snapExt = await getDocs(qExt);
            if (!snapExt.empty) {
              lastQueryRef.current = qExt;
              lastSourceRef.current = "EXTERNAL";
              unsubscribeDB = onSnapshot(qExt, (snap) =>
                processSnapshot(snap, "EXTERNAL"),
              );
            } else {
              // No data in either
              setStatus("NO_DATA");
              setMsg("등록 정보를 찾을 수 없습니다.");
            }
          }
        } catch (err) {
          console.error(
            "[StandAloneBadgePage] Error fetching badge data:",
            err,
          );
          setStatus("NO_DATA");
          setMsg("사용자 인증에 문제가 발생했습니다.");
          toast.error('명찰 데이터를 불러오지 못했습니다.');
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
              navigate(`/${publicSlug}/check-status?lang=ko`, {
                replace: true,
              });
              return;
            }

            // For non-members, redirect to NonMemberHubPage which has QR code
            navigate(`/${publicSlug}/non-member/hub`, { replace: true });
            return;
          } catch (err) {
            console.error(
              "[StandAloneBadgePage] Failed to parse non-member session:",
              err,
            );
            toast.error('세션 정보를 불러오지 못했습니다.');
          }
        } else {
          setStatus("NO_AUTH");
          setMsg("로그인이 필요합니다.");
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

  // Computed values
  const showBadgeQr = ui?.issued ?? false;
  const qrValue = showBadgeQr ? (ui?.badgeQr || `BADGE-${ui?.id}`) : (ui?.id || "");
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

  return {
    // State
    status,
    ui,
    zones,
    liveMinutes,
    liveSessionMinutes,
    attendanceMode,
    attendanceGoalMinutes,
    badgeConfig,
    msg,
    refreshing,
    badgeLang,

    // State setter
    setBadgeLang,

    // Helper functions
    t,
    formatMinutes,
    getConfIdToUse,

    // Computed values
    showBadgeQr,
    qrValue,
    effectiveMenuVis,
    certificateEnabled,
    todayKey,
    todayAccumulated,
    remainingMinutes,
    progressPercent,
    confId,

    // Navigation
    navigate,
    publicSlug,
  };
};
