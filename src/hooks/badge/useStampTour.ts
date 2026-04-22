import { useState, useEffect, useMemo } from 'react';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { getStampMissionTargetCount } from '@/utils/stampTour';

export interface StampTourConfig {
  enabled: boolean;
  completionRule: { type: "COUNT" | "ALL"; requiredCount?: number };
  boothOrderMode: "SPONSOR_ORDER" | "CUSTOM";
  customBoothOrder?: string[];
  rewardMode: "RANDOM" | "FIXED";
  drawMode?: "PARTICIPANT" | "ADMIN" | "BOTH";
  rewardFulfillmentMode?: "INSTANT" | "LOTTERY";
  lotteryScheduledAt?: any;
  rewards: Array<any>;
  soldOutMessage?: string;
  completionMessage?: string;
}

export interface StampProgress {
  rewardStatus?: "NONE" | "REQUESTED" | "REDEEMED";
  lotteryStatus?: "PENDING" | "SELECTED" | "NOT_SELECTED";
  rewardName?: string;
  isCompleted?: boolean;
  completedAt?: any;
}

export function useStampTour(confId: string | undefined, userId: string | undefined) {
  const [stampConfig, setStampConfig] = useState<StampTourConfig | null>(null);
  const [stampBoothCandidates, setStampBoothCandidates] = useState<Array<{ id: string; name: string }>>([]);
  const [myStamps, setMyStamps] = useState<string[]>([]);
  const [stampProgress, setStampProgress] = useState<StampProgress>({});
  const [guestbookEntries, setGuestbookEntries] = useState<Array<{ vendorName: string; message?: string; timestamp?: any }>>([]);
  const [totalVendors, setTotalVendors] = useState(0);

  useEffect(() => {
    if (!confId || !userId) return;

    const db = getFirestore();
    let unsubscribeStamps = () => {};
    let unsubscribeProgress = () => {};

    const fetchStampTour = async () => {
      try {
        const configSnap = await getDoc(doc(db, `conferences/${confId}/settings`, "stamp_tour"));
        if (configSnap.exists()) {
          setStampConfig(configSnap.data() as StampTourConfig);
        } else {
          setStampConfig(null);
        }

        const sponsorsSnap = await getDocs(
          query(collection(db, `conferences/${confId}/sponsors`), where("isStampTourParticipant", "==", true))
        );
        const boothCandidates = sponsorsSnap.docs.map((snapshot) => {
          const sponsor = snapshot.data();
          return {
            id: sponsor.vendorId || snapshot.id,
            name: sponsor.name || snapshot.id
          };
        });
        setStampBoothCandidates(boothCandidates);
        setTotalVendors(boothCandidates.length);

        unsubscribeStamps = onSnapshot(
          query(collection(db, `conferences/${confId}/stamps`), where("userId", "==", userId)),
          (snapshot) => {
            const uniqueVendors = Array.from(new Set(
              snapshot.docs
                .map((stampDoc) => stampDoc.data().vendorId)
                .filter(Boolean)
            )) as string[];
            setMyStamps(uniqueVendors);
          }
        );

        unsubscribeProgress = onSnapshot(
          doc(db, `conferences/${confId}/stamp_tour_progress/${userId}`),
          (snapshot) => {
            setStampProgress(snapshot.exists() ? (snapshot.data() as StampProgress) : {});
          }
        );

        const guestbookSnap = await getDocs(
          query(collection(db, `conferences/${confId}/guestbook_entries`), where("userId", "==", userId))
        );
        setGuestbookEntries(
          guestbookSnap.docs.map((guestbookDoc) => {
            const guestbook = guestbookDoc.data();
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
  }, [confId, userId]);

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

  return {
    stampConfig,
    stampProgress,
    stampBooths,
    guestbookEntries,
    requiredCount,
    isCompleted,
    totalVendors,
    myStamps
  };
}