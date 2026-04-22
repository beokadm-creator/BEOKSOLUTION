import React, { useLayoutEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, Timestamp, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import QRCode from "react-qr-code";

import { useAuth } from "../hooks/useAuth";
import { db, functions } from "../firebase";
import { getStampMissionTargetCount } from "../utils/stampTour";
import {
    getBadgeDisplayAffiliation,
    getBadgeDisplayName,
    isBadgeIssued,
    type BadgeRecordSource
} from "../utils/badgeRecord";
import { resolveConferenceIdFromRoute } from "../utils/conferenceRoute";
import { getKstToday } from "../utils/dateUtils";

type TimestampLike = {
    toDate: () => Date;
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

type BadgeUiData = {
    status: string;
    zone: string;
    name: string;
    aff: string;
    id: string;
    userId: string;
    issued: boolean;
    qrValue: string;
    receiptNumber: string;
    lastCheckIn?: TimestampLike;
    baseMinutes: number;
    isCompleted?: boolean;
    isCheckedIn?: boolean;
    paymentStatus?: string;
    amount?: number;
    license?: string;
    badgeQr?: string | null;
};

type StampTourConfig = {
    enabled: boolean;
    endAt?: Timestamp;
    completionRule: { type: "COUNT" | "ALL"; requiredCount?: number };
    boothOrderMode: "SPONSOR_ORDER" | "CUSTOM";
    customBoothOrder?: string[];
    rewardMode: "RANDOM" | "FIXED";
    drawMode?: "PARTICIPANT" | "ADMIN" | "BOTH";
    rewardFulfillmentMode?: "INSTANT" | "LOTTERY";
    lotteryScheduledAt?: Timestamp;
    rewards: Array<{
        id: string;
        name: string;
        imageUrl?: string;
        totalQty: number;
        remainingQty: number;
        weight?: number;
        order?: number;
        isFallback?: boolean;
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


import { QnAPanel } from "../components/badge/QnAPanel";
import { CertificateDownloader } from "../components/badge/CertificateDownloader";

const parseConferenceEndAt = (raw: unknown): Date | null => {
    if (!raw) return null;
    if (typeof raw === "object" && raw !== null && "toDate" in raw && typeof (raw as TimestampLike).toDate === "function") {
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

const ConferenceBadgePage: React.FC = () => {
    const { slug } = useParams();
    const { auth } = useAuth();
    const confId = resolveConferenceIdFromRoute(slug);

    const [uiData, setUiData] = useState<BadgeUiData | null>(null);
    const [zones, setZones] = useState<AttendanceZone[]>([]);
    const [liveMinutes, setLiveMinutes] = useState(0);
    const [msg, setMsg] = useState("珥덇린??以?..");
    const [conferenceEnded, setConferenceEnded] = useState(false);
    const [conferenceChecked, setConferenceChecked] = useState(false);
    const [totalVendors, setTotalVendors] = useState(0);
    const [myStamps, setMyStamps] = useState<string[]>([]);
    const [stampConfig, setStampConfig] = useState<StampTourConfig | null>(null);
    const [stampBoothCandidates, setStampBoothCandidates] = useState<Array<{ id: string; name: string }>>([]);
    const [stampProgress, setStampProgress] = useState<StampProgress>({});
    const [guestbookEntries, setGuestbookEntries] = useState<Array<{ vendorName: string; message?: string; timestamp?: Timestamp }>>([]);
    const [rewardRequesting, setRewardRequesting] = useState(false);
    const [rewardMessage, setRewardMessage] = useState("");
    const [badgeLang, setBadgeLang] = useState<"ko" | "en">("ko");
    const [badgeConfig, setBadgeConfig] = useState<any>(null);

    const t = (ko: string, en: string) => (
        badgeLang === "ko" ? ko : en
    );

    const formatMinutes = (minutes: number) => (
        badgeLang === "ko"
            ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`
            : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    );

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

                const conf = confSnap.data() as { endDate?: unknown; dates?: { end?: unknown } };
                const endAt = parseConferenceEndAt(conf.endDate || conf.dates?.end);
                if (!cancelled) {
                    setConferenceEnded(!!endAt && Date.now() > endAt.getTime());
                    setConferenceChecked(true);
                }
            } catch (error) {
                console.error("[ConferenceBadgePage] Failed to check conference status", error);
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
            orderBy("createdAt", "desc")
        );
        const externalAttendeeQuery = query(
            collection(db, `conferences/${confId}/external_attendees`),
            where("userId", "==", userId),
            where("paymentStatus", "==", "PAID")
        );

        import("firebase/firestore").then(async ({ doc, getDoc }) => {
            try {
                const rulesSnap = await getDoc(doc(db, `conferences/${confId}/settings/attendance`));
                const configSnap = await getDoc(doc(db, `conferences/${confId}/settings/badge_config`));

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
            source: BadgeRecordSource
        ) => {
            if (snapshot.empty) {
                setUiData(null);
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
            };
            const paymentStatus = registration?.paymentStatus || "UNKNOWN";
            if (paymentStatus !== "PAID") {
                setUiData(null);
                setMsg(`寃곗젣媛 ?꾨즺?섏? ?딆븯?듬땲?? 寃곗젣 ?곹깭: ${paymentStatus}`);
                return;
            }

            const regId = snapshot.docs[0].id;
            const issued = isBadgeIssued(registration, source);
            const voucherQr = String(registration.confirmationQr || regId);
            const badgeQr = String(registration.badgeQr || `BADGE-${regId}`);
            const qrValue = issued ? badgeQr : voucherQr;
            const baseMinutes = Number(registration.totalMinutes || 0);

            setUiData({
                status: String(registration.attendanceStatus || "OUTSIDE"),
                zone: String(registration.attendanceStatus === "INSIDE" ? (registration.currentZone || "Inside") : "OUTSIDE"),
                name: getBadgeDisplayName(registration),
                aff: getBadgeDisplayAffiliation(registration),
                id: String(regId),
                userId: String(registration.userId || regId),
                issued,
                qrValue,
                receiptNumber: String(registration.receiptNumber || registration.orderId || "-"),
                lastCheckIn: registration.lastCheckIn,
                baseMinutes,
                isCompleted: !!registration.isCompleted,
                isCheckedIn: !!registration.isCheckedIn,
                paymentStatus: String(registration.paymentStatus || ""),
                amount: registration.amount || 0,
                license: String(registration.licenseNumber || "-"),
                badgeQr: registration.badgeQr || null
            });
            setLiveMinutes(baseMinutes);
            setMsg("");
        };

        let unsubscribe = () => { };
        let cancelled = false;

        (async () => {
            try {
                const registrationSnapshot = await getDocs(registrationQuery);
                if (cancelled) return;

                if (!registrationSnapshot.empty) {
                    processSnapshot(registrationSnapshot, "REGULAR");
                    unsubscribe = onSnapshot(registrationQuery, (snapshot) => processSnapshot(snapshot, "REGULAR"));
                    return;
                }

                const externalAttendeeSnapshot = await getDocs(externalAttendeeQuery);
                if (cancelled) return;

                if (!externalAttendeeSnapshot.empty) {
                    processSnapshot(externalAttendeeSnapshot, "EXTERNAL");
                    unsubscribe = onSnapshot(externalAttendeeQuery, (snapshot) => processSnapshot(snapshot, "EXTERNAL"));
                    return;
                }

                setUiData(null);
                setMsg("?깅줉 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎.");
            } catch (error) {
                console.error("[ConferenceBadgePage] Failed to load badge data", error);
                if (!cancelled) {
                    setUiData(null);
                    setMsg("?곗씠?곕? 遺덈윭?ㅻ뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.");
                }
            }
        })();

        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [confId, auth.user, conferenceChecked, conferenceEnded]);

    useLayoutEffect(() => {
        if (!uiData) return;

        const updateLiveMinutes = () => {
            if (uiData.status !== "INSIDE" || !uiData.lastCheckIn) {
                setLiveMinutes(uiData.baseMinutes || 0);
                return;
            }

            const now = new Date();
            const start = uiData.lastCheckIn.toDate();
            let boundedStart = start;
            let boundedEnd = now;
            const todayStr = getKstToday();
            const zoneRule = zones.find(z => z.id === uiData.zone && z.ruleDate === todayStr) || zones.find((zone) => zone.id === uiData.zone);

            if (zoneRule?.start && zoneRule.end) {
                const localDateStr = zoneRule.ruleDate || `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
                const sessionStart = new Date(`${localDateStr}T${zoneRule.start}:00+09:00`);
                const sessionEnd = new Date(`${localDateStr}T${zoneRule.end}:00+09:00`);
                boundedStart = new Date(Math.max(start.getTime(), sessionStart.getTime()));
                boundedEnd = new Date(Math.min(now.getTime(), sessionEnd.getTime()));
            }

            let diffMinutes = 0;
            if (boundedEnd > boundedStart) {
                diffMinutes = Math.floor((boundedEnd.getTime() - boundedStart.getTime()) / 60000);
            }

            let deduction = 0;
            zoneRule?.breaks?.forEach((breakTime) => {
                const localDateStr = zoneRule.ruleDate || `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
                const breakStart = new Date(`${localDateStr}T${breakTime.start}:00+09:00`);
                const breakEnd = new Date(`${localDateStr}T${breakTime.end}:00+09:00`);
                const overlapStart = Math.max(boundedStart.getTime(), breakStart.getTime());
                const overlapEnd = Math.min(boundedEnd.getTime(), breakEnd.getTime());
                if (overlapEnd > overlapStart) {
                    deduction += Math.floor((overlapEnd - overlapStart) / 60000);
                }
            });

            setLiveMinutes((uiData.baseMinutes || 0) + Math.max(0, diffMinutes - deduction));
        };

        updateLiveMinutes();
        const timer = setInterval(updateLiveMinutes, 30000);
        return () => clearInterval(timer);
    }, [uiData, zones]);

    useLayoutEffect(() => {
        if (!confId || !uiData?.userId) return;

        let unsubscribeStamps = () => { };
        let unsubscribeProgress = () => { };

        const fetchStampTour = async () => {
            try {
                const configSnap = await getDoc(doc(db, `conferences/${confId}/settings`, "stamp_tour"));
                if (configSnap.exists()) {
                    const cfg = configSnap.data() as Partial<StampTourConfig>;
                    setStampConfig({
                        enabled: cfg.enabled === true,
                        endAt: cfg.endAt,
                        completionRule: cfg.completionRule || { type: "COUNT", requiredCount: 5 },
                        boothOrderMode: cfg.boothOrderMode || "SPONSOR_ORDER",
                        customBoothOrder: cfg.customBoothOrder || [],
                        rewardMode: cfg.rewardMode || "RANDOM",
                        drawMode: cfg.drawMode || "PARTICIPANT",
                        rewardFulfillmentMode: cfg.rewardFulfillmentMode || "INSTANT",
                        lotteryScheduledAt: cfg.lotteryScheduledAt,
                        rewards: Array.isArray(cfg.rewards) ? cfg.rewards : [],
                        soldOutMessage: cfg.soldOutMessage,
                        completionMessage: cfg.completionMessage
                    });
                } else {
                    setStampConfig(null);
                }

                const sponsorsSnap = await getDocs(
                    query(collection(db, `conferences/${confId}/sponsors`), where("isStampTourParticipant", "==", true))
                );
                const boothCandidates = sponsorsSnap.docs.map((snapshot) => {
                    const sponsor = snapshot.data() as { vendorId?: string; name?: string };
                    return {
                        id: sponsor.vendorId || snapshot.id,
                        name: sponsor.name || snapshot.id
                    };
                });
                setStampBoothCandidates(boothCandidates);
                setTotalVendors(boothCandidates.length);

                unsubscribeStamps = onSnapshot(
                    query(collection(db, `conferences/${confId}/stamps`), where("userId", "==", uiData.userId)),
                    (snapshot) => {
                        const uniqueVendors = Array.from(new Set(
                            snapshot.docs
                                .map((stampDoc) => (stampDoc.data() as { vendorId?: string }).vendorId)
                                .filter(Boolean)
                        )) as string[];
                        setMyStamps(uniqueVendors);
                    }
                );

                unsubscribeProgress = onSnapshot(
                    doc(db, `conferences/${confId}/stamp_tour_progress/${uiData.userId}`),
                    (snapshot) => {
                        setStampProgress(snapshot.exists() ? snapshot.data() as StampProgress : {});
                    }
                );

                const guestbookSnap = await getDocs(
                    query(collection(db, `conferences/${confId}/guestbook_entries`), where("userId", "==", uiData.userId))
                );
                setGuestbookEntries(
                    guestbookSnap.docs.map((guestbookDoc) => {
                        const guestbook = guestbookDoc.data() as { vendorName?: string; message?: string; timestamp?: Timestamp };
                        return {
                            vendorName: guestbook.vendorName || "Vendor",
                            message: guestbook.message,
                            timestamp: guestbook.timestamp
                        };
                    })
                );
            } catch (error) {
                console.error("Failed to load stamp tour data", error);
            }
        };

        fetchStampTour();

        return () => {
            unsubscribeStamps();
            unsubscribeProgress();
        };
    }, [confId, uiData?.userId]);

    const orderedBooths = useMemo(() => {
        if (!stampConfig?.enabled) return [];
        if (stampConfig.boothOrderMode === "CUSTOM" && stampConfig.customBoothOrder?.length) {
            const priority = stampConfig.customBoothOrder
                .map((boothId) => stampBoothCandidates.find((candidate) => candidate.id === boothId))
                .filter(Boolean) as Array<{ id: string; name: string }>;
            const remaining = stampBoothCandidates.filter((candidate) => !stampConfig.customBoothOrder?.includes(candidate.id));
            return [...priority, ...remaining];
        }
        return stampBoothCandidates;
    }, [stampBoothCandidates, stampConfig]);

    const stampBooths = useMemo(() => {
        const stamped = new Set(myStamps);
        return orderedBooths.map((booth) => ({ ...booth, isStamped: stamped.has(booth.id) }));
    }, [myStamps, orderedBooths]);

    const requiredCount = stampConfig?.enabled
        ? getStampMissionTargetCount(stampConfig.completionRule, stampBoothCandidates.length)
        : 0;
    const isCompleted = stampConfig?.enabled ? (requiredCount > 0 && myStamps.length >= requiredCount) : false;
    const rewardStatus = stampProgress.rewardStatus || "NONE";
    const completedAtMs = stampProgress.completedAt?.toDate().getTime();
    const lotteryScheduledAtMs = stampConfig?.lotteryScheduledAt?.toDate().getTime();
    const completedBeforeLotteryCutoff = lotteryScheduledAtMs == null || completedAtMs == null || completedAtMs <= lotteryScheduledAtMs;
    const lotteryStatus = stampProgress.lotteryStatus || (
        stampConfig?.rewardFulfillmentMode === "LOTTERY"
        && isCompleted
        && completedBeforeLotteryCutoff
            ? "PENDING"
            : undefined
    );
    const isInstantReward = stampConfig?.rewardFulfillmentMode !== "LOTTERY";
    const canParticipantDraw = isInstantReward && stampConfig?.drawMode !== "ADMIN";
    const missedLotteryCutoff = !isInstantReward
        && rewardStatus === "NONE"
        && !completedBeforeLotteryCutoff;

    const handleRewardRequest = async () => {
        if (!confId || !uiData?.userId || !stampConfig?.enabled) return;

        setRewardRequesting(true);
        setRewardMessage("");
        try {
            const requestReward = httpsCallable(functions, "requestStampReward");
            const response = await requestReward({
                confId,
                userName: uiData.name,
                userOrg: uiData.aff
            });

            const payload = response.data as { rewardName?: string };
            setRewardMessage(
                payload.rewardName
                    ? t(`상품 요청이 접수되었습니다. ${payload.rewardName}`, `Reward request received. ${payload.rewardName}`)
                    : t("상품 요청이 접수되었습니다.", "Reward request received.")
            );
        } catch (error) {
            setRewardMessage(error instanceof Error ? error.message : t("요청 처리에 실패했습니다.", "Request failed."));
        } finally {
            setRewardRequesting(false);
        }
    };

    if (msg) {
        return (
            <div className="flex min-h-screen items-center justify-center p-10 text-center font-bold text-gray-500">
                {msg}
            </div>
        );
    }

    if (!uiData) {
        return (
            <div className="flex min-h-screen items-center justify-center p-10 text-center">
                {t("명찰 정보를 불러오지 못했습니다.", "Unable to load badge information.")}
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center bg-eregi-neutral-50 p-4 font-body">
            <div className="mb-4 flex w-full max-w-sm justify-end gap-2">
                <button
                    type="button"
                    onClick={() => setBadgeLang("ko")}
                    className={`rounded-full px-4 py-2 text-sm font-body font-semibold transition-colors ${badgeLang === "ko" ? "bg-eregi-primary text-eregi-primary-foreground" : "border border-eregi-neutral-200 bg-card text-muted-foreground hover:bg-eregi-neutral-50"}`}
                >
                    한국어
                </button>
                <button
                    type="button"
                    onClick={() => setBadgeLang("en")}
                    className={`rounded-full px-4 py-2 text-sm font-body font-semibold transition-colors ${badgeLang === "en" ? "bg-eregi-primary text-eregi-primary-foreground" : "border border-eregi-neutral-200 bg-card text-muted-foreground hover:bg-eregi-neutral-50"}`}
                >
                    English
                </button>
            </div>
            <div 
                className={`w-full max-w-sm rounded-xl border-2 p-6 text-center shadow-lg transition-all ${uiData.issued ? "border-eregi-primary/30 bg-card" : "border-eregi-primary/20 bg-card"}`}
                style={{ backgroundColor: badgeConfig?.bgColor }}
            >
                <h1 
                    className="mb-6 text-xl font-display font-semibold tracking-wide text-eregi-primary"
                    style={{ color: badgeConfig?.textColor }}
                >
                    {uiData.issued ? t("디지털 명찰", "Digital Badge") : t("등록 확인 바우처", "Registration Voucher")}
                </h1>

                <div className="mb-6 inline-block rounded-xl border border-eregi-neutral-200 bg-card p-5 shadow-md">
                    <QRCode key={uiData.qrValue} value={uiData.qrValue || "ERROR"} size={180} />
                </div>

                <h2 className="mb-3 text-3xl font-display font-semibold tracking-tight text-foreground">{uiData.name}</h2>
                <p className="mb-6 text-lg font-body font-medium text-muted-foreground">{uiData.aff}</p>

                {uiData.issued ? (
                    <>
                        <div className={`mt-6 flex items-center justify-center gap-2 rounded-lg px-5 py-4 text-lg font-body font-semibold ${uiData.status === "INSIDE" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-eregi-neutral-100 text-muted-foreground border border-eregi-neutral-200"}`}>
                            {uiData.status === "INSIDE" ? t("입장 완료", "Checked In") : t("퇴장 상태", "Checked Out")}
                        </div>
                        {liveMinutes > 0 && (
                            <div className="mt-4 flex flex-col gap-2">
                                <div className="flex items-center justify-between rounded-lg border border-eregi-primary/20 bg-eregi-primary/5 px-5 py-3 text-base font-body font-medium text-eregi-primary">
                                    <span>{t("총 체류 시간", "Total stay")}</span>
                                    <span className="font-semibold">{formatMinutes(liveMinutes)}</span>
                                </div>
                                {uiData.isCompleted && (
                                    <div className="flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-2 text-sm font-body font-semibold text-emerald-700">
                                        {t("✅ 수강 인정 시간 달성", "✅ Attendance Goal Met")}
                                    </div>
                                )}

                                {badgeConfig?.menuVisibility?.certificate !== false && (
                                    <div className="mt-2">
                                        <CertificateDownloader 
                                            confId={confId || ""} 
                                            ui={uiData} 
                                            badgeLang={badgeLang} 
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="mt-6 rounded-lg bg-eregi-primary/5 border border-eregi-primary/20 px-5 py-4 text-base font-body font-medium text-eregi-primary">
                        {t("현장 인포데스크에서 위 QR 코드를 제시하세요", "Please show this QR code at the registration desk")}
                    </div>
                )}
            </div>

            {uiData.issued && stampConfig?.enabled && (
                <div className="mt-6 w-full max-w-sm space-y-4">
                    <div className="rounded-xl border border-eregi-primary/20 bg-eregi-primary/5 p-6 text-center shadow-sm">
                        <h3 className="mb-3 text-xl font-display font-semibold text-eregi-primary">{t("스탬프 투어", "Stamp Tour")}</h3>
                        <p className="mb-6 text-base font-body text-eregi-primary/80 leading-relaxed">{t("참여 부스를 방문하고 스탬프를 모아보세요", "Visit participating booths and collect stamps")}</p>

                        <div className="mb-3 flex items-center justify-between text-base font-body font-medium text-eregi-primary">
                            <span>{t("현재 진행 현황", "Current progress")}</span>
                            <span className="rounded-full bg-card px-4 py-2 text-eregi-primary font-semibold border border-eregi-primary/20">
                                {myStamps.length} / {requiredCount || totalVendors}
                            </span>
                        </div>

                        <div className="mb-6 h-3 w-full overflow-hidden rounded-full bg-eregi-neutral-200">
                            <div
                                className="h-3 rounded-full bg-eregi-primary transition-all duration-1000 ease-out"
                                style={{ width: `${Math.min(100, requiredCount > 0 ? (myStamps.length / requiredCount) * 100 : 0)}%` }}
                            />
                        </div>

                        {isCompleted && (
                            <div className="mt-6 space-y-3">
                                <div className="text-base font-body font-semibold text-eregi-primary">
                                    {stampConfig.completionMessage || t("스탬프 투어를 완료했습니다!", "Stamp tour completed!")}
                                </div>
                                {rewardStatus === "NONE" && canParticipantDraw && (
                                    <button
                                        type="button"
                                        className="w-full rounded-lg bg-eregi-primary py-3 text-base font-body font-semibold text-eregi-primary-foreground disabled:opacity-50 transition-colors hover:bg-eregi-primary/90"
                                        onClick={handleRewardRequest}
                                        disabled={rewardRequesting}
                                    >
                                        {rewardRequesting ? t("처리 중...", "Processing...") : t("상품 요청", "Request reward")}
                                    </button>
                                )}
                                {rewardStatus === "NONE" && !canParticipantDraw && isInstantReward && (
                                    <div className="rounded-lg bg-eregi-primary/10 border border-eregi-primary/20 py-3 px-4 text-base font-body font-medium text-eregi-primary">
                                        {t("관리자 추첨 대기 중", "Waiting for admin draw")}
                                    </div>
                                )}
                                {!isInstantReward && lotteryStatus === "PENDING" && (
                                    <div className="rounded-lg bg-eregi-primary/10 border border-eregi-primary/20 py-3 px-4 text-base font-body font-medium text-eregi-primary">
                                        {t("예약 추첨 대기 중", "Scheduled draw pending")}
                                    </div>
                                )}
                                {!isInstantReward && lotteryStatus === "PENDING" && stampConfig.lotteryScheduledAt && (
                                    <div className="text-sm font-body text-eregi-primary/70">
                                        {t("추첨 예정", "Scheduled draw")}: {stampConfig.lotteryScheduledAt.toDate().toLocaleString(badgeLang === "ko" ? "ko-KR" : "en-US")}
                                    </div>
                                )}
                                {missedLotteryCutoff && (
                                    <div className="rounded-lg bg-eregi-neutral-100 border border-eregi-neutral-200 py-3 px-4 text-base font-body font-medium text-muted-foreground">
                                        {t("예약 추첨 마감 이후 완료되어 이번 추첨 대상에서 제외되었습니다", "Completed after the draw cutoff, excluded from this round")}
                                    </div>
                                )}
                                {rewardStatus === "REQUESTED" && (
                                    <div className="rounded-lg bg-amber-50 border border-amber-200 py-3 px-4 text-base font-body font-medium text-amber-700">
                                        {t("상품 요청 완료", "Reward request submitted")}
                                    </div>
                                )}
                                {rewardStatus === "REDEEMED" && (
                                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 py-3 px-4 text-base font-body font-medium text-emerald-700">
                                        {t("상품 수령 완료", "Reward redeemed")}
                                    </div>
                                )}
                                {!isInstantReward && lotteryStatus === "NOT_SELECTED" && (
                                    <div className="rounded-lg bg-eregi-neutral-100 border border-eregi-neutral-200 py-3 px-4 text-base font-body font-medium text-muted-foreground">
                                        {t("이번 추첨에서는 미당첨입니다", "Not selected in this draw")}
                                    </div>
                                )}
                                {rewardMessage && (
                                    <div className="text-sm font-body text-eregi-primary/70">{rewardMessage}</div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg border border-eregi-neutral-200 bg-card p-5 shadow-sm">
                        <h4 className="mb-4 text-base font-display font-semibold text-foreground">{t("참여 부스 안내", "Participating booths")}</h4>
                        {stampBooths.length === 0 ? (
                            <div className="text-sm font-body text-muted-foreground">{t("참여 부스가 없습니다", "No participating booths")}</div>
                        ) : (
                            <div className="space-y-3">
                                {stampBooths.map((booth) => (
                                    <div key={booth.id} className="flex items-center justify-between text-base">
                                        <span className="font-body font-medium text-foreground">{booth.name}</span>
                                        <span className={`rounded-full px-3 py-1 text-sm font-body font-medium ${booth.isStamped ? "bg-eregi-primary/10 text-eregi-primary border border-eregi-primary/20" : "bg-eregi-neutral-100 text-muted-foreground border border-eregi-neutral-200"}`}>
                                            {booth.isStamped ? t("완료", "Completed") : t("대기", "Pending")}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <h4 className="mb-3 text-sm font-bold text-slate-800">{t("방명록 참여 업체", "Guestbook booths")}</h4>
                        {guestbookEntries.length === 0 ? (
                            <div className="text-xs text-slate-400">{t("방명록 참여 업체가 없습니다.", "No guestbook booth entries.")}</div>
                        ) : (
                            <div className="space-y-2">
                                {guestbookEntries.map((entry, index) => (
                                    <div key={`${entry.vendorName}-${index}`} className="text-sm text-slate-700">
                                        <span className="font-medium">{entry.vendorName}</span>
                                        {entry.message && <span className="text-xs text-slate-500"> - {entry.message}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {uiData.issued && badgeConfig?.menuVisibility?.qna !== false && (
                <div className="mt-6 w-full max-w-sm">
                    <QnAPanel
                        confId={confId || ""}
                        userId={uiData.userId}
                        userName={uiData.name}
                        userAff={uiData.aff}
                        badgeLang={badgeLang}
                    />
                </div>
            )}

            <div className="mt-6 text-center">
                <p className="text-sm font-bold tracking-wider text-gray-500">REF: {uiData.receiptNumber}</p>
                <p className="mt-1 font-mono text-[10px] tracking-widest text-gray-300">ID: {uiData.id}</p>
            </div>
        </div>
    );
};

export default ConferenceBadgePage;
