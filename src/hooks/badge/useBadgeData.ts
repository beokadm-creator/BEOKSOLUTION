import { useState, useEffect, useRef } from "react";
import { getFirestore, collection, query, where, orderBy, getDocs, onSnapshot, doc, getDoc } from "firebase/firestore";
import { isBadgeIssued, getBadgeDisplayName, getBadgeDisplayAffiliation, BadgeRecordSource } from "@/utils/badgeRecord";
import type { BadgeConfig, BadgeUiState } from "@/types/badge";

type BadgeUiData = BadgeUiState & {
  qrValue: string;
  zone: string;
  baseMinutes?: number;
  isCompleted?: boolean;
};

export type BadgeStrategy = 
  | { type: 'AUTH'; userId: string; confId: string }
  | { type: 'TOKEN'; token: string; confId: string };

export function useBadgeData(strategy: BadgeStrategy) {
  const db = getFirestore();
  const [status, setStatus] = useState<"INIT" | "LOADING" | "READY" | "NO_AUTH" | "NO_DATA" | "REDIRECTING">("INIT");
  const [msg, setMsg] = useState("초기화 중...");
  const [uiData, setUiData] = useState<BadgeUiData | null>(null);
  const [badgeConfig, setBadgeConfig] = useState<BadgeConfig | null>(null);
  const [zones, setZones] = useState<any[]>([]);

  const lastQueryRef = useRef<any>(null);
  const lastSourceRef = useRef<BadgeRecordSource | null>(null);

  useEffect(() => {
    let unsubscribeDB: (() => void) | null = null;

    const fetchData = async () => {
      setStatus("LOADING");
      setMsg("데이터를 불러오는 중입니다...");

      try {
        // Fetch Settings first
        const rulesRef = doc(db, `conferences/${strategy.confId}/settings/attendance`);
        const configRef = doc(db, `conferences/${strategy.confId}/settings/badge_config`);
        
        const [rulesSnap, configSnap] = await Promise.all([getDoc(rulesRef), getDoc(configRef)]);
        
        if (rulesSnap.exists()) {
          const attendanceSettings = rulesSnap.data();
          const allRules = attendanceSettings.rules || {};
          const allZones: any[] = [];
          Object.entries(allRules).forEach(([dateStr, rule]: [string, any]) => {
            if (rule && rule.zones) {
              rule.zones.forEach((z: any) => {
                allZones.push({ ...z, ruleDate: dateStr });
              });
            }
          });
          setZones(allZones);
        }
        
        if (configSnap.exists()) {
          setBadgeConfig(configSnap.data() as BadgeConfig);
        }

        // Fetch Badge Document
        let targetQuery: any = null;
        let targetSource: BadgeRecordSource | null = null;

        if (strategy.type === 'AUTH') {
          const qReg = query(
            collection(db, "conferences", strategy.confId, "registrations"),
            where("userId", "==", strategy.userId),
            where("paymentStatus", "==", "PAID"),
            orderBy("createdAt", "desc")
          );
          const qExt = query(
            collection(db, "conferences", strategy.confId, "external_attendees"),
            where("userId", "==", strategy.userId),
            where("paymentStatus", "==", "PAID")
          );

          const snapReg = await getDocs(qReg);
          if (!snapReg.empty) {
            targetQuery = qReg;
            targetSource = "registrations";
          } else {
            const snapExt = await getDocs(qExt);
            if (!snapExt.empty) {
              targetQuery = qExt;
              targetSource = "external_attendees";
            }
          }
        } else if (strategy.type === 'TOKEN') {
          // Token strategy usually involves a cloud function to validate, but here we just fetch directly if we know the regId from token
          // Since BadgePrepPage has the token validation logic via cloud functions, we can handle it there, but let's assume we pass the regId directly
          // For now, if type is token, we assume strategy.userId is actually the document ID and collection
        }

        if (!targetQuery || !targetSource) {
          setStatus("NO_DATA");
          setMsg("등록 정보를 찾을 수 없습니다.");
          return;
        }

        lastQueryRef.current = targetQuery;
        lastSourceRef.current = targetSource;

        unsubscribeDB = onSnapshot(targetQuery, (snap) => {
          if (snap.empty) {
            setStatus("NO_DATA");
            setMsg("등록 정보를 찾을 수 없습니다.");
            return;
          }

          const docSnap = snap.docs[0];
          const d = docSnap.data();
          const isIssued = isBadgeIssued(d, targetSource!);

          setUiData({
            id: docSnap.id,
            userId: d.userId,
            name: getBadgeDisplayName(d),
            aff: getBadgeDisplayAffiliation(d),
            issued: isIssued,
            qrValue: isIssued ? (d.badgeQr || docSnap.id) : (d.confirmationQr || docSnap.id),
            receiptNumber: d.receiptNumber,
            status: String(d.attendanceStatus || "OUTSIDE"),
            zone: String(d.attendanceStatus === "INSIDE" ? d.currentZone || "Inside" : "OUTSIDE"),
            lastCheckIn: d.lastCheckIn,
            baseMinutes: d.totalMinutes || 0,
            isCompleted: d.isCompleted || false
          });

          setStatus("READY");
        }, (err) => {
          console.error("Live update error:", err);
          setStatus("NO_DATA");
          setMsg("데이터 실시간 연동 오류");
        });

      } catch (err) {
        console.error(err);
        setStatus("NO_DATA");
        setMsg("데이터를 불러오는 데 실패했습니다.");
      }
    };

    fetchData();

    return () => {
      if (unsubscribeDB) unsubscribeDB();
    };
  }, [strategy.confId, strategy.type, (strategy as any).userId]);

  return { status, msg, uiData, badgeConfig, zones, lastQueryRef, lastSourceRef, setUiData };
}