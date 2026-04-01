import React, { useLayoutEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, Timestamp, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import QRCode from "react-qr-code";

import { useAuth } from "../hooks/useAuth";
import { db, functions } from "../firebase";
import { getStampMissionTargetCount } from "../utils/stampTour";

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

    const [uiData, setUiData] = useState<BadgeUiData | null>(null);
    const [zones, setZones] = useState<AttendanceZone[]>([]);
    const [liveMinutes, setLiveMinutes] = useState(0);
    const [msg, setMsg] = useState("초기화 중...");
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

    useLayoutEffect(() => {
        if (!slug) {
            setConferenceEnded(false);
            setConferenceChecked(true);
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const confSnap = await getDoc(doc(db, "conferences", slug));
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
    }, [slug]);

    useLayoutEffect(() => {
        if (!slug) {
            setMsg("유효하지 않은 학회 경로입니다.");
            return;
        }
        if (!conferenceChecked) {
            setMsg("행사 종료 여부를 확인하는 중입니다...");
            return;
        }
        if (conferenceEnded) {
            setMsg("종료된 학회입니다.");
            return;
        }
        if (!auth.user) {
            setMsg("인증이 만료되었습니다. 다시 접속해 주세요.");
            return;
        }

        setMsg("명찰 정보를 불러오는 중입니다...");
        const userId = auth.user.id;
        const registrationQuery = query(
            collection(db, `conferences/${slug}/registrations`),
            where("userId", "==", userId),
            where("paymentStatus", "==", "PAID"),
            orderBy("createdAt", "desc")
        );

        import("firebase/firestore").then(async ({ doc, getDoc }) => {
            try {
                const rulesSnap = await getDoc(doc(db, `conferences/${slug}/settings/attendance`));
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

        const unsubscribe = onSnapshot(registrationQuery, (snapshot) => {
            if (snapshot.empty) {
                setUiData(null);
                setMsg("등록 정보를 찾을 수 없습니다.");
                return;
            }

            const registration = snapshot.docs[0].data();
            const paymentStatus = registration?.paymentStatus || "UNKNOWN";
            if (paymentStatus !== "PAID") {
                setUiData(null);
                setMsg(`결제가 완료되지 않았습니다. 결제 상태: ${paymentStatus}`);
                return;
            }

            const regId = snapshot.docs[0].id;
            const voucherQr = String(registration.confirmationQr || regId);
            const badgeQr = String(registration.badgeQr || `BADGE-${regId}`);
            const qrValue = registration.badgeIssued ? badgeQr : voucherQr;
            const baseMinutes = Number(registration.totalMinutes || 0);

            setUiData({
                status: String(registration.attendanceStatus || "OUTSIDE"),
                zone: String(registration.attendanceStatus === "INSIDE" ? (registration.currentZone || "Inside") : "OUTSIDE"),
                name: String(registration.userName || registration.name || "이름 없음"),
                aff: String(registration.affiliation || registration.organization || registration.userAffiliation || registration.userInfo?.affiliation || "소속 없음"),
                id: String(regId),
                userId: String(registration.userId || regId),
                issued: !!registration.badgeIssued,
                qrValue,
                receiptNumber: String(registration.receiptNumber || registration.orderId || "-"),
                lastCheckIn: registration.lastCheckIn,
                baseMinutes
            });
            setLiveMinutes(baseMinutes);
            setMsg("");
        });

        return () => unsubscribe();
    }, [slug, auth.user, conferenceChecked, conferenceEnded]);

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
            const zoneRule = zones.find((zone) => zone.id === uiData.zone);

            if (zoneRule?.start && zoneRule.end) {
                const localDateStr = zoneRule.ruleDate || `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
                const sessionStart = new Date(`${localDateStr}T${zoneRule.start}:00`);
                const sessionEnd = new Date(`${localDateStr}T${zoneRule.end}:00`);
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
                const breakStart = new Date(`${localDateStr}T${breakTime.start}:00`);
                const breakEnd = new Date(`${localDateStr}T${breakTime.end}:00`);
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
        if (!slug || !uiData?.userId) return;

        let unsubscribeStamps = () => { };
        let unsubscribeProgress = () => { };

        const fetchStampTour = async () => {
            try {
                const configSnap = await getDoc(doc(db, `conferences/${slug}/settings`, "stamp_tour"));
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
                    query(collection(db, `conferences/${slug}/sponsors`), where("isStampTourParticipant", "==", true))
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
                    query(collection(db, `conferences/${slug}/stamps`), where("userId", "==", uiData.userId)),
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
                    doc(db, `conferences/${slug}/stamp_tour_progress/${uiData.userId}`),
                    (snapshot) => {
                        setStampProgress(snapshot.exists() ? snapshot.data() as StampProgress : {});
                    }
                );

                const guestbookSnap = await getDocs(
                    query(collection(db, `conferences/${slug}/guestbook_entries`), where("userId", "==", uiData.userId))
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
    }, [slug, uiData?.userId]);

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
        if (!slug || !uiData?.userId || !stampConfig?.enabled) return;

        setRewardRequesting(true);
        setRewardMessage("");
        try {
            const requestReward = httpsCallable(functions, "requestStampReward");
            const response = await requestReward({
                confId: slug,
                userName: uiData.name,
                userOrg: uiData.aff
            });

            const payload = response.data as { rewardName?: string };
            setRewardMessage(
                payload.rewardName
                    ? `상품 수령 요청이 접수되었습니다. ${payload.rewardName}`
                    : "상품 수령 요청이 접수되었습니다."
            );
        } catch (error) {
            setRewardMessage(error instanceof Error ? error.message : "요청 처리에 실패했습니다.");
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
                명찰 정보를 불러오지 못했습니다.
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center bg-white p-4 font-sans">
            <div className={`w-full max-w-sm rounded-3xl border-4 p-8 text-center shadow-2xl transition-all ${uiData.issued ? "border-blue-600" : "border-gray-300"}`}>
                <h1 className="mb-6 text-xl font-bold uppercase tracking-wide text-gray-800">
                    {uiData.issued ? "Mobile Access Badge" : "Registration Voucher"}
                </h1>

                <div className="mb-6 inline-block rounded-2xl border border-gray-100 bg-white p-4 shadow-inner">
                    <QRCode key={uiData.qrValue} value={uiData.qrValue || "ERROR"} size={180} />
                </div>

                <h2 className="mb-2 text-3xl font-black tracking-tight text-gray-900">{uiData.name}</h2>
                <p className="mb-6 text-lg font-medium text-gray-600">{uiData.aff}</p>

                {uiData.issued ? (
                    <>
                        <div className={`mt-6 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-lg font-bold ${uiData.status === "INSIDE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {uiData.status === "INSIDE" ? "입장 중 (INSIDE)" : "퇴장 상태 (OUTSIDE)"}
                        </div>
                        {liveMinutes > 0 && (
                            <div className="mt-3 flex items-center justify-between rounded-xl border border-purple-100 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700">
                                <span>총 체류 시간</span>
                                <span>{Math.floor(liveMinutes / 60)}시간 {liveMinutes % 60}분</span>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="mt-6 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
                        현장 데스크에서 QR 코드를 제시해 주세요.
                    </div>
                )}
            </div>

            {uiData.issued && stampConfig?.enabled && (
                <div className="mt-6 w-full max-w-sm space-y-4">
                    <div className="rounded-3xl border-2 border-dashed border-indigo-400 bg-indigo-50 p-6 text-center shadow-md">
                        <h3 className="mb-2 text-xl font-bold text-indigo-900">부스 스탬프 투어</h3>
                        <p className="mb-4 text-sm text-indigo-700">참여 부스를 방문하고 스탬프를 모아보세요.</p>

                        <div className="mb-2 flex items-center justify-between text-sm font-bold text-indigo-800">
                            <span>현재 진행 상황</span>
                            <span className="rounded-full bg-white px-3 py-1 text-indigo-600 shadow-sm">
                                {myStamps.length} / {requiredCount || totalVendors}
                            </span>
                        </div>

                        <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-indigo-200">
                            <div
                                className="h-3 rounded-full bg-indigo-600 transition-all duration-1000 ease-out"
                                style={{ width: `${Math.min(100, requiredCount > 0 ? (myStamps.length / requiredCount) * 100 : 0)}%` }}
                            />
                        </div>

                        {isCompleted && (
                            <div className="mt-4 space-y-2">
                                <div className="text-sm font-semibold text-indigo-900">
                                    {stampConfig.completionMessage || "스탬프 투어를 완료했습니다."}
                                </div>
                                {rewardStatus === "NONE" && canParticipantDraw && (
                                    <button
                                        type="button"
                                        className="w-full rounded-xl bg-indigo-600 py-2 text-sm font-bold text-white disabled:opacity-50"
                                        onClick={handleRewardRequest}
                                        disabled={rewardRequesting}
                                    >
                                        상품 수령 요청
                                    </button>
                                )}
                                {rewardStatus === "NONE" && !canParticipantDraw && isInstantReward && (
                                    <div className="rounded-xl bg-sky-100 py-2 text-sm font-semibold text-sky-700">
                                        관리자 추첨 대기 중
                                    </div>
                                )}
                                {!isInstantReward && lotteryStatus === "PENDING" && (
                                    <div className="rounded-xl bg-sky-100 py-2 text-sm font-semibold text-sky-700">
                                        예약 추첨 대기 중
                                    </div>
                                )}
                                {!isInstantReward && lotteryStatus === "PENDING" && stampConfig.lotteryScheduledAt && (
                                    <div className="text-xs text-indigo-700">
                                        추첨 예정: {stampConfig.lotteryScheduledAt.toDate().toLocaleString("ko-KR")}
                                    </div>
                                )}
                                {missedLotteryCutoff && (
                                    <div className="rounded-xl bg-slate-100 py-2 text-sm font-semibold text-slate-600">
                                        예약 추첨 마감 이후에 미션을 완료해 이번 회차 추첨 대상에서는 제외되었습니다.
                                    </div>
                                )}
                                {rewardStatus === "REQUESTED" && (
                                    <div className="rounded-xl bg-amber-100 py-2 text-sm font-semibold text-amber-700">
                                        상품 수령 요청 완료 (인포데스크 확인)
                                    </div>
                                )}
                                {rewardStatus === "REDEEMED" && (
                                    <div className="rounded-xl bg-emerald-100 py-2 text-sm font-semibold text-emerald-700">
                                        상품 수령 완료
                                    </div>
                                )}
                                {!isInstantReward && lotteryStatus === "NOT_SELECTED" && (
                                    <div className="rounded-xl bg-slate-100 py-2 text-sm font-semibold text-slate-600">
                                        이번 추첨에서는 미당첨입니다.
                                    </div>
                                )}
                                {rewardMessage && (
                                    <div className="text-xs text-indigo-700">{rewardMessage}</div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <h4 className="mb-3 text-sm font-bold text-slate-800">참여 부스 안내</h4>
                        {stampBooths.length === 0 ? (
                            <div className="text-xs text-slate-400">참여 부스가 없습니다.</div>
                        ) : (
                            <div className="space-y-2">
                                {stampBooths.map((booth) => (
                                    <div key={booth.id} className="flex items-center justify-between text-sm">
                                        <span className="font-medium text-slate-700">{booth.name}</span>
                                        <span className={`rounded-full px-2 py-1 text-xs ${booth.isStamped ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
                                            {booth.isStamped ? "스탬프 완료" : "미완료"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <h4 className="mb-3 text-sm font-bold text-slate-800">방명록 참여 업체</h4>
                        {guestbookEntries.length === 0 ? (
                            <div className="text-xs text-slate-400">방명록 참여 업체가 없습니다.</div>
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

            <div className="mt-6 text-center">
                <p className="text-sm font-bold tracking-wider text-gray-500">REF: {uiData.receiptNumber}</p>
                <p className="mt-1 font-mono text-[10px] tracking-widest text-gray-300">ID: {uiData.id}</p>
            </div>
        </div>
    );
};

export default ConferenceBadgePage;
