import { useEffect, useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/firebase";
import { getStampMissionTargetCount } from "@/utils/stampTour";

type TimestampLike = {
  toDate: () => Date;
};

export type StampTourConfig = {
  enabled: boolean;
  endAt?: Timestamp;
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
    totalQty: number;
    remainingQty: number;
    weight?: number;
    order?: number;
    isFallback?: boolean;
  }>;
  soldOutMessage?: string;
  completionMessage?: string;
};

export type StampProgress = {
  rewardStatus?: "NONE" | "REQUESTED" | "REDEEMED";
  lotteryStatus?: "PENDING" | "SELECTED" | "NOT_SELECTED";
  rewardName?: string;
  isCompleted?: boolean;
  completedAt?: TimestampLike;
};

export type GuestbookEntry = {
  vendorName: string;
  message?: string;
  timestamp?: Timestamp;
};

export type StampBooth = {
  id: string;
  name: string;
  isStamped: boolean;
};

export type UseStampTourParams = {
  confId: string | undefined;
  userId: string | undefined;
  userName?: string;
  userOrg?: string;
};

export type UseStampTourReturn = {
  stampConfig: StampTourConfig | null;
  stampBoothCandidates: Array<{ id: string; name: string }>;
  stampBooths: StampBooth[];
  myStamps: string[];
  stampProgress: StampProgress;
  guestbookEntries: GuestbookEntry[];
  requiredCount: number;
  isCompleted: boolean;
  rewardStatus: "NONE" | "REQUESTED" | "REDEEMED";
  lotteryStatus: "PENDING" | "SELECTED" | "NOT_SELECTED" | undefined;
  isInstantReward: boolean;
  canParticipantDraw: boolean;
  missedLotteryCutoff: boolean;
  rewardRequesting: boolean;
  rewardMessage: string;
  handleRewardRequest: () => Promise<void>;
};

