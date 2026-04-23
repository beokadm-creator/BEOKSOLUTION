import React, { useCallback, useLayoutEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { useAuth } from "../hooks/useAuth";
import { db } from "../firebase";
import {
  getBadgeDisplayAffiliation,
  getBadgeDisplayName,
  isBadgeIssued,
  type BadgeRecordSource,
} from "../utils/badgeRecord";
import { resolveConferenceIdFromRoute } from "../utils/conferenceRoute";
import { getKstToday } from "../utils/dateUtils";
import type {
  TimestampLike,
  AttendanceZone,
  AttendanceSettings,
  BadgeConfig,
  BadgeUiState,
  ResolvedMenuVisibility,
} from "@/types/badge";
import {
  t as tFn,
  formatBadgeMinutes,
  effectiveMenuVisibility,
} from "@/utils/badgeUi";
import { QnAPanel } from "../components/badge/QnAPanel";
import { CertificateDownloader } from "../components/badge/CertificateDownloader";
import { StampTourPanel } from "../components/badge/StampTourPanel";
import {
  UnifiedBadgeView,
} from "../components/badge/UnifiedBadgeView";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const parseConferenceEndAt = (raw: unknown): Date | null => {
  if (!raw) return null;
  if (
    typeof raw === "object" &&
    raw !== null &&
    "toDate" in raw &&
    typeof (raw as TimestampLike).toDate === "function"
  ) {
    return (raw as TimestampLike).toDate();
  }
  if (typeof raw === "string") {
    const datePart = raw.includes("T") ? raw.split("T")[0] : raw;
    const [year, month, day] = datePart.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(Date.UTC(year, month - 1, day, 14, 59, 59, 999));
  }
  return null;
};

// ---------------------------------------------------------------------------
// Page container
// ---------------------------------------------------------------------------

const ConferenceBadgePage: React.FC = () => {
  const { slug } = useParams();
  const { auth } = useAuth();
  const confId = resolveConferenceIdFromRoute(slug);

  const [ui, setUi] = useState<BadgeUiState | null>(null);
  const [zones, setZones] = useState<AttendanceZone[]>([]);
  const [liveMinutes, setLiveMinutes] = useState(0);
  const [voucherQr, setVoucherQr] = useState("");
  const [msg, setMsg] = useState("초기화 중...");
  const [conferenceEnded, setConferenceEnded] = useState(false);
  const [conferenceChecked, setConferenceChecked] = useState(false);
  const [badgeLang, setBadgeLang] = useState<"ko" | "en">("ko");
  const [badgeConfig, setBadgeConfig] = useState<BadgeConfig | null>(null);

  const t = useCallback(
    (ko: string, en: string) => tFn(badgeLang, ko, en),
    [badgeLang],
  );
  const formatMinutes = useCallback(
    (minutes: number) => formatBadgeMinutes(badgeLang, minutes),
    [badgeLang],
  );

  // -------------------------------------------------------------------------
  // 1. Conference-end gate
  // -------------------------------------------------------------------------

  useLayoutEffect(() => {
    if (!confId) {
      setConferenceEnded(false);
      setConferenceChecked(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const confSnap = await getDoc(doc(db, "conferences", confId));
        if (!confSnap.exists()) {
          if (!cancelled) {
            setConferenceEnded(false);
            setConferenceChecked(true);
          }
          return;
        }

        const conf = confSnap.data() as {
          endDate?: unknown;
          dates?: { end?: unknown };
        };
        const endAt = parseConferenceEndAt(conf.endDate || conf.dates?.end);
        if (!cancelled) {
          setConferenceEnded(!!endAt && Date.now() > endAt.getTime());
          setConferenceChecked(true);
        }
      } catch (error) {
        console.error(
          "[ConferenceBadgePage] Failed to check conference status",
          error,
        );
        if (!cancelled) {
          setConferenceEnded(false);
          setConferenceChecked(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [confId]);

  // -------------------------------------------------------------------------
  // 2. Auth-based data loading (registration / external attendee)
  // -------------------------------------------------------------------------

  useLayoutEffect(() => {
    if (!confId) {
      setMsg("?좏슚?섏? ?딆? ?숉쉶 寃쎈줈?낅땲??");
      return;
    }
    if (!conferenceChecked) {
      setMsg("?됱궗 醫낅즺 ?щ?瑜??뺤씤?섎뒗 以묒엯?덈떎...");
      return;
    }
    if (conferenceEnded) {
      setMsg("醫낅즺???숉쉶?낅땲??");
      return;
    }
    if (!auth.user) {
      setMsg("?몄쬆??留뚮즺?섏뿀?듬땲?? ?ㅼ떆 ?묒냽??二쇱꽭??");
      return;
    }

    setMsg("紐낆같 ?뺣낫瑜?遺덈윭?ㅻ뒗 以묒엯?덈떎...");
    const userId = auth.user.id;
    const registrationQuery = query(
      collection(db, `conferences/${confId}/registrations`),
      where("userId", "==", userId),
      where("paymentStatus", "==", "PAID"),
      orderBy("createdAt", "desc"),
    );
    const externalAttendeeQuery = query(
      collection(db, `conferences/${confId}/external_attendees`),
      where("userId", "==", userId),
      where("paymentStatus", "==", "PAID"),
    );

    import("firebase/firestore").then(async ({ doc: fDoc, getDoc: fGetDoc }) => {
      try {
        const rulesSnap = await fGetDoc(
          fDoc(db, `conferences/${confId}/settings/attendance`),
        );
        const configSnap = await fGetDoc(
          fDoc(db, `conferences/${confId}/settings/badge_config`),
        );

        if (configSnap.exists()) {
          setBadgeConfig(configSnap.data());
        }

        if (!rulesSnap.exists()) return;

        const attendanceSettings = rulesSnap.data() as AttendanceSettings;
        const allRules = attendanceSettings.rules || {};
        const allZones: AttendanceZone[] = [];
        Object.entries(allRules).forEach(([dateStr, rule]) => {
          rule.zones?.forEach((zone) => {
            allZones.push({ ...zone, ruleDate: dateStr });
          });
        });
        setZones(allZones);
      } catch (error) {
        console.error("Failed to load attendance rules", error);
      }
    });

    const processSnapshot = (
      snapshot: Awaited<ReturnType<typeof getDocs>>,
      source: BadgeRecordSource,
    ) => {
      if (snapshot.empty) {
        setUi(null);
        setMsg("?깅줉 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎.");
        return;
      }

      const registration = snapshot.docs[0].data() as {
        paymentStatus?: string;
        attendanceStatus?: string;
        currentZone?: string;
        userId?: string;
        confirmationQr?: string;
        badgeQr?: string;
        totalMinutes?: number;
        receiptNumber?: string;
        orderId?: string;
        lastCheckIn?: TimestampLike;
        isCompleted?: boolean;
        isCheckedIn?: boolean;
        amount?: number;
        licenseNumber?: string;
        dailyMinutes?: Record<string, number>;
        zoneMinutes?: Record<string, number>;
        zoneCompleted?: Record<string, boolean>;
      };
      const paymentStatus = registration?.paymentStatus || "UNKNOWN";
      if (paymentStatus !== "PAID") {
        setUi(null);
        setMsg(
          `寃곗젣媛 ?꾨즺?섏? ?딆븯?듬땲?? 寃곗젣 ?곹깭: ${paymentStatus}`,
        );
        return;
      }

      const regId = snapshot.docs[0].id;
      const issued = isBadgeIssued(registration, source);
      const baseMinutes = Number(registration.totalMinutes || 0);

      setVoucherQr(String(registration.confirmationQr || regId));
      setUi({
        status: String(registration.attendanceStatus || "OUTSIDE"),
        zone: String(
          registration.attendanceStatus === "INSIDE"
            ? registration.currentZone || "Inside"
            : "OUTSIDE",
        ),
        name: getBadgeDisplayName(registration),
        aff: getBadgeDisplayAffiliation(registration),
        id: String(regId),
        userId: String(registration.userId || regId),
        issued,
        receiptNumber: String(
          registration.receiptNumber || registration.orderId || "-",
        ),
        lastCheckIn: registration.lastCheckIn,
        baseMinutes,
        isCompleted: !!registration.isCompleted,
        isCheckedIn: !!registration.isCheckedIn,
        paymentStatus: String(registration.paymentStatus || ""),
        amount: registration.amount || 0,
        license: String(registration.licenseNumber || "-"),
        badgeQr: registration.badgeQr || null,
        dailyMinutes: registration.dailyMinutes || {},
        zoneMinutes: registration.zoneMinutes || {},
        zoneCompleted: registration.zoneCompleted || {},
      });
      setLiveMinutes(baseMinutes);
      setMsg("");
    };

    let unsubscribe = () => {};
    let cancelled = false;

    (async () => {
      try {
        const registrationSnapshot = await getDocs(registrationQuery);
        if (cancelled) return;

        if (!registrationSnapshot.empty) {
          processSnapshot(registrationSnapshot, "REGULAR");
          unsubscribe = onSnapshot(registrationQuery, (snapshot) =>
            processSnapshot(snapshot, "REGULAR"),
          );
          return;
        }

        const externalAttendeeSnapshot = await getDocs(
          externalAttendeeQuery,
        );
        if (cancelled) return;

        if (!externalAttendeeSnapshot.empty) {
          processSnapshot(externalAttendeeSnapshot, "EXTERNAL");
          unsubscribe = onSnapshot(externalAttendeeQuery, (snapshot) =>
            processSnapshot(snapshot, "EXTERNAL"),
          );
          return;
        }

        setUi(null);
        setMsg("?깅줉 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎.");
      } catch (error) {
        console.error(
          "[ConferenceBadgePage] Failed to load badge data",
          error,
        );
        if (!cancelled) {
          setUi(null);
          setMsg("?곗씠?곕? 遺덈윭?ㅻ뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.");
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [confId, auth.user, conferenceChecked, conferenceEnded]);

  // -------------------------------------------------------------------------
  // 3. Live attendance minute calculation
  // -------------------------------------------------------------------------

  useLayoutEffect(() => {
    if (!ui) return;

    const updateLiveMinutes = () => {
      if (ui.status !== "INSIDE" || !ui.lastCheckIn) {
        setLiveMinutes(ui.baseMinutes || 0);
        return;
      }

      const now = new Date();
      const start = ui.lastCheckIn.toDate();
      let boundedStart = start;
      let boundedEnd = now;
      const todayStr = getKstToday();
      const zoneRule =
        zones.find((z) => z.id === ui.zone && z.ruleDate === todayStr) ||
        zones.find((zone) => zone.id === ui.zone);

      if (zoneRule?.start && zoneRule.end) {
        const localDateStr =
          zoneRule.ruleDate ||
          `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
        const sessionStart = new Date(
          `${localDateStr}T${zoneRule.start}:00+09:00`,
        );
        const sessionEnd = new Date(
          `${localDateStr}T${zoneRule.end}:00+09:00`,
        );
        boundedStart = new Date(
          Math.max(start.getTime(), sessionStart.getTime()),
        );
        boundedEnd = new Date(
          Math.min(now.getTime(), sessionEnd.getTime()),
        );
      }

      let diffMinutes = 0;
      if (boundedEnd > boundedStart) {
        diffMinutes = Math.floor(
          (boundedEnd.getTime() - boundedStart.getTime()) / 60000,
        );
      }

      let deduction = 0;
      zoneRule?.breaks?.forEach((breakTime) => {
        const localDateStr =
          zoneRule.ruleDate ||
          `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
        const breakStart = new Date(
          `${localDateStr}T${breakTime.start}:00+09:00`,
        );
        const breakEnd = new Date(
          `${localDateStr}T${breakTime.end}:00+09:00`,
        );
        const overlapStart = Math.max(
          boundedStart.getTime(),
          breakStart.getTime(),
        );
        const overlapEnd = Math.min(
          boundedEnd.getTime(),
          breakEnd.getTime(),
        );
        if (overlapEnd > overlapStart) {
          deduction += Math.floor((overlapEnd - overlapStart) / 60000);
        }
      });

      setLiveMinutes(
        (ui.baseMinutes || 0) + Math.max(0, diffMinutes - deduction),
      );
    };

    updateLiveMinutes();
    const timer = setInterval(updateLiveMinutes, 30000);
    return () => clearInterval(timer);
  }, [ui, zones]);

  // -------------------------------------------------------------------------
  // 4. Menu visibility — only tabs ConferenceBadgePage supports
  // -------------------------------------------------------------------------

  const baseMenuVis = effectiveMenuVisibility(badgeConfig?.menuVisibility);
  const menuVis: ResolvedMenuVisibility = {
    ...baseMenuVis,
    sessions: false,
    materials: false,
    program: false,
    translation: false,
    home: false,
  };
  const certificateEnabled = menuVis.certificate;

  // -------------------------------------------------------------------------
  // 5. Loading / error gates
  // -------------------------------------------------------------------------

  if (msg) {
    return (
      <div className="flex min-h-screen items-center justify-center p-10 text-center font-bold text-gray-500">
        {msg}
      </div>
    );
  }

  if (!ui) {
    return (
      <div className="flex min-h-screen items-center justify-center p-10 text-center">
        {t(
          "명찰 정보를 불러오지 못했습니다.",
          "Unable to load badge information.",
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 6. Delegate rendering to UnifiedBadgeView
  // -------------------------------------------------------------------------

  return (
    <UnifiedBadgeView
      mode={ui.issued ? "issued" : "voucher"}
      ui={ui}
      menuVis={menuVis}
      badgeConfig={badgeConfig}
      badgeLang={badgeLang}
      setBadgeLang={setBadgeLang}
      attendance={{
        status: ui.status as "INSIDE" | "OUTSIDE",
        currentZone: ui.zone && ui.zone !== "OUTSIDE" ? ui.zone : null,
        isCheckedIn: ui.isCheckedIn || false,
        paymentStatus: ui.paymentStatus || "",
        amount: ui.amount || 0,
      }}
      liveMinutes={liveMinutes}
      refreshing={false}
      isCompleted={ui.isCompleted || false}
      voucherQr={voucherQr || ui.id}
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
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 via-transparent to-green-400/10 animate-pulse" />
            )}
            <div className="flex items-center justify-center gap-3 relative z-10">
              {ui.status === "INSIDE" ? (
                <>
                  <div className="relative">
                    <span className="w-4 h-4 bg-emerald-500 rounded-full flex animate-pulse shadow-lg" />
                    <span className="absolute inset-0 w-4 h-4 bg-emerald-400 rounded-full animate-ping" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-display font-semibold">
                      {t("입장 완료", "Checked In")}
                    </span>
                    <span className="text-sm opacity-80">
                      {t("출석 인정 중", "Attendance Active")}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <span className="w-4 h-4 bg-slate-400 rounded-full shadow-md" />
                  <div className="flex flex-col">
                    <span className="text-lg font-display font-semibold">
                      {t("퇴장 상태", "Checked Out")}
                    </span>
                    <span className="text-sm opacity-80">
                      {t("대기중", "Standby")}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {liveMinutes > 0 && (
            <div className="bg-purple-50/50 border border-purple-100 rounded-xl py-3 px-4 flex justify-between items-center">
              <div className="flex flex-col">
                <p className="text-xs text-purple-600 font-bold">
                  {t("총 체류 시간", "Total attendance time")}
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
                {formatMinutes(liveMinutes)}
              </p>
            </div>
          )}

          {ui.isCompleted && liveMinutes > 0 && (
            <div className="flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-2 text-sm font-body font-semibold text-emerald-700">
              {t("✅ 수강 인정 시간 달성", "✅ Attendance Goal Met")}
            </div>
          )}

          {certificateEnabled && liveMinutes > 0 && (
            <div className="mt-4">
              <CertificateDownloader
                confId={confId || ""}
                ui={ui}
                badgeLang={badgeLang}
              />
            </div>
          )}
        </>
      )}
      renderStampTourTab={() => (
        <StampTourPanel
          confId={confId || ""}
          userId={ui.userId}
          userName={ui.name}
          userAff={ui.aff}
          badgeLang={badgeLang}
        />
      )}
      renderQnATab={() => (
        <QnAPanel
          confId={confId || ""}
          userId={ui.userId}
          userName={ui.name}
          userAff={ui.aff}
          badgeLang={badgeLang}
        />
      )}
    />
  );
};

export default ConferenceBadgePage;
