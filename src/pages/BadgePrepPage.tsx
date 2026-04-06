import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import { getFirestore, doc, getDoc, onSnapshot, type DocumentData, type DocumentSnapshot } from 'firebase/firestore';
import { RefreshCw, AlertCircle, CheckCircle, Loader2, Clock, FileText, Calendar, Languages, Download, User, MapPin, TrendingUp, Gift } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useStampTour } from '../components/badge/useStampTour';
import StampTourTab from '../components/badge/StampTourTab';
import LangToggle from '../components/badge/LangToggle';
import {
  resolveConferenceIdFromRoute,
  resolvePublicSlugFromConferenceId
} from '../utils/conferenceRoute';

interface TokenValidationResult {
  valid: boolean;
  error?: string;
  tokenStatus?: 'ACTIVE' | 'ISSUED' | 'EXPIRED';
  newToken?: string;
  redirectRequired?: boolean;
  registration?: {
    id: string;
    name: string;
    email: string;
    phone: string;
    affiliation: string;
    licenseNumber: string;
    confirmationQr: string;
    badgeQr: string | null;
    badgeIssued: boolean;
    attendanceStatus: 'INSIDE' | 'OUTSIDE';
    currentZone: string | null;
    totalMinutes: number;
    receiptNumber: string;
    amount?: number;
    lastCheckIn?: { toDate?: () => Date } | null;
    isCompleted?: boolean;
    // Additional fields for enhanced badge
    sessionsCompleted?: number;
    sessionsTotal?: number;
    conference?: {
      name: string;
      dates: { start: { toDate: () => Date } | null; end: { toDate: () => Date } | null };
      venue: { name?: string } | null;
    };
  };
}

type TimestampLike = {
  toDate?: () => Date;
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
  zones?: Array<Omit<AttendanceZone, 'ruleDate'>>;
};

type AttendanceSettings = {
  rules?: Record<string, AttendanceRule>;
};

type BadgeConfig = {
  materialsUrls?: Array<{ name: string; url: string }>;
  translationUrl?: string;
};

