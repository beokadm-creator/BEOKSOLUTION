import React, {
  useCallback,
  useEffect,
  useMemo,
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
  doc,
  getDoc,
} from "firebase/firestore"; // RAW SDK
import { httpsCallable } from "firebase/functions";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";
import { SESSION_KEYS } from "../utils/cookie";
import {
  RefreshCw,
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
  Sparkles,
  Gift,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { TranslationPanel } from "../components/translation/TranslationPanel";
import { functions } from "../firebase";
import { getStampMissionTargetCount } from "../utils/stampTour";
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

type TimestampLike = {
  toDate: () => Date;
};

type ZoneBreak = {
  start: string;
  end: string;
};

type AttendanceZone = {
  id: string;
  name?: string;
  goalMinutes?: number;
  start?: string;
  end?: string;
  breaks?: ZoneBreak[];
  ruleDate?: string;
};

type AttendanceRule = {
  zones?: Array<Omit<AttendanceZone, "ruleDate">>;
  completionMode?: "DAILY_SEPARATE" | "CUMULATIVE";
  globalGoalMinutes?: number;
  cumulativeGoalMinutes?: number;
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

type BadgeUiState = {
  name: string;
  aff: string;
  id: string;
  userId: string;
  issued: boolean;
  zone: string;
  time: string;
  license: string;
  status: string;
  badgeQr: string | null;
  receiptNumber?: string;
  isCompleted?: boolean;
  lastCheckIn?: TimestampLike;
  baseMinutes?: number;
  dailyMinutes?: Record<string, number>;
  zoneMinutes?: Record<string, number>;
  zoneCompleted?: Record<string, boolean>;
};

type StampTourConfig = {
  enabled: boolean;
  completionRule: { type: "COUNT" | "ALL"; requiredCount?: number };
  boothOrderMode: "SPONSOR_ORDER" | "CUSTOM";
  customBoothOrder?: string[];
  rewardMode: "RANDOM" | "FIXED";
  drawMode?: "PARTICIPANT" | "ADMIN" | "BOTH";
  rewardFulfillmentMode?: "INSTANT" | "LOTTERY";
  lotteryScheduledAt?: TimestampLike;
  rewards: Array<{
    id: string;
    name: string;
    imageUrl?: string;
    remainingQty?: number;
    totalQty?: number;
    weight?: number;
    order?: number;
  }>;
  soldOutMessage?: string;
  completionMessage?: string;
};

type StampProgress = {
  rewardStatus?: "NONE" | "REQUESTED" | "REDEEMED";
  lotteryStatus?: "PENDING" | "SELECTED" | "NOT_SELECTED";
  rewardName?: string;
  isCompleted?: boolean;
  completedAt?: TimestampLike;
};
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
  const [stampConfig, setStampConfig] = useState<StampTourConfig | null>(null);
  const [stampBoothCandidates, setStampBoothCandidates] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [myStamps, setMyStamps] = useState<string[]>([]);
  const [stampProgress, setStampProgress] = useState<StampProgress>({});
  const [guestbookEntries, setGuestbookEntries] = useState<
    Array<{ vendorName: string; message?: string }>
  >([]);
  const [rewardRequesting, setRewardRequesting] = useState(false);
  const [rewardMessage, setRewardMessage] = useState("");
  const [rewardAnimationOpen, setRewardAnimationOpen] = useState(false);
  const [msg, setMsg] = useState("珥덇린??以?..");
  const [refreshing, setRefreshing] = useState(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const lastQueryRef = useRef<Query | null>(null);
  const lastSourceRef = useRef<BadgeRecordSource | null>(null);
  const [badgeLang, setBadgeLang] = useState<"ko" | "en">("ko");

  const t = useCallback(
    (ko: string, en: string) => (badgeLang === "ko" ? ko : en),
    [badgeLang],
  );

  const formatMinutes = useCallback(
    (minutes: number) =>
      badgeLang === "ko"
        ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`
        : `${Math.floor(minutes / 60)}h ${minutes % 60}m`,
    [badgeLang],
  );

  const getMenuLabel = useCallback(
    (
      key: keyof NonNullable<BadgeConfig["menuLabels"]>,
      fallbackKo: string,
      fallbackEn: string,
    ) => {
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
      const zoneRule = zones.find((z) => z.id === currentZoneId);
      let deduction = 0;

      let boundedStart = start;
      let boundedEnd = now;

      if (zoneRule && zoneRule.start && zoneRule.end) {
        const kstMs = start.getTime() + 9 * 60 * 60 * 1000;
        const localDateStr =
          zoneRule.ruleDate || new Date(kstMs).toISOString().split("T")[0];
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
        durationMinutes = Math.floor(
          (boundedEnd.getTime() - boundedStart.getTime()) / 60000,
        );

        if (zoneRule && zoneRule.breaks && Array.isArray(zoneRule.breaks)) {
          zoneRule.breaks.forEach((brk) => {
            const kstMs = start.getTime() + 9 * 60 * 60 * 1000;
            const localDateStr =
              zoneRule.ruleDate || new Date(kstMs).toISOString().split("T")[0];
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
      setStampConfig(null);
      setStampBoothCandidates([]);
      setMyStamps([]);
      setStampProgress({});
      setGuestbookEntries([]);
      return;
    }

    let unsubscribeStamps: (() => void) | null = null;
    let unsubscribeProgress: (() => void) | null = null;

    const loadStampTour = async () => {
      try {
        const [configSnap, sponsorsSnap] = await Promise.all([
          getDoc(doc(db, `conferences/${confIdToUse}/settings/stamp_tour`)),
          getDocs(
            query(
              collection(db, `conferences/${confIdToUse}/sponsors`),
              where("isStampTourParticipant", "==", true),
            ),
          ),
        ]);

        if (configSnap.exists()) {
          const configData = configSnap.data() as Partial<StampTourConfig>;
          setStampConfig({
            enabled: configData.enabled === true,
            completionRule: configData.completionRule || {
              type: "COUNT",
              requiredCount: 5,
            },
            boothOrderMode: configData.boothOrderMode || "SPONSOR_ORDER",
            customBoothOrder: configData.customBoothOrder || [],
            rewardMode: configData.rewardMode || "RANDOM",
            drawMode: configData.drawMode || "PARTICIPANT",
            rewardFulfillmentMode:
              configData.rewardFulfillmentMode || "INSTANT",
            lotteryScheduledAt: configData.lotteryScheduledAt,
            rewards: Array.isArray(configData.rewards)
              ? configData.rewards
              : [],
            soldOutMessage: configData.soldOutMessage,
            completionMessage: configData.completionMessage,
          });
        } else {
          setStampConfig(null);
        }

        const booths = sponsorsSnap.docs.map((snapshot) => {
          const sponsor = snapshot.data() as {
            vendorId?: string;
            name?: string;
          };
          return {
            id: sponsor.vendorId || snapshot.id,
            name: sponsor.name || snapshot.id,
          };
        });
        setStampBoothCandidates(booths);

        unsubscribeStamps = onSnapshot(
          query(
            collection(db, `conferences/${confIdToUse}/stamps`),
            where("userId", "==", ui.userId),
          ),
          (snapshot) => {
            const uniqueVendorIds = Array.from(
              new Set(
                snapshot.docs
                  .map(
                    (stampDoc) =>
                      (stampDoc.data() as { vendorId?: string }).vendorId,
                  )
                  .filter(Boolean),
              ),
            ) as string[];
            setMyStamps(uniqueVendorIds);
          },
        );

        unsubscribeProgress = onSnapshot(
          doc(
            db,
            `conferences/${confIdToUse}/stamp_tour_progress/${ui.userId}`,
          ),
          (snapshot) => {
            setStampProgress(
              snapshot.exists() ? (snapshot.data() as StampProgress) : {},
            );
          },
        );

        const guestbookSnap = await getDocs(
          query(
            collection(db, `conferences/${confIdToUse}/guestbook_entries`),
            where("userId", "==", ui.userId),
          ),
        );
        setGuestbookEntries(
          guestbookSnap.docs.map((entryDoc) => {
            const entry = entryDoc.data() as {
              vendorName?: string;
              message?: string;
            };
            return {
              vendorName: entry.vendorName || "Partner Booth",
              message: entry.message,
            };
          }),
        );
      } catch (error) {
        console.error(
          "[StandAloneBadgePage] Failed to load stamp tour data",
          error,
        );
      }
    };

    loadStampTour();

    return () => {
      unsubscribeStamps?.();
      unsubscribeProgress?.();
    };
  }, [db, getConfIdToUse, slug, ui?.issued, ui?.userId]);

  const orderedStampBooths = useMemo(() => {
    if (!stampConfig?.enabled) return [];
    if (
      stampConfig.boothOrderMode === "CUSTOM" &&
      stampConfig.customBoothOrder?.length
    ) {
      const priorityBooths = stampConfig.customBoothOrder
        .map((boothId) =>
          stampBoothCandidates.find((candidate) => candidate.id === boothId),
        )
        .filter(Boolean) as Array<{ id: string; name: string }>;
      const remainingBooths = stampBoothCandidates.filter(
        (candidate) => !stampConfig.customBoothOrder?.includes(candidate.id),
      );
      return [...priorityBooths, ...remainingBooths];
    }
    return stampBoothCandidates;
  }, [stampBoothCandidates, stampConfig]);

  const requiredStampCount = useMemo(() => {
    if (!stampConfig?.enabled) return 0;
    return getStampMissionTargetCount(
      stampConfig.completionRule,
      orderedStampBooths.length,
    );
  }, [orderedStampBooths.length, stampConfig]);

  const isStampMissionComplete = stampConfig?.enabled
    ? requiredStampCount > 0 && myStamps.length >= requiredStampCount
    : false;
  const completedAtMs = stampProgress.completedAt?.toDate().getTime();
  const lotteryScheduledAtMs = stampConfig?.lotteryScheduledAt
    ?.toDate()
    .getTime();
  const completedBeforeLotteryCutoff =
    lotteryScheduledAtMs == null ||
    completedAtMs == null ||
    completedAtMs <= lotteryScheduledAtMs;
  const lotteryStatus =
    stampProgress.lotteryStatus ||
    (stampConfig?.rewardFulfillmentMode === "LOTTERY" &&
    isStampMissionComplete &&
    completedBeforeLotteryCutoff
      ? "PENDING"
      : undefined);
  const isInstantReward = stampConfig?.rewardFulfillmentMode !== "LOTTERY";
  const canParticipantDraw =
    isInstantReward && stampConfig?.drawMode !== "ADMIN";
  const currentRewardStatus = stampProgress.rewardStatus || "NONE";
  const missedLotteryCutoff =
    !isInstantReward &&
    currentRewardStatus === "NONE" &&
    !completedBeforeLotteryCutoff;

  const stampBooths = useMemo(() => {
    const stampedSet = new Set(myStamps);
    return orderedStampBooths.map((booth) => ({
      ...booth,
      isStamped: stampedSet.has(booth.id),
    }));
  }, [myStamps, orderedStampBooths]);

  const handleRewardRequest = async () => {
    const confIdToUse = getConfIdToUse(slug);
    if (!confIdToUse || !ui || !stampConfig?.enabled || !isStampMissionComplete)
      return;

    setRewardRequesting(true);
    setRewardMessage("");
    try {
      const requestReward = httpsCallable(functions, "requestStampReward");
      const response = await requestReward({
        confId: confIdToUse,
        userName: ui.name,
        userOrg: ui.aff,
      });
      const payload = response.data as { rewardName?: string };
      setRewardMessage(
        payload.rewardName
          ? t(
              `${payload.rewardName} 상품 요청이 접수되었습니다. 현장에서 확인해 주세요.`,
              `${payload.rewardName} request received. Please confirm on site.`,
            )
          : t(
              "상품 요청이 접수되었습니다. 현장에서 확인해 주세요.",
              "Reward request received. Please confirm on site.",
            ),
      );
      setRewardAnimationOpen(true);
    } catch (error) {
      console.error("[StandAloneBadgePage] Reward request failed", error);
      setRewardMessage(
        error instanceof Error
          ? error.message
          : t("상품 요청에 실패했습니다.", "Reward request failed."),
      );
    } finally {
      setRewardRequesting(false);
    }
  };
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

  const menuVisibility = {
    status: badgeConfig?.menuVisibility?.status ?? true,
    sessions: badgeConfig?.menuVisibility?.sessions ?? true,
    materials: badgeConfig?.menuVisibility?.materials ?? true,
    program: badgeConfig?.menuVisibility?.program ?? true,
    translation: badgeConfig?.menuVisibility?.translation ?? true,
    stampTour: badgeConfig?.menuVisibility?.stampTour ?? true,
    home: badgeConfig?.menuVisibility?.home ?? true,
  };
  const effectiveMenuVisibility =
    menuVisibility.status ||
    menuVisibility.sessions ||
    menuVisibility.materials ||
    menuVisibility.program ||
    menuVisibility.translation ||
    menuVisibility.stampTour
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
    effectiveMenuVisibility.stampTour ? "stamp-tour" : null,
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
            : tabsOrder.length === 5
              ? "grid-cols-5"
              : "grid-cols-6";

  console.log("[StandAloneBadgePage] QR Display Debug:", {
    issued: ui.issued,
    badgeQr: ui.badgeQr,
    showBadgeQr,
    qrValue,
    registrationId: ui.id,
  });

  // VOUCHER STATE (not issued yet)
  if (!ui.issued) {
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
          <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/85 text-center shadow-[0_24px_80px_-32px_rgba(15,23,42,0.45)] backdrop-blur">
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-slate-900 via-eregi-primary to-sky-700" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.22),_transparent_28%),linear-gradient(180deg,_transparent_0%,_rgba(248,250,252,0.95)_34%,_rgba(255,255,255,1)_100%)]" />
            {refreshing && (
              <div className="absolute top-4 right-4 z-10">
                <RefreshCw className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
            <div className="absolute right-[-12%] top-24 h-48 w-48 rounded-full border border-slate-200/60 bg-slate-100/40" />
            <div className="absolute left-[-18%] bottom-16 h-40 w-40 rounded-full border border-sky-100 bg-sky-50/60" />

            <div className="relative z-10 px-6 pb-7 pt-6">
              <div className="mb-8 flex items-start justify-between gap-4 text-white">
                <div className="text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/70">
                    Conference Pass
                  </p>
                  <h1 className="mt-2 text-2xl font-display font-semibold tracking-tight">
                    {t("등록 확인 바우처", "Registration Voucher")}
                  </h1>
                  <p className="mt-2 max-w-[15rem] text-sm text-white/80">
                    {t(
                      "현장 등록 데스크에서 확인 후 디지털 명찰로 전환됩니다.",
                      "Present this at the on-site desk to activate your digital badge.",
                    )}
                  </p>
                </div>
                <div className="mt-1 rounded-full border border-white/20 bg-white/10 p-3 backdrop-blur">
                  <Clock className="h-5 w-5 animate-pulse" />
                </div>
              </div>
              <div className="rounded-[1.6rem] border border-slate-200/70 bg-white/92 p-6 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)]">
                <div className="mb-5 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-left">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-700">
                      Pending
                    </p>
                    <p className="mt-1 text-sm font-semibold text-amber-950">
                      {t("명찰 발급 대기 중", "Badge issuance pending")}
                    </p>
                  </div>
                  <FileText className="h-5 w-5 text-amber-600" />
                </div>

                <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-400">
                  {ui.aff}
                </p>
                <h2 className="mt-3 text-3xl font-display font-semibold tracking-tight text-slate-950">
                  {ui.name}
                </h2>

                <div className="mt-5 grid grid-cols-1 gap-3 text-left">
                  {ui.license && ui.license !== "-" && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
                        {t("면허번호", "License No.")}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {ui.license}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-inner">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-left">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                        Desk QR
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        {t("등록 확인 QR", "Show this QR at the desk")}
                      </p>
                    </div>
                    <div className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white">
                      Voucher
                    </div>
                  </div>
                  <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm">
                    <QRCodeSVG
                      key={qrValue}
                      value={qrValue}
                      size={176}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-4 text-left">
                  <p className="flex items-center gap-2 text-sm font-semibold text-sky-900">
                    <User className="h-4 w-4" />
                    {t("등록 데스크에 QR 제시", "Present QR at check-in")}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-sky-800">
                    {t(
                      "확인 후 디지털 명찰이 발급됩니다.",
                      "Your digital badge will be issued after verification.",
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Refresh Indicator */}
          {refreshing && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-full border border-sky-100 bg-white/80 px-5 py-3 text-center text-sm font-medium text-sky-800 shadow-sm backdrop-blur">
              <RefreshCw className="w-4 h-4 animate-spin" />
              {t(
                "명찰 발급 상태를 새로고침 중입니다...",
                "Refreshing badge status...",
              )}
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

  // ISSUED BADGE STATE
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

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.16),_transparent_36%),linear-gradient(180deg,_#eff6ff_0%,_#f8fafc_48%,_#eef2ff_100%)] flex flex-col p-4 font-body relative">
      {/* Elegant background pattern */}
      <div className="absolute inset-0 opacity-30" style={{backgroundImage: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><circle cx=\"50\" cy=\"50\" r=\"30\" fill=\"%23e2e8f0\" fill-opacity=\"0.15\"/></svg>')"}} />

      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col justify-center py-6 relative z-10">
        <div className="mb-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setBadgeLang("ko")}
            className={`rounded-full px-5 py-2.5 text-sm font-body font-semibold shadow-sm transition-all duration-200 ${badgeLang === "ko" ? "bg-slate-900 text-white shadow-lg shadow-slate-900/15" : "border border-white/70 bg-white/80 text-slate-600 backdrop-blur hover:bg-white"}`}
          >
            한국어
          </button>
          <button
            type="button"
            onClick={() => setBadgeLang("en")}
            className={`rounded-full px-5 py-2.5 text-sm font-body font-semibold shadow-sm transition-all duration-200 ${badgeLang === "en" ? "bg-slate-900 text-white shadow-lg shadow-slate-900/15" : "border border-white/70 bg-white/80 text-slate-600 backdrop-blur hover:bg-white"}`}
          >
            English
          </button>
        </div>
        <div className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/90 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.45)] backdrop-blur flex flex-col relative z-10">
          <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-eregi-primary to-sky-700 px-6 pb-6 pt-5 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.2),_transparent_28%),linear-gradient(90deg,_transparent,_rgba(255,255,255,0.08),_transparent)]" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/70">
                  Conference Badge
                </p>
                <h2 className="mt-2 text-[1.75rem] font-display font-semibold tracking-tight">
                  {t("디지털 명찰", "Digital Badge")}
                </h2>
                <p className="mt-2 text-sm text-white/80">
                  {t("QR로 입장/퇴장 하실 수 있습니다.", "You can enter/exit with the QR code.")}
                </p>
              </div>
              <div className="rounded-full border border-white/20 bg-white/10 p-3 backdrop-blur">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="relative p-8 flex flex-col items-center text-center bg-[linear-gradient(180deg,_rgba(248,250,252,0.92)_0%,_white_100%)]">
            <div className="absolute right-[-18%] top-5 h-36 w-36 rounded-full bg-sky-100/60 blur-2xl" />
            <div className="absolute left-[-20%] bottom-10 h-32 w-32 rounded-full bg-indigo-100/60 blur-2xl" />

            <div className="relative z-10 w-full">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400 break-keep">
                {ui.aff || "-"}
              </p>
              <h2 className="mt-3 text-4xl font-display font-semibold tracking-tight text-slate-950 leading-tight">
                {ui.name}
              </h2>

              {ui.license && ui.license !== "-" && (
                <div className="mx-auto mt-5 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
                  {t("면허번호", "License No.")}: {ui.license}
                </div>
              )}

              <div className="relative mx-auto mt-6 max-w-[18rem] rounded-[1.8rem] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.5)]">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-400">
                    Access QR
                  </p>
                  <div className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white">
                    Active
                  </div>
                </div>
                <div className="mt-4 rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm flex justify-center items-center">
                  {showBadgeQr && (
                    <QRCodeSVG
                      key={qrValue}
                      value={qrValue}
                      size={180}
                      level="H"
                      includeMargin={true}
                      className="rounded-xl"
                    />
                  )}
                </div>
                <p className="mt-4 text-sm font-medium text-slate-600 text-center">
                  {t("QR로 입장/퇴장 하실 수 있습니다.", "You can enter/exit with the QR code.")}
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
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200 hover:bg-slate-50"
                  >
                    <User className="w-4 h-4" />
                    <span className="text-[11px] font-body font-semibold">
                      {getMenuLabel("status", "상태", "Status")}
                    </span>
                  </TabsTrigger>
                )}
                {effectiveMenuVisibility.sessions && (
                  <TabsTrigger
                    value="sessions"
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200 hover:bg-slate-50"
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-[11px] font-body font-semibold">
                      {getMenuLabel("sessions", "수강", "Sessions")}
                    </span>
                  </TabsTrigger>
                )}
                {effectiveMenuVisibility.materials && (
                  <TabsTrigger
                    value="materials"
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200 hover:bg-slate-50"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="text-[11px] font-body font-semibold">
                      {getMenuLabel("materials", "자료", "Materials")}
                    </span>
                  </TabsTrigger>
                )}
                {effectiveMenuVisibility.program && (
                  <TabsTrigger
                    value="program"
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200 hover:bg-slate-50"
                  >
                    <Calendar className="w-4 h-4" />
                    <span className="text-[11px] font-body font-semibold">
                      {getMenuLabel("program", "일정", "Program")}
                    </span>
                  </TabsTrigger>
                )}
                {translationEnabled && (
                  <TabsTrigger
                    value="translation"
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200 hover:bg-slate-50"
                  >
                    <Languages className="w-4 h-4" />
                    <span className="text-[11px] font-body font-semibold">
                      {getMenuLabel("translation", "번역", "Translation")}
                    </span>
                  </TabsTrigger>
                )}
                {effectiveMenuVisibility.stampTour && (
                  <TabsTrigger
                    value="stamp-tour"
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200 hover:bg-slate-50"
                  >
                    <Gift className="w-4 h-4" />
                    <span className="text-[11px] font-body font-semibold">
                      {getMenuLabel("stampTour", "메뉴", "Menu")}
                    </span>
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Status Tab */}
              {effectiveMenuVisibility.status && (
                <TabsContent value="status" className="mt-2 p-1 space-y-2">
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
                </TabsContent>
              )}

              {/* Sessions Tab */}
              {effectiveMenuVisibility.sessions && (
                <TabsContent value="sessions" className="mt-2 p-1">
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
                )}
                </TabsContent>
              )}

              {/* Program Tab */}
              {effectiveMenuVisibility.program && (
                <TabsContent value="program" className="mt-2 p-1">
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
                  )}
                </TabsContent>
              )}

              {effectiveMenuVisibility.stampTour && (
                <TabsContent value="stamp-tour" className="mt-2 p-1 space-y-3">
                {!stampConfig?.enabled ? (
                  <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-10 px-4 text-center">
                    <Gift className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-gray-800 mb-1">
                      {t("스탬프 투어 미운영", "Stamp tour unavailable")}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t(
                        "이 행사에서는 스탬프 투어가 열려 있지 않습니다.",
                        "Stamp tour is not active for this event.",
                      )}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <p className="text-sm font-black text-amber-900">
                            {t("스탬프 투어 진행", "Stamp tour progress")}
                          </p>
                          <p className="text-xs text-amber-700">
                            {t(
                              "참여 부스를 방문해 스탬프를 모아 주세요.",
                              "Visit participating booths and collect stamps.",
                            )}
                          </p>
                        </div>
                        <div className="rounded-full bg-white px-3 py-1 text-sm font-black text-amber-700 shadow-sm">
                          {myStamps.length} /{" "}
                          {requiredStampCount || stampBoothCandidates.length}
                        </div>
                      </div>

                      <div className="h-3 overflow-hidden rounded-full bg-amber-200">
                        <div
                          className="h-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-700"
                          style={{
                            width: `${Math.min(100, requiredStampCount > 0 ? (myStamps.length / requiredStampCount) * 100 : 0)}%`,
                          }}
                        />
                      </div>

                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-semibold text-amber-900">
                          {isStampMissionComplete
                            ? stampConfig.completionMessage ||
                              t(
                                "스탬프 투어를 완료했습니다.",
                                "Stamp tour completed.",
                              )
                            : t(
                                `${myStamps.length}개의 스탬프를 모았습니다.`,
                                `${myStamps.length} stamps collected.`,
                              )}
                        </p>
                        {currentRewardStatus === "REQUESTED" && (
                          <div className="rounded-xl bg-eregi-primary/10 px-3 py-2 text-xs font-body font-semibold text-eregi-primary">
                            {stampProgress.rewardName
                              ? t(
                                  `${stampProgress.rewardName} 상품 요청이 접수되었습니다.`,
                                  `${stampProgress.rewardName} request received.`,
                                )
                              : t(
                                  "상품 요청이 접수되었습니다.",
                                  "Reward request received.",
                                )}
                          </div>
                        )}
                        {currentRewardStatus === "REDEEMED" && (
                          <div className="rounded-xl bg-eregi-primary/10 px-3 py-2 text-xs font-body font-semibold text-eregi-primary">
                            {t(
                              "상품 수령이 완료되었습니다.",
                              "Reward has been redeemed.",
                            )}
                          </div>
                        )}
                        {isStampMissionComplete &&
                          currentRewardStatus === "NONE" &&
                          canParticipantDraw && (
                            <button
                              type="button"
                              onClick={handleRewardRequest}
                              disabled={rewardRequesting}
                              className="w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {rewardRequesting
                                ? t("처리 중...", "Processing...")
                                : t("상품 요청하기", "Request reward")}
                            </button>
                          )}
                        {isStampMissionComplete &&
                          currentRewardStatus === "NONE" &&
                          !canParticipantDraw &&
                          isInstantReward && (
                            <div className="rounded-xl bg-sky-100 px-3 py-2 text-xs font-bold text-sky-700">
                              {t(
                                "관리자 추첨 대기 중입니다. 운영 화면에서 당첨이 확정됩니다.",
                                "Waiting for admin draw. Winners will be confirmed on the admin screen.",
                              )}
                            </div>
                          )}
                        {isStampMissionComplete &&
                          !isInstantReward &&
                          lotteryStatus === "PENDING" && (
                            <div className="rounded-xl bg-sky-100 px-3 py-2 text-xs font-bold text-sky-700">
                              {t(
                                "예약 추첨 대기 중입니다. 지정된 시각 이후 관리자 화면에서 추첨됩니다.",
                                "Scheduled lottery is pending and will run from the admin console after the set time.",
                              )}
                            </div>
                          )}
                        {isStampMissionComplete &&
                          !isInstantReward &&
                          lotteryStatus === "PENDING" &&
                          stampConfig.lotteryScheduledAt && (
                            <div className="rounded-xl bg-white/80 px-3 py-2 text-xs text-amber-900">
                              {t("추첨 예정 시각", "Scheduled draw time")}:{" "}
                              {stampConfig.lotteryScheduledAt
                                .toDate()
                                .toLocaleString(
                                  badgeLang === "ko" ? "ko-KR" : "en-US",
                                )}
                            </div>
                          )}
                        {missedLotteryCutoff && (
                          <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
                            {t(
                              "예약 추첨 마감 이후에 미션을 완료해 이번 추첨 대상에서는 제외되었습니다.",
                              "Mission completion happened after the lottery cutoff, so this entry is excluded from the current draw.",
                            )}
                          </div>
                        )}
                        {!isInstantReward &&
                          lotteryStatus === "NOT_SELECTED" && (
                            <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
                              {t(
                                "이번 예약 추첨에서는 미당첨입니다.",
                                "Not selected in this scheduled draw.",
                              )}
                            </div>
                          )}
                        {rewardMessage && (
                          <div className="rounded-xl bg-white/80 px-3 py-2 text-xs text-amber-900">
                            {rewardMessage}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                      <p className="mb-3 text-sm font-black text-gray-900">
                        {t("참여 부스 진행 현황", "Participating booth status")}
                      </p>
                      <div className="space-y-2">
                        {stampBooths.length === 0 ? (
                          <p className="text-xs text-gray-400">
                            {t(
                              "참여 부스 정보가 없습니다.",
                              "No participating booths found.",
                            )}
                          </p>
                        ) : (
                          stampBooths.map((booth) => (
                            <div
                              key={booth.id}
                              className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm"
                            >
                              <span className="font-semibold text-gray-800">
                                {booth.name}
                              </span>
                              <span
                                className={`rounded-full px-2 py-1 text-xs font-body font-semibold ${booth.isStamped ? "bg-eregi-primary/10 text-eregi-primary" : "bg-muted text-muted-foreground"}`}
                              >
                                {booth.isStamped
                                  ? t("스탬프 완료", "Stamped")
                                  : t("미완료", "Pending")}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                      <p className="mb-3 text-sm font-black text-gray-900">
                        {t("방명록 참여 내역", "Guestbook activity")}
                      </p>
                      <div className="space-y-2">
                        {guestbookEntries.length === 0 ? (
                          <p className="text-xs text-gray-400">
                            {t(
                              "방명록 참여 내역이 없습니다.",
                              "No guestbook entries yet.",
                            )}
                          </p>
                        ) : (
                          guestbookEntries.map((entry, index) => (
                            <div
                              key={`${entry.vendorName}-${index}`}
                              className="rounded-xl bg-gray-50 px-3 py-2"
                            >
                              <p className="text-sm font-semibold text-gray-800">
                                {entry.vendorName}
                              </p>
                              {entry.message && (
                                <p className="mt-1 text-xs text-gray-500">
                                  {entry.message}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
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

      {rewardAnimationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/70 px-6">
          <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-white p-8 text-center shadow-2xl">
            <button
              type="button"
              onClick={() => setRewardAnimationOpen(false)}
              className="absolute right-4 top-4 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600"
            >
              {t("닫기", "Close")}
            </button>
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-amber-200 via-orange-100 to-transparent" />
            <div className="relative">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg">
                <Sparkles className="h-10 w-10 animate-pulse" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-600">
                {t("상품 안내", "Reward Reveal")}
              </p>
              <h3 className="mt-2 text-2xl font-black text-gray-900">
                {stampProgress.rewardName || t("상품 확정", "Reward assigned")}
              </h3>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                {rewardMessage ||
                  t(
                    "상품 요청이 접수되었습니다. 현장에서 확인해 주세요.",
                    "Reward request received. Please confirm on site.",
                  )}
              </p>
              <div className="mt-6 flex justify-center gap-2">
                <span className="h-2 w-2 animate-bounce rounded-full bg-amber-400" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-orange-400 [animation-delay:120ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-yellow-400 [animation-delay:240ms]" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StandAloneBadgePage;
