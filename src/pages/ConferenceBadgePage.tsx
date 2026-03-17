import React, { useLayoutEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db, functions } from '../firebase';
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, setDoc, Timestamp, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import QRCode from 'react-qr-code';

const ConferenceBadgePage: React.FC = () => {
  const { slug } = useParams();
  const { auth } = useAuth();
  const [uiData, setUiData] = useState<{
    status: string;
    zone: string;
    name: string;
    aff: string;
    id: string;
    userId: string;
    issued: boolean;
    qrValue: string;
    receiptNumber: string;
    lastCheckIn: any;
    baseMinutes: number;
  } | null>(null);
  const [zones, setZones] = useState<any[]>([]);
  const [liveMinutes, setLiveMinutes] = useState<number>(0);
  const [msg, setMsg] = useState("초기화 중...");
  const [conferenceEnded, setConferenceEnded] = useState(false);
  const [conferenceChecked, setConferenceChecked] = useState(false);

  // Gamification states
  const [totalVendors, setTotalVendors] = useState<number>(0);
  const [myStamps, setMyStamps] = useState<string[]>([]);
  const [stampConfig, setStampConfig] = useState<{
    enabled: boolean;
    endAt?: Timestamp;
    completionRule: { type: 'COUNT' | 'ALL'; requiredCount?: number };
    boothOrderMode: 'SPONSOR_ORDER' | 'CUSTOM';
    customBoothOrder?: string[];
    rewardMode: 'RANDOM' | 'FIXED';
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
  } | null>(null);
  const [stampBoothCandidates, setStampBoothCandidates] = useState<Array<{ id: string; name: string }>>([]);
  const [stampBooths, setStampBooths] = useState<Array<{ id: string; name: string; isStamped: boolean }>>([]);
  const [stampProgress, setStampProgress] = useState<{
    rewardStatus?: 'NONE' | 'REQUESTED' | 'REDEEMED';
    rewardName?: string;
    isCompleted?: boolean;
  }>({});
  const [guestbookEntries, setGuestbookEntries] = useState<Array<{ vendorName: string; message?: string; timestamp?: Timestamp }>>([]);
  const [rewardRequesting, setRewardRequesting] = useState(false);
  const [rewardMessage, setRewardMessage] = useState<string>('');

  const parseConferenceEndAt = (raw: unknown): Date | null => {
    if (!raw) return null;
    if (typeof raw === 'object' && raw !== null && 'toDate' in raw && typeof (raw as { toDate?: () => Date }).toDate === 'function') {
      return (raw as { toDate: () => Date }).toDate();
    }
    if (typeof raw === 'string') {
      const datePart = raw.includes('T') ? raw.split('T')[0] : raw;
      const [year, month, day] = datePart.split('-').map(Number);
      if (!year || !month || !day) return null;
      // KST 23:59:59 => UTC 14:59:59
      return new Date(Date.UTC(year, month - 1, day, 14, 59, 59, 999));
    }
    return null;
  };

  useLayoutEffect(() => {
    if (!slug) {
      setConferenceEnded(false);
      setConferenceChecked(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const confSnap = await getDoc(doc(db, 'conferences', slug));
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
      } catch (e) {
        console.error('[ConferenceBadgePage] Failed to check conference status', e);
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
      requestAnimationFrame(() => {
        setMsg("유효하지 않은 학술대회 링크입니다.");
      });
      return;
    }

    if (!conferenceChecked) {
      requestAnimationFrame(() => {
        setMsg("디지털 명찰을 확인하는 중입니다...");
      });
      return;
    }

    if (conferenceEnded) {
      requestAnimationFrame(() => {
        setMsg("종료된 학술대회입니다.");
      });
      return;
    }

    if (!auth.user) {
      requestAnimationFrame(() => {
        setMsg("인증이 만료되었습니다. 다시 접속해 주세요.");
      });
      return;
    }

    const initializeMsg = "명찰 정보를 불러오는 중입니다...";
    requestAnimationFrame(() => {
      setMsg(initializeMsg);
    });

    // CRITICAL FIX: Verify auth.user is for current conference
    // auth.user.id must match registrations in this conference to avoid cross-conference data leakage
    const userId = auth.user.id;
    console.log('[ConferenceBadgePage] Looking for badge:', { userId, conference: slug });

    // Fix: Query registrations with payment status filter
    // Query: userId + conference + PAID status
    const q = query(
      collection(db, `conferences/${slug}/registrations`),
      where('userId', '==', userId),
      where('paymentStatus', '==', 'PAID'),  // CRITICAL: Only show PAID registrations
      orderBy('createdAt', 'desc') // Get most recent PAID registration
    );

    // Fetch Zones for real-time break exclusion logic
    import('firebase/firestore').then(async ({ doc, getDoc }) => {
      try {
        const rulesRef = doc(db, `conferences/${slug}/settings/attendance`);
        const rulesSnap = await getDoc(rulesRef);
        if (rulesSnap.exists()) {
          const allRules = rulesSnap.data().rules || {};
          let allZones: any[] = [];
          Object.entries(allRules).forEach(([dateStr, rule]: [string, any]) => {
            if (rule && rule.zones) {
              rule.zones.forEach((z: any) => {
                allZones.push({ ...z, ruleDate: dateStr });
              });
            }
          });
          setZones(allZones);
        }
      } catch (e) {
        console.error('Failed to load rules for live calculation', e);
      }
    });

    const unsub = onSnapshot(q, (snap) => {
      console.log('[ConferenceBadgePage] Query result:', {
        slug,
        userId,
        docsFound: snap.docs.length,
        hasData: !snap.empty
      });

      if (snap.empty) {
        setUiData(null);
        setMsg("등록 정보를 찾을 수 없습니다.");
        return;
      }

      const docData = snap.docs[0].data();
      const paymentStatus = docData?.paymentStatus || 'UNKNOWN';

      console.log('[ConferenceBadgePage] Registration data:', {
        id: snap.docs[0].id,
        paymentStatus,
        userName: docData?.userName,
        hasBadgeIssued: docData?.badgeIssued
      });

      // CRITICAL FIX: Only show badge for PAID registrations
      if (paymentStatus !== 'PAID') {
        setUiData(null);
        setMsg(`결제가 완료되지 않았습니다. 결제 상태: ${paymentStatus}`);
        return;
      }

      // EXTREME SANITIZATION
      // Voucher QR: Use regId directly (no CONF- prefix) for InfoDesk scanning
      const regId = snap.docs[0].id;
      const voucherQr = String(docData.confirmationQr || regId);

      // Badge QR: Use BADGE-{regId} format
      const badgeQr = String(docData.badgeQr || `BADGE-${regId}`);

      const finalQrValue = docData.badgeIssued ? badgeQr : voucherQr;

      console.log('[ConferenceBadgePage] QR Code Debug:', {
        regId,
        confirmationQr: docData.confirmationQr,
        badgeQr: docData.badgeQr,
        badgeIssued: docData.badgeIssued,
        voucherQr,
        finalQrValue
      });

      const baseMinutes = Number(docData.totalMinutes || 0);

      setUiData({
        status: String(docData.attendanceStatus || 'OUTSIDE'),
        zone: String(docData.attendanceStatus === 'INSIDE' ? (docData.currentZone || 'Inside') : 'OUTSIDE'),
        name: String(docData.userName || docData.name || '이름 없음'),
        aff: String(docData.affiliation || docData.organization || docData.userAffiliation || docData.userInfo?.affiliation || '소속 없음'),
        id: String(regId || 'ERR'),
        userId: String(docData.userId || regId || 'ERR'),
        issued: !!docData.badgeIssued,
        qrValue: finalQrValue,
        receiptNumber: String(docData.receiptNumber || docData.orderId || '-'),
        lastCheckIn: docData.lastCheckIn,
        baseMinutes
      });
      setLiveMinutes(baseMinutes);
      setMsg(""); // Clear msg
    });

    return () => unsub();
  }, [slug, auth.user, conferenceChecked, conferenceEnded]);

  // Live Duration Ticker calculation
  useLayoutEffect(() => {
    if (!uiData) return;

    const updateLiveMinutes = () => {
      if (uiData.status !== 'INSIDE' || !uiData.lastCheckIn) {
        setLiveMinutes(uiData.baseMinutes || 0);
        return;
      }

      const now = new Date();
      const start = uiData.lastCheckIn.toDate ? uiData.lastCheckIn.toDate() : new Date();
      let boundedStart = start;
      let boundedEnd = now;

      const currentZoneId = uiData.zone;
      const zoneRule = zones.find(z => z.id === currentZoneId);

      // Apply zone session boundaries to match backend GatePage calculation
      if (zoneRule && zoneRule.start && zoneRule.end) {
        const localDateStr = zoneRule.ruleDate || start.getFullYear() + "-" + String(start.getMonth() + 1).padStart(2, '0') + "-" + String(start.getDate()).padStart(2, '0');
        const sessionStart = new Date(`${localDateStr}T${zoneRule.start}:00`);
        const sessionEnd = new Date(`${localDateStr}T${zoneRule.end}:00`);

        boundedStart = new Date(Math.max(start.getTime(), sessionStart.getTime()));
        boundedEnd = new Date(Math.min(now.getTime(), sessionEnd.getTime()));
      }

      let diffMins = 0;
      if (boundedEnd > boundedStart) {
        diffMins = Math.floor((boundedEnd.getTime() - boundedStart.getTime()) / 60000);
      }

      let deduction = 0;

      if (zoneRule && zoneRule.breaks && Array.isArray(zoneRule.breaks)) {
        zoneRule.breaks.forEach((brk: any) => {
          const localDateStr = zoneRule.ruleDate || start.getFullYear() + "-" + String(start.getMonth() + 1).padStart(2, '0') + "-" + String(start.getDate()).padStart(2, '0');
          const breakStart = new Date(`${localDateStr}T${brk.start}:00`);
          const breakEnd = new Date(`${localDateStr}T${brk.end}:00`);
          const overlapStart = Math.max(boundedStart.getTime(), breakStart.getTime());
          const overlapEnd = Math.min(boundedEnd.getTime(), breakEnd.getTime());
          if (overlapEnd > overlapStart) {
            const overlapMins = Math.floor((overlapEnd - overlapStart) / 60000);
            deduction += overlapMins;
          }
        });
      }

      const activeMinutes = Math.max(0, diffMins - deduction);
      setLiveMinutes((uiData.baseMinutes || 0) + activeMinutes);
    };

    updateLiveMinutes();
    const timer = setInterval(updateLiveMinutes, 30000);
    return () => clearInterval(timer);
  }, [uiData, zones]);

  // Stamp Tour Data Loader
  useLayoutEffect(() => {
    if (!slug || !uiData?.userId) return;

    let unsubStamps = () => { };
    let unsubProgress = () => { };

    const fetchStampTour = async () => {
      try {
        const configSnap = await getDoc(doc(db, `conferences/${slug}/settings`, 'stamp_tour'));
        if (configSnap.exists()) {
          const cfg = configSnap.data() as any;
          setStampConfig({
            enabled: cfg.enabled === true,
            endAt: cfg.endAt,
            completionRule: cfg.completionRule || { type: 'COUNT', requiredCount: 5 },
            boothOrderMode: cfg.boothOrderMode || 'SPONSOR_ORDER',
            customBoothOrder: cfg.customBoothOrder || [],
            rewardMode: cfg.rewardMode || 'RANDOM',
            rewards: Array.isArray(cfg.rewards) ? cfg.rewards : [],
            soldOutMessage: cfg.soldOutMessage,
            completionMessage: cfg.completionMessage
          });
        } else {
          setStampConfig(null);
        }

        const vSnap = await getDocs(query(collection(db, `conferences/${slug}/sponsors`), where("isStampTourParticipant", "==", true)));
        const boothCandidates = vSnap.docs.map(d => {
          const data = d.data() as { vendorId?: string; name?: string };
          return {
            id: data.vendorId || d.id,
            name: data.name || d.id
          };
        });
        setStampBoothCandidates(boothCandidates);
        setTotalVendors(boothCandidates.length);

        const sQ = query(collection(db, `conferences/${slug}/stamps`), where('userId', '==', uiData.userId));
        unsubStamps = onSnapshot(sQ, (snap) => {
          const list = snap.docs.map(d => d.data() as { vendorId?: string });
          const uniqueVendors = Array.from(new Set(list.map(s => s.vendorId).filter(Boolean))) as string[];
          setMyStamps(uniqueVendors);
        });

        const progressRef = doc(db, `conferences/${slug}/stamp_tour_progress/${uiData.userId}`);
        unsubProgress = onSnapshot(progressRef, (snap) => {
          if (!snap.exists()) {
            setStampProgress({});
            return;
          }
          const p = snap.data() as { rewardStatus?: 'NONE' | 'REQUESTED' | 'REDEEMED'; rewardName?: string; isCompleted?: boolean };
          setStampProgress(p);
        });

        const guestbookSnap = await getDocs(query(collection(db, `conferences/${slug}/guestbook_entries`), where('userId', '==', uiData.userId)));
        const gb = guestbookSnap.docs.map(d => {
          const data = d.data() as { vendorName?: string; message?: string; timestamp?: Timestamp };
          return { vendorName: data.vendorName || 'Vendor', message: data.message, timestamp: data.timestamp };
        });
        setGuestbookEntries(gb);
      } catch (e) {
        console.error("Failed to load Stamp Tour data", e);
      }
    };

    fetchStampTour();

    return () => {
      unsubStamps();
      unsubProgress();
    };
  }, [slug, uiData?.userId]);

  useLayoutEffect(() => {
    if (!stampConfig?.enabled) {
      setStampBooths([]);
      return;
    }
    const ordered = (() => {
      if (stampConfig.boothOrderMode === 'CUSTOM' && stampConfig.customBoothOrder && stampConfig.customBoothOrder.length > 0) {
        const mapped = stampConfig.customBoothOrder
          .map(id => stampBoothCandidates.find(b => b.id === id))
          .filter(Boolean) as Array<{ id: string; name: string }>;
        const remaining = stampBoothCandidates.filter(b => !stampConfig.customBoothOrder!.includes(b.id));
        return [...mapped, ...remaining];
      }
      return stampBoothCandidates;
    })();

    const stampSet = new Set(myStamps);
    setStampBooths(ordered.map(b => ({ ...b, isStamped: stampSet.has(b.id) })));
  }, [stampBoothCandidates, myStamps, stampConfig]);

  useLayoutEffect(() => {
    if (!slug || !uiData?.userId || !stampConfig?.enabled) return;
    const required = stampConfig.completionRule.type === 'ALL'
      ? stampBoothCandidates.length
      : Math.max(1, stampConfig.completionRule.requiredCount || stampBoothCandidates.length);
    const completed = myStamps.length >= required && required > 0;

    if (completed && !stampProgress.isCompleted) {
      const progressRef = doc(db, `conferences/${slug}/stamp_tour_progress/${uiData.userId}`);
      setDoc(progressRef, {
        userId: uiData.userId,
        conferenceId: slug,
        isCompleted: true,
        completedAt: Timestamp.now(),
        rewardStatus: stampProgress.rewardStatus || 'NONE',
        userName: uiData.name,
        userOrg: uiData.aff
      }, { merge: true }).catch((e) => {
        console.error('Failed to update stamp tour progress', e);
      });
    }
  }, [slug, uiData?.userId, stampConfig, stampBoothCandidates.length, myStamps.length, stampProgress.isCompleted, stampProgress.rewardStatus]);

  const handleRewardRequest = async () => {
    if (!slug || !uiData?.userId || !stampConfig?.enabled) return;
    setRewardRequesting(true);
    setRewardMessage('');
    try {
      const requestReward = httpsCallable(functions, 'requestStampReward');
      const response = await requestReward({
        confId: slug,
        userName: uiData.name,
        userOrg: uiData.aff
      });
      const payload = response.data as { rewardName?: string };
      setRewardMessage(payload?.rewardName
        ? `상품 수령 요청이 접수되었습니다: ${payload.rewardName}`
        : '상품 수령 요청이 접수되었습니다.'
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : '요청 처리에 실패했습니다.';
      setRewardMessage(msg);
    } finally {
      setRewardRequesting(false);
    }
  };

  // Render - outside useEffect
  if (msg) return <div className="p-10 text-center font-bold text-gray-500 flex items-center justify-center min-h-screen">{msg}</div>;
  if (!uiData) return <div className="p-10 text-center flex items-center justify-center min-h-screen">명찰 정보를 불러오지 못했습니다.</div>;

  const requiredCount = stampConfig?.enabled
    ? (stampConfig.completionRule.type === 'ALL'
      ? stampBoothCandidates.length
      : Math.max(1, stampConfig.completionRule.requiredCount || stampBoothCandidates.length))
    : 0;
  const isCompleted = stampConfig?.enabled ? (requiredCount > 0 && myStamps.length >= requiredCount) : false;
  const rewardStatus = stampProgress.rewardStatus || 'NONE';

  return (
    <div className="min-h-screen bg-white flex flex-col items-center p-4 font-sans">
      <div className={`w-full max-w-sm border-4 rounded-3xl p-8 text-center shadow-2xl transition-all ${uiData.issued ? 'border-blue-600' : 'border-gray-300'}`}>
        <h1 className="text-xl font-bold mb-6 tracking-wide text-gray-800 uppercase">
          {uiData.issued ? 'Mobile Access Badge' : 'Registration Voucher'}
        </h1>

        <div className="bg-white p-4 inline-block rounded-2xl shadow-inner border border-gray-100 mb-6">
          {/* QRCode MUST have a fallback string */}
          <QRCode
            key={uiData.qrValue}
            value={uiData.qrValue || "ERROR"}
            size={180}
          />
        </div>

        <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">{uiData.name}</h2>
        <p className="text-lg text-gray-600 font-medium mb-6">{uiData.aff}</p>

        {uiData.issued && (
          <>
            <div className={`mt-6 py-3 px-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 ${uiData.status === 'INSIDE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {uiData.status === 'INSIDE' ? '입장 중 (INSIDE)' : '퇴장 상태 (OUTSIDE)'}
            </div>

            {liveMinutes > 0 && (
              <div className="mt-3 bg-purple-50 text-purple-700 rounded-xl py-2 px-4 flex justify-between items-center text-sm font-semibold border border-purple-100">
                <span>총 체류 시간</span>
                <span>{Math.floor(liveMinutes / 60)}시간 {liveMinutes % 60}분</span>
              </div>
            )}
          </>
        )}

        {!uiData.issued && (
          <div className="mt-6 py-3 px-4 bg-gray-50 text-gray-500 text-sm rounded-xl">
            현장 데스크에서 QR 코드를 제시해 주세요.
          </div>
        )}
      </div>

      {/* STAMP TOUR */}
      {uiData && uiData.issued && stampConfig?.enabled && (
        <div className="mt-6 w-full max-w-sm space-y-4">
          <div className="border-2 border-dashed border-indigo-400 rounded-3xl p-6 text-center shadow-md bg-indigo-50">
            <h3 className="text-xl font-bold text-indigo-900 mb-2">부스 스탬프 투어</h3>
            <p className="text-sm text-indigo-700 mb-4">
              참여 부스를 방문하고 스탬프를 모아보세요.
            </p>

            <div className="flex justify-between items-center text-sm font-bold text-indigo-800 mb-2">
              <span>현재 진행 상황</span>
              <span className="text-indigo-600 bg-white px-3 py-1 rounded-full shadow-sm">{myStamps.length} / {requiredCount || totalVendors}</span>
            </div>

            <div className="w-full bg-indigo-200 rounded-full h-3 mb-4 overflow-hidden">
              <div
                className="bg-indigo-600 h-3 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(100, requiredCount > 0 ? (myStamps.length / requiredCount) * 100 : 0)}%` }}
              />
            </div>

            {isCompleted && (
              <div className="mt-4 space-y-2">
                <div className="text-sm font-semibold text-indigo-900">
                  {stampConfig.completionMessage || '스탬프 투어를 완료했습니다.'}
                </div>
                {rewardStatus === 'NONE' && (
                  <button
                    className="w-full py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm disabled:opacity-50"
                    onClick={handleRewardRequest}
                    disabled={rewardRequesting}
                  >
                    상품 수령 요청
                  </button>
                )}
                {rewardStatus === 'REQUESTED' && (
                  <div className="text-sm font-semibold text-amber-700 bg-amber-100 py-2 rounded-xl">
                    상품 수령 요청 완료 (인포데스크 확인)
                  </div>
                )}
                {rewardStatus === 'REDEEMED' && (
                  <div className="text-sm font-semibold text-emerald-700 bg-emerald-100 py-2 rounded-xl">
                    상품 수령 완료
                  </div>
                )}
                {rewardMessage && (
                  <div className="text-xs text-indigo-700">{rewardMessage}</div>
                )}
              </div>
            )}
          </div>

          {/* Booth List */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm">
            <h4 className="text-sm font-bold text-slate-800 mb-3">참여 부스 안내</h4>
            {stampBooths.length === 0 ? (
              <div className="text-xs text-slate-400">참여 부스가 없습니다.</div>
            ) : (
              <div className="space-y-2">
                {stampBooths.map(booth => (
                  <div key={booth.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 font-medium">{booth.name}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${booth.isStamped ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                      {booth.isStamped ? '스탬프 완료' : '미완료'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Guestbook Vendors */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm">
            <h4 className="text-sm font-bold text-slate-800 mb-3">방명록 제공 업체</h4>
            {guestbookEntries.length === 0 ? (
              <div className="text-xs text-slate-400">방명록 제공 업체가 없습니다.</div>
            ) : (
              <div className="space-y-2">
                {guestbookEntries.map((entry, idx) => (
                  <div key={`${entry.vendorName}-${idx}`} className="text-sm text-slate-700">
                    <span className="font-medium">{entry.vendorName}</span>
                    {entry.message && <span className="text-xs text-slate-500"> · {entry.message}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="mt-6 text-center">
        <p className="text-sm font-bold text-gray-500 tracking-wider">REF: {uiData.receiptNumber}</p>
        <p className="text-[10px] text-gray-300 font-mono tracking-widest mt-1">ID: {uiData.id}</p>
      </div>
    </div>
  );
};

export default ConferenceBadgePage;