const BadgePrepPage: React.FC = () => {
  const { slug, token } = useParams<{ slug: string; token: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(true);
  const [result, setResult] = useState<TokenValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [badgeConfig, setBadgeConfig] = useState<BadgeConfig | null>(null);
  const [zones, setZones] = useState<AttendanceZone[]>([]);
  const [liveMinutes, setLiveMinutes] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [badgeLang, setBadgeLang] = useState<"ko" | "en">("ko");
  const publicSlug = resolvePublicSlugFromConferenceId(slug);

  const t = (ko: string, en: string) => (badgeLang === "ko" ? ko : en);

  const formatMinutes = (minutes: number) => (
    badgeLang === "ko"
      ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`
      : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  );

  const confId = resolveConferenceIdFromRoute(slug);
  const userId = result?.registration?.id;

  const stampTour = useStampTour({
    confId,
    userId,
    userName: result?.registration?.name,
    userOrg: result?.registration?.affiliation,
  });

  const voucherQrValue = useMemo(() => {
    if (!result?.registration) return '';
    // Use regId directly for InfoDesk scanning (no CONF- prefix)
    const value = result.registration.confirmationQr || result.registration.id || '';
    console.log('[BadgePrepPage] Voucher QR Value:', {
      regId: result.registration.id,
      confirmationQr: result.registration.confirmationQr,
      finalValue: value
    });
    return value;
  }, [result?.registration]);

  // Helper to determine correct confId
  const getConfIdToUse = useCallback((slugVal: string | undefined): string => (
    resolveConferenceIdFromRoute(slugVal)
  ), []);

  // Validate token
  const validateToken = useCallback(async () => {
    if (!token) {
      setError('토큰이 제공되지 않았습니다.');
      setLoading(false);
      return;
    }

    try {
      const functions = getFunctions();
      const validateBadgePrepTokenFn = httpsCallable(functions, 'validateBadgePrepToken');

      const confIdVal = getConfIdToUse(slug);

      const [response, configSnap] = await Promise.all([
        validateBadgePrepTokenFn({ confId: confIdVal, token }) as Promise<{ data: TokenValidationResult }>,
        (async () => {
          try {
            const db = getFirestore();
            const configRef = doc(db, `conferences/${confIdVal}/settings/badge_config`);
            return await getDoc(configRef);
          } catch (err) {
            console.error('[BadgePrepPage] Failed to load badge config', err);
            return null;
          }
        })()
      ]);

      if (configSnap && configSnap.exists()) {
        setBadgeConfig(configSnap.data());
      }

      setResult(response.data);
      setLoading(false);
      setValidating(false);
    } catch (err) {
      console.error('[BadgePrepPage] Token validation error:', err);
      setError('토큰 검증에 실패했습니다.');
      setLoading(false);
      setValidating(false);
    }
  }, [token, slug, getConfIdToUse]);

  // Initial validation
  useEffect(() => {
    requestAnimationFrame(() => {
      validateToken();
    });
  }, [validateToken]);

  // Load Zones for attendance calculation
  useEffect(() => {
    if (!result?.registration) return;
    const db = getFirestore();
    const confIdVal = getConfIdToUse(slug);

    const attendanceRef = doc(db, `conferences/${confIdVal}/settings/attendance`);
    getDoc(attendanceRef).then(snap => {
      if (snap.exists()) {
        const rules = (snap.data() as AttendanceSettings).rules || {};
        const allZones: AttendanceZone[] = [];
        Object.entries(rules).forEach(([dateStr, rule]) => {
          if (rule && rule.zones) {
            rule.zones.forEach((z) => {
              allZones.push({ ...z, ruleDate: dateStr });
            });
          }
        });
        setZones(allZones);
      }
    });
  }, [result?.registration, slug, getConfIdToUse]);

  const [liveAttendance, setLiveAttendance] = useState<{
    status: 'INSIDE' | 'OUTSIDE';
    totalMinutes: number;
    lastCheckIn: TimestampLike | null;
    currentZone: string | null;
  } | null>(null);

  // Enhanced: Sync detailed registration data directly from Firestore
  useEffect(() => {
    if (!result?.registration?.id) return;
    const db = getFirestore();
    const confIdVal = getConfIdToUse(slug);
    const regId = result.registration.id;

    const regRef = doc(db, `conferences/${confIdVal}/registrations`, regId);
    const extRef = doc(db, `conferences/${confIdVal}/external_attendees`, regId);

    let regularSnap: DocumentSnapshot<DocumentData> | null = null;
    let externalSnap: DocumentSnapshot<DocumentData> | null = null;

    const processSnap = (snap: DocumentSnapshot<DocumentData>) => {
      if (snap.exists()) {
        const d = snap.data();
        setLiveAttendance({
          status: d.attendanceStatus || 'OUTSIDE',
          totalMinutes: d.totalMinutes || 0,
          lastCheckIn: d.lastCheckIn,
          currentZone: d.currentZone || null
        });
        setIsCompleted(!!d.isCompleted);
      } else {
        setLiveAttendance(null);
        setIsCompleted(false);
      }
    };

    const syncPreferredSnapshot = () => {
      if (regularSnap?.exists()) {
        processSnap(regularSnap);
        return;
      }

      if (externalSnap?.exists()) {
        processSnap(externalSnap);
        return;
      }

      setLiveAttendance(null);
      setIsCompleted(false);
    };

    const unsubscribeReg = onSnapshot(regRef, (snap) => {
      regularSnap = snap;
      syncPreferredSnapshot();
    }, (err) => {
      console.warn('[BadgePrepPage] Registration doc sync restricted:', err);
    });

    const unsubscribeExt = onSnapshot(extRef, (snap) => {
      externalSnap = snap;
      syncPreferredSnapshot();
    }, (err) => {
      console.warn('[BadgePrepPage] External attendee doc sync restricted:', err);
    });

    return () => {
      unsubscribeReg();
      unsubscribeExt();
    };
  }, [result?.registration?.id, slug, getConfIdToUse]);

  // Live Ticker Logic (calculates time passed precisely)
  useEffect(() => {
    // We prioritize liveAttendance from Firestore, fallback to result.registration
    const reg = result?.registration;
    if (!reg) return;

    const updateLiveMinutes = () => {
      // Step 1: Determine the base data
      const status = liveAttendance ? liveAttendance.status : reg.attendanceStatus;
      const baseMinutes = liveAttendance ? liveAttendance.totalMinutes : (reg.totalMinutes || 0);
      const currentCheckIn = liveAttendance ? liveAttendance.lastCheckIn : reg.lastCheckIn;
      const currentZoneId = liveAttendance ? liveAttendance.currentZone : reg.currentZone;

      // Step 2: If not inside, just show base minutes
      if (status !== 'INSIDE' || !currentCheckIn) {
        setLiveMinutes(baseMinutes);
        return;
      }

      // Step 3: Calculate the live duration for the current session
      const now = new Date();
      const start = currentCheckIn.toDate ? currentCheckIn.toDate() : new Date();
      let sessionDuration = 0;
      const zoneRule = zones.find((z) => z.id === currentZoneId);
      let deduction = 0;

      let boundedStart = start;
      let boundedEnd = now;

      if (zoneRule && zoneRule.start && zoneRule.end) {
        const localDateStr = zoneRule.ruleDate || start.getFullYear() + "-" + String(start.getMonth() + 1).padStart(2, '0') + "-" + String(start.getDate()).padStart(2, '0');
        // Force strings to be interpreted as KST (+09:00)
        const sessionStart = new Date(`${localDateStr}T${zoneRule.start}:00+09:00`);
        const sessionEnd = new Date(`${localDateStr}T${zoneRule.end}:00+09:00`);

        boundedStart = new Date(Math.max(start.getTime(), sessionStart.getTime()));
        boundedEnd = new Date(Math.min(now.getTime(), sessionEnd.getTime()));
      }

      if (boundedEnd > boundedStart) {
        sessionDuration = Math.floor((boundedEnd.getTime() - boundedStart.getTime()) / 60000);

        if (zoneRule && zoneRule.breaks && Array.isArray(zoneRule.breaks)) {
          zoneRule.breaks.forEach((brk) => {
            const localDateStr = zoneRule.ruleDate || start.getFullYear() + "-" + String(start.getMonth() + 1).padStart(2, '0') + "-" + String(start.getDate()).padStart(2, '0');
            // Force breaks to KST
            const breakStart = new Date(`${localDateStr}T${brk.start}:00+09:00`);
            const breakEnd = new Date(`${localDateStr}T${brk.end}:00+09:00`);
            const overlapStart = Math.max(boundedStart.getTime(), breakStart.getTime());
            const overlapEnd = Math.min(boundedEnd.getTime(), breakEnd.getTime());
            if (overlapEnd > overlapStart) {
              const overlapMins = Math.floor((overlapEnd - overlapStart) / 60000);
              deduction += overlapMins;
            }
          });
        }
      }

      const activeSessionMinutes = Math.max(0, sessionDuration - deduction);
      setLiveMinutes(baseMinutes + activeSessionMinutes);
    };

    updateLiveMinutes();
    const ticker = setInterval(updateLiveMinutes, 30000);
    return () => clearInterval(ticker);
  }, [result?.registration, liveAttendance, zones]);

  // Get hostname for URL
  const hostname = window.location.hostname;

  // Handle token reissue redirect
  useEffect(() => {
    if (result?.redirectRequired && result.newToken) {
      // Redirect to new token URL
      window.location.href = `https://${hostname}/${slug}/badge-prep/${result.newToken}`;
    }
  }, [result?.redirectRequired, result?.newToken, hostname, slug]);

  // Auto-refresh when badge is issued
  useEffect(() => {
    if (result?.valid && result.tokenStatus === 'ACTIVE') {
      // Poll every 10 seconds to check if badge has been issued
      // Reduced polling frequency to prevent server overload
      const interval = setInterval(async () => {
        setRefreshing(true);
        await validateToken();
        setRefreshing(false);
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [result?.valid, result?.tokenStatus, validateToken]);

  if (loading || validating) {
    return (
      <div className="min-h-screen bg-[#f0f5fa] flex items-center justify-center font-sans">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#003366] mx-auto mb-4" />
          <p className="text-base font-medium text-gray-500">{t("데이터 로드 중...", "Loading...")}</p>
        </div>
      </div>
    );
  }

  if (error || !result?.valid) {
    return (
      <div className="min-h-screen bg-[#f0f5fa] flex items-center justify-center font-sans p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg border border-[#c3daee] p-8 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t("유효하지 않은 링크", "Invalid Link")}</h1>
          <p className="text-sm text-gray-500 mb-6">
            {error || t("이 링크는 만료되었거나 유효하지 않습니다.", "This link has expired or is invalid.")}
          </p>
          <button
            type="button"
            onClick={() => navigate(`/${publicSlug}`)}
            className="inline-block w-full py-3 px-6 bg-[#003366] text-white font-bold rounded-xl hover:bg-[#002244] transition-colors text-center text-sm"
          >
            {t("학술대회 홈페이지로 이동", "Go to Conference Homepage")}
          </button>
        </div>
      </div>
    );
  }

  // Active → Show Voucher (Temporary)
  if (result.tokenStatus === 'ACTIVE' && result.registration) {
    const reg = result.registration;

    return (
      <div className="min-h-screen bg-[#f0f5fa] flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-full max-w-sm">
          {/* Voucher Card */}
          <div className="bg-white border border-amber-200 rounded-2xl text-center shadow-lg overflow-hidden">
            {/* Pending Banner */}
            <div className="bg-amber-500 py-2.5 px-4 flex items-center justify-center gap-2 text-white">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-bold tracking-wide">{t("명찰 발급 대기 중", "Badge Issuance Pending")}</span>
              {refreshing && <RefreshCw className="w-3.5 h-3.5 animate-spin ml-1" />}
            </div>

            <div className="p-6">
              {/* Header */}
              <div className="mb-5">
                <h1 className="text-lg font-bold text-gray-900 mb-0.5">{t("등록 확인 바우처", "Registration Voucher")}</h1>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Registration Voucher</p>
              </div>

              {/* Notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl py-2.5 px-3 mb-5">
                <p className="text-xs font-semibold text-amber-800">
                  {t(
                    "현장 인포데스크에서 QR을 스캔하여 디지털 명찰을 발급받으세요",
                    "Scan this QR at the info desk to receive your digital badge"
                  )}
                </p>
              </div>

              {/* Organization + Name */}
              <p className="text-sm text-gray-500 font-medium mb-1">{reg.affiliation || '-'}</p>
              <h2 className="text-3xl font-black text-gray-900 mb-5 tracking-tight">{reg.name}</h2>

              {/* Receipt */}
              <div className="bg-[#f0f5fa] rounded-xl py-2.5 px-4 mb-4 border border-[#c3daee]">
                <p className="text-[10px] font-bold text-[#003366] uppercase tracking-wider mb-0.5">{t("접수번호", "Receipt No.")}</p>
                <p className="text-lg font-black text-[#003366] tracking-wider">{reg.receiptNumber}</p>
              </div>

              {/* License Number */}
              {reg.licenseNumber && reg.licenseNumber !== '-' && (
                <div className="bg-gray-50 rounded-lg py-2 px-3 mb-4 text-left">
                  <p className="text-xs text-gray-500 font-medium">{t("면허번호", "License No.")}</p>
                  <p className="text-sm font-bold text-gray-800">{reg.licenseNumber}</p>
                </div>
              )}

              {/* QR Code */}
              <div className="bg-white p-3 inline-block rounded-xl shadow-sm border border-gray-100 mb-4">
                <p className="text-[10px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">{t("인포데스크 제시용", "For Info Desk")}</p>
                <QRCodeSVG
                  key={voucherQrValue}
                  value={voucherQrValue}
                  size={160}
                  level="M"
                  includeMargin={false}
                />
              </div>

              {/* Instruction */}
              <div className="bg-[#f0f5fa] border border-[#c3daee] rounded-xl py-2.5 px-4 flex items-center justify-center gap-2">
                <User className="w-4 h-4 text-[#003366] shrink-0" />
                <p className="text-sm font-semibold text-[#003366]">{t("현장 인포데스크에 QR 제시", "Present QR at Info Desk")}</p>
              </div>
            </div>
          </div>

          {/* Home Button */}
          <button
            type="button"
            onClick={() => navigate(`/${publicSlug}`)}
            className="block w-full mt-4 py-3 px-6 bg-white text-[#003366] font-bold rounded-xl hover:bg-[#f0f5fa] transition-colors text-center border border-[#c3daee] shadow-sm text-sm"
          >
            {t("학술대회 홈페이지", "Conference Homepage")}
          </button>
        </div>
      </div>
    );
  }

  // Issued → Show Digital Badge with Tabbed Interface
  if (result.tokenStatus === 'ISSUED' && result.registration) {
    const reg = result.registration;

    // ISSUED BADGE STATE
    return (
      <div className="min-h-[100dvh] bg-[#f0f5fa] flex flex-col p-4 font-sans">
        <div className="w-full max-w-sm mx-auto flex-1 flex flex-col justify-center py-6">
          {/* Digital Badge Card */}
          <div className="bg-white border border-[#c3daee] rounded-2xl overflow-hidden shadow-lg flex flex-col">

            {/* Issued Badge Header */}
            <div className="bg-[#003366] py-3 px-4">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-bold tracking-wider">{t("디지털 명찰 발급 완료", "Digital Badge Issued")}</span>
                </div>
                <LangToggle badgeLang={badgeLang} setBadgeLang={setBadgeLang} />
              </div>
            </div>

            {/* Badge Info - Main Content */}
            <div className="p-6 flex flex-col items-center text-center">
              {/* Affiliation */}
              <p className="text-sm text-gray-500 font-bold mb-2 break-keep leading-tight px-4 max-w-xs">{reg.affiliation || '-'}</p>

              {/* Name */}
              <h2 className="text-3xl font-black text-gray-900 mb-5 tracking-tight cursor-default">{reg.name}</h2>

              {/* License Number Chip */}
              {reg.licenseNumber && reg.licenseNumber !== '-' && (
                <div className="bg-[#f0f5fa] text-[#003366] border border-[#c3daee] rounded-full py-1.5 px-4 mb-6 inline-flex items-center">
                  <span className="text-xs font-bold tracking-wide">{t("면허번호", "License No.")} : {reg.licenseNumber}</span>
                </div>
              )}

              {/* QR Code Container - Enhanced Visibility */}
              <div className="bg-white p-4 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-gray-100 mb-3 flex flex-col items-center justify-center">
                <QRCodeSVG
                  key={reg.badgeQr || `BADGE-${reg.id}`}
                  value={reg.badgeQr || `BADGE-${reg.id}`}
                  size={180}
                  level="H"
                  includeMargin={true}
                  className="rounded-lg"
                />
                <div className="h-px w-full bg-gray-100 my-3"></div>
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Access Code</p>
              </div>
              <p className="text-xs font-medium text-emerald-600 animate-pulse">
                {t("입장/퇴장 시 위 QR코드를 스캔하세요", "Scan this QR code for entry/exit")}
              </p>
            </div>

            {/* Tabbed Interface */}
            <div className="bg-[#f0f5fa] border-t border-[#c3daee] p-2">
              <Tabs defaultValue="status" className="w-full">
                <TabsList className="grid grid-cols-6 w-full h-auto p-1 bg-white border border-gray-200 shadow-sm rounded-xl">
                  <TabsTrigger value="status" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-[#f0f5fa] data-[state=active]:text-[#003366] rounded-lg transition-all">
                    <User className="w-4 h-4" />
                    <span className="text-[10px] font-bold">{t("상태", "Status")}</span>
                  </TabsTrigger>
                  <TabsTrigger value="sessions" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-[#f0f5fa] data-[state=active]:text-[#003366] rounded-lg transition-all">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-[10px] font-bold">{t("수강", "Sessions")}</span>
                  </TabsTrigger>
                  <TabsTrigger value="materials" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-[#f0f5fa] data-[state=active]:text-[#003366] rounded-lg transition-all">
                    <FileText className="w-4 h-4" />
                    <span className="text-[10px] font-bold">{t("자료", "Materials")}</span>
                  </TabsTrigger>
                  <TabsTrigger value="program" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-[#f0f5fa] data-[state=active]:text-[#003366] rounded-lg transition-all">
                    <Calendar className="w-4 h-4" />
                    <span className="text-[10px] font-bold">{t("일정", "Program")}</span>
                  </TabsTrigger>
                  <TabsTrigger value="translation" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-[#f0f5fa] data-[state=active]:text-[#003366] rounded-lg transition-all">
                    <Languages className="w-4 h-4" />
                    <span className="text-[10px] font-bold">{t("번역", "Translation")}</span>
                  </TabsTrigger>
                  <TabsTrigger value="stamp-tour" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-[#f0f5fa] data-[state=active]:text-[#003366] rounded-lg transition-all">
                    <Gift className="w-4 h-4" />
                    <span className="text-[10px] font-bold">{t("스탬프", "Stamp")}</span>
                  </TabsTrigger>
                </TabsList>

                {/* Status Tab */}
                <TabsContent value="status" className="mt-2 p-1 space-y-2">
                  <div className={`py-4 px-4 rounded-2xl font-bold text-center border shadow-sm transition-all ${(liveAttendance?.status || reg.attendanceStatus) === 'INSIDE'
                    ? 'bg-green-100 text-green-700 border-green-200 ring-4 ring-green-50'
                    : 'bg-white text-gray-500 border-gray-200'
                    }`}>
                    <div className="flex items-center justify-center gap-2">
                      {(liveAttendance?.status || reg.attendanceStatus) === 'INSIDE'
                        ? <><span className="w-3 h-3 bg-green-500 rounded-full animate-ping" /><span>{t("입장 완료 (INSIDE)", "Inside (INSIDE)")}</span></>
                        : <><span className="w-3 h-3 bg-gray-300 rounded-full" /><span>{t("퇴장 상태 (OUTSIDE)", "Outside (OUTSIDE)")}</span></>
                      }
                    </div>
                  </div>

                  {(liveAttendance?.currentZone || reg.currentZone) && (liveAttendance?.status || reg.attendanceStatus) === 'INSIDE' && (
                    <div className="bg-[#f0f5fa] border border-[#c3daee] rounded-xl py-3 px-4 flex justify-between items-center">
                      <p className="text-xs text-[#003366] font-bold">{t("현재 위치", "Current Location")}</p>
                      <p className="text-sm font-black text-[#003366] flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#003366]" />
                        {liveAttendance?.currentZone || reg.currentZone}
                      </p>
                    </div>
                  )}

                  {liveMinutes > 0 && (
                    <div className="bg-[#f0f5fa] border border-[#c3daee] rounded-xl py-3 px-4 flex justify-between items-center">
                      <div className="flex flex-col text-left">
                        <p className="text-xs text-[#003366] font-bold">{t("인정 수강 시간 (실시간)", "Accredited Time (Live)")}</p>
                        {(liveAttendance?.status || reg.attendanceStatus) === 'INSIDE' && <p className="text-[10px] text-[#24669e]">{t("현재 수강 시간 포함", "Including current session")}</p>}
                      </div>
                      <p className="text-sm font-black text-[#003366] flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#003366]" />
                        {formatMinutes(liveMinutes)}
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* Sessions Tab */}
                <TabsContent value="sessions" className="mt-2 p-1">
                  <div className="bg-white rounded-2xl py-6 px-4 border border-gray-100 shadow-sm text-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-600'}`}>
                      {isCompleted ? <CheckCircle className="w-6 h-6 text-emerald-600" /> : <TrendingUp className="w-6 h-6 text-gray-400" />}
                    </div>
                    <p className="text-xs text-gray-500 font-bold mb-1 uppercase tracking-wider">Session Progress</p>
                    <p className="text-sm text-gray-500 font-medium mb-4">{t("평점(출결) 이수 현황", "Credit (Attendance) Progress")}</p>

                    <div className="flex flex-col items-center gap-1 mb-4">
                      <span className={`text-3xl font-black tracking-tight ${isCompleted ? 'text-emerald-600' : 'text-gray-900'}`}>
                        {isCompleted ? t("이수 완료", "Completed") : t("진행 중", "In Progress")}
                      </span>
                      <span className="text-sm font-bold text-gray-500 mt-2 bg-[#f0f5fa] px-4 py-2 rounded-lg">
                        {t("누적 인정 시간", "Total accredited time")}: <span className="text-[#003366]">{formatMinutes(liveMinutes)}</span>
                      </span>
                    </div>
                  </div>
                </TabsContent>

                {/* Materials Tab */}
                <TabsContent value="materials" className="mt-2 p-1 space-y-2">
                  {badgeConfig?.materialsUrls && badgeConfig.materialsUrls.length > 0 ? (
                    badgeConfig.materialsUrls.map((mat, idx: number) => (
                      <a
                        key={mat.url}
                        href={mat.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center p-4 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl transition-all group"
                      >
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-blue-200 transition-colors">
                          <Download className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-gray-900">{mat.name}</p>
                          <p className="text-xs text-gray-500">{t("자료실 이동", "Open materials")}</p>
                        </div>
                      </a>
                    ))
                  ) : (
                    <>
                      <a
                        href={`https://${hostname}/${slug}/materials`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center p-4 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl transition-all group"
                      >
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-blue-200 transition-colors">
                          <Download className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-gray-900">{t("강의 자료실", "Lecture Materials")}</p>
                          <p className="text-xs text-gray-500">{t("발표자료 다운로드", "Download presentation files")}</p>
                        </div>
                      </a>
                      <a
                        href={`https://${hostname}/${slug}/abstracts`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center p-4 bg-white hover:bg-purple-50 border border-gray-200 hover:border-purple-200 rounded-xl transition-all group"
                      >
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-purple-200 transition-colors">
                          <FileText className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-gray-900">{t("초록집 (Abstract)", "Abstract Book")}</p>
                          <p className="text-xs text-gray-500">{t("학술대회 초록 모음", "Conference abstract collection")}</p>
                        </div>
                      </a>
                    </>
                  )}
                </TabsContent>

                {/* Program Tab */}
                <TabsContent value="program" className="mt-2 p-1">
                  <a
                    href={`https://${hostname}/${slug}/program`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center p-8 bg-white border border-gray-200 rounded-2xl hover:border-amber-300 hover:bg-amber-50 transition-all text-center gap-3"
                  >
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                      <Calendar className="w-8 h-8 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">{t("전체 프로그램 보기", "View Full Program")}</p>
                      <p className="text-sm text-gray-500">Google Calendar / App</p>
                    </div>
                  </a>
                </TabsContent>

                {/* Translation Tab */}
                <TabsContent value="translation" className="mt-2 p-1">
                  {badgeConfig?.translationUrl ? (
                    <a href={badgeConfig.translationUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
                      <div className="bg-blue-50 rounded-2xl py-12 px-4 border border-blue-200 text-center hover:bg-blue-100 transition-colors cursor-pointer shadow-sm">
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 relative overflow-hidden">
                          <Languages className="w-8 h-8 relative z-10" />
                          <span className="absolute inset-0 bg-blue-400 opacity-20 animate-ping rounded-full" />
                        </div>
                        <p className="text-sm text-blue-900 font-bold mb-1">{t("실시간 번역 서비스 연결", "Live Translation Service")}</p>
                        <p className="text-xs text-blue-600">{t("클릭하면 번역 서비스로 이동합니다", "Click to open translation service")}</p>
                      </div>
                    </a>
                  ) : (
                    <div className="bg-gray-50 rounded-2xl py-12 px-4 border border-dashed border-gray-300 text-center">
                      <Languages className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                      <p className="text-sm text-gray-900 font-bold mb-1">{t("실시간 번역 서비스", "Live Translation Service")}</p>
                      <p className="text-xs text-gray-500">{t("현재 준비 중입니다", "Currently being prepared")}</p>
                    </div>
                  )}
                </TabsContent>

                {/* Stamp Tour Tab */}
                <TabsContent value="stamp-tour" className="mt-2 p-1">
                  <StampTourTab
                    stampConfig={stampTour.stampConfig}
                    stampBooths={stampTour.stampBooths}
                    stampBoothCandidates={stampTour.stampBoothCandidates}
                    myStamps={stampTour.myStamps}
                    stampProgress={stampTour.stampProgress}
                    guestbookEntries={stampTour.guestbookEntries}
                    requiredCount={stampTour.requiredCount}
                    isCompleted={stampTour.isCompleted}
                    rewardStatus={stampTour.rewardStatus}
                    lotteryStatus={stampTour.lotteryStatus}
                    isInstantReward={stampTour.isInstantReward}
                    canParticipantDraw={stampTour.canParticipantDraw}
                    missedLotteryCutoff={stampTour.missedLotteryCutoff}
                    rewardRequesting={stampTour.rewardRequesting}
                    rewardMessage={stampTour.rewardMessage}
                    onRewardRequest={stampTour.handleRewardRequest}
                    badgeLang={badgeLang}
                    t={t}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Home Button */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => navigate(`/${publicSlug}`)}
              className="w-full py-3 px-6 bg-white text-[#003366] font-bold rounded-xl hover:bg-[#f0f5fa] transition-colors border border-[#c3daee] shadow-sm text-sm"
            >
              {t("학술대회 홈페이지로 이동", "Go to Conference Homepage")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default BadgePrepPage;