export const useStampTour = ({
  confId,
  userId,
  userName,
  userOrg,
}: UseStampTourParams): UseStampTourReturn => {
  const [stampConfig, setStampConfig] = useState<StampTourConfig | null>(null);
  const [stampBoothCandidates, setStampBoothCandidates] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [myStamps, setMyStamps] = useState<string[]>([]);
  const [stampProgress, setStampProgress] = useState<StampProgress>({});
  const [guestbookEntries, setGuestbookEntries] = useState<GuestbookEntry[]>(
    []
  );
  const [rewardRequesting, setRewardRequesting] = useState(false);
  const [rewardMessage, setRewardMessage] = useState("");

  useEffect(() => {
    if (!confId || !userId) return;

    let unsubscribeStamps = () => {};
    let unsubscribeProgress = () => {};

    const fetchStampTour = async () => {
      try {
        const configSnap = await getDoc(
          doc(db, `conferences/${confId}/settings`, "stamp_tour")
        );
        if (configSnap.exists()) {
          const cfg = configSnap.data() as Partial<StampTourConfig>;
          setStampConfig({
            enabled: cfg.enabled === true,
            endAt: cfg.endAt,
            completionRule: cfg.completionRule || {
              type: "COUNT",
              requiredCount: 5,
            },
            boothOrderMode: cfg.boothOrderMode || "SPONSOR_ORDER",
            customBoothOrder: cfg.customBoothOrder || [],
            rewardMode: cfg.rewardMode || "RANDOM",
            drawMode: cfg.drawMode || "PARTICIPANT",
            rewardFulfillmentMode: cfg.rewardFulfillmentMode || "INSTANT",
            lotteryScheduledAt: cfg.lotteryScheduledAt,
            rewards: Array.isArray(cfg.rewards) ? cfg.rewards : [],
            soldOutMessage: cfg.soldOutMessage,
            completionMessage: cfg.completionMessage,
          });
        } else {
          setStampConfig(null);
        }

        const sponsorsSnap = await getDocs(
          query(
            collection(db, `conferences/${confId}/sponsors`),
            where("isStampTourParticipant", "==", true)
          )
        );
        const boothCandidates = sponsorsSnap.docs.map((snapshot) => {
          const sponsor = snapshot.data() as {
            vendorId?: string;
            name?: string;
          };
          return {
            id: sponsor.vendorId || snapshot.id,
            name: sponsor.name || snapshot.id,
          };
        });
        setStampBoothCandidates(boothCandidates);

        unsubscribeStamps = onSnapshot(
          query(
            collection(db, `conferences/${confId}/stamps`),
            where("userId", "==", userId)
          ),
          (snapshot) => {
            const uniqueVendors = Array.from(
              new Set(
                snapshot.docs
                  .map(
                    (stampDoc) =>
                      (stampDoc.data() as { vendorId?: string }).vendorId
                  )
                  .filter(Boolean)
              )
            ) as string[];
            setMyStamps(uniqueVendors);
          }
        );

        unsubscribeProgress = onSnapshot(
          doc(db, `conferences/${confId}/stamp_tour_progress/${userId}`),
          (snapshot) => {
            setStampProgress(
              snapshot.exists() ? (snapshot.data() as StampProgress) : {}
            );
          }
        );

        const guestbookSnap = await getDocs(
          query(
            collection(db, `conferences/${confId}/guestbook_entries`),
            where("userId", "==", userId)
          )
        );
        setGuestbookEntries(
          guestbookSnap.docs.map((guestbookDoc) => {
            const guestbook = guestbookDoc.data() as {
              vendorName?: string;
              message?: string;
              timestamp?: Timestamp;
            };
            return {
              vendorName: guestbook.vendorName || "Partner Booth",
              message: guestbook.message,
              timestamp: guestbook.timestamp,
            };
          })
        );
      } catch (error) {
        console.error("[useStampTour] Failed to load stamp tour data", error);
      }
    };

    fetchStampTour();

    return () => {
      unsubscribeStamps();
      unsubscribeProgress();
    };
  }, [confId, userId]);

  const orderedBooths = useMemo(() => {
    if (!stampConfig?.enabled) return [];
    if (
      stampConfig.boothOrderMode === "CUSTOM" &&
      stampConfig.customBoothOrder?.length
    ) {
      const priority = stampConfig.customBoothOrder
        .map((boothId) =>
          stampBoothCandidates.find((candidate) => candidate.id === boothId)
        )
        .filter(Boolean) as Array<{ id: string; name: string }>;
      const remaining = stampBoothCandidates.filter(
        (candidate) => !stampConfig.customBoothOrder?.includes(candidate.id)
      );
      return [...priority, ...remaining];
    }
    return stampBoothCandidates;
  }, [stampBoothCandidates, stampConfig]);

  const stampBooths = useMemo<StampBooth[]>(() => {
    const stamped = new Set(myStamps);
    return orderedBooths.map((booth) => ({
      ...booth,
      isStamped: stamped.has(booth.id),
    }));
  }, [myStamps, orderedBooths]);

  const requiredCount = stampConfig?.enabled
    ? getStampMissionTargetCount(
        stampConfig.completionRule,
        stampBoothCandidates.length
      )
    : 0;

  const isCompleted = stampConfig?.enabled
    ? requiredCount > 0 && myStamps.length >= requiredCount
    : false;

  const rewardStatus = stampProgress.rewardStatus || "NONE";

  const completedAtMs = stampProgress.completedAt?.toDate().getTime();
  const lotteryScheduledAtMs =
    stampConfig?.lotteryScheduledAt?.toDate().getTime();
  const completedBeforeLotteryCutoff =
    lotteryScheduledAtMs == null ||
    completedAtMs == null ||
    completedAtMs <= lotteryScheduledAtMs;

  const lotteryStatus = stampProgress.lotteryStatus ||
    (stampConfig?.rewardFulfillmentMode === "LOTTERY" &&
    isCompleted &&
    completedBeforeLotteryCutoff
      ? "PENDING"
      : undefined);

  const isInstantReward = stampConfig?.rewardFulfillmentMode !== "LOTTERY";
  const canParticipantDraw =
    isInstantReward && stampConfig?.drawMode !== "ADMIN";
  const missedLotteryCutoff =
    !isInstantReward &&
    rewardStatus === "NONE" &&
    !completedBeforeLotteryCutoff;

  const handleRewardRequest = async () => {
    if (!confId || !userId || !stampConfig?.enabled) return;

    setRewardRequesting(true);
    setRewardMessage("");
    try {
      const requestReward = httpsCallable(functions, "requestStampReward");
      const response = await requestReward({
        confId,
        userName,
        userOrg,
      });

      const payload = response.data as { rewardName?: string };
      setRewardMessage(
        payload.rewardName
          ? `상품 요청이 접수되었습니다. ${payload.rewardName}`
          : "상품 요청이 접수되었습니다."
      );
    } catch (error) {
      setRewardMessage(
        error instanceof Error
          ? error.message
          : "요청 처리에 실패했습니다."
      );
    } finally {
      setRewardRequesting(false);
    }
  };

  return {
    stampConfig,
    stampBoothCandidates,
    stampBooths,
    myStamps,
    stampProgress,
    guestbookEntries,
    requiredCount,
    isCompleted,
    rewardStatus,
    lotteryStatus,
    isInstantReward,
    canParticipantDraw,
    missedLotteryCutoff,
    rewardRequesting,
    rewardMessage,
    handleRewardRequest,
  };
};
