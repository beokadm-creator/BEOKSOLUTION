import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import { RefreshCw, AlertCircle, CheckCircle, Loader2, Clock, FileText, Calendar, Languages, Download, User, MapPin, TrendingUp } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

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

const BadgePrepPage: React.FC = () => {
  const { slug, token } = useParams<{ slug: string; token: string }>();

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(true);
  const [result, setResult] = useState<TokenValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
  const getConfIdToUse = useCallback((slugVal: string | undefined): string => {
    if (!slugVal) return 'kadd_2026spring';

    if (slugVal.includes('_')) {
      return slugVal;
    } else {
      const hostname = window.location.hostname;
      const parts = hostname.split('.');
      let societyIdToUse = 'kadd';

      if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') {
        societyIdToUse = parts[0].toLowerCase();
      }

      return `${societyIdToUse}_${slugVal}`;
    }
  }, []);

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

      const confId = getConfIdToUse(slug);
      const response = await validateBadgePrepTokenFn({ confId, token }) as { data: TokenValidationResult };

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
      // Poll every 2 seconds to check if badge has been issued
      // Faster polling for immediate switch after InfoDesk scan
      const interval = setInterval(async () => {
        setRefreshing(true);
        await validateToken();
        setRefreshing(false);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [result?.valid, result?.tokenStatus, validateToken]);

  if (loading || validating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center font-sans">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-xl font-medium text-gray-600">데이터 로드 중...</p>
        </div>
      </div>
    );
  }

  if (error || !result?.valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center font-sans p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">유효하지 않은 링크</h1>
          <p className="text-gray-600 mb-6">
            {error || '이 링크는 만료되었거나 유효하지 않습니다.'}
          </p>
          <a
            href={`https://${hostname}/${slug.split('_')[1]}`}
            className="inline-block w-full py-3 px-6 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-center"
          >
            학술대회 홈페이지로 이동
          </a>
        </div>
      </div>
    );
  }

  // Active → Show Voucher (Temporary)
  if (result.tokenStatus === 'ACTIVE' && result.registration) {
    const reg = result.registration;

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-full max-w-sm">
          {/* Temporary Voucher Card - Visually Distinct from Issued Badge */}
          <div className="bg-white border-4 border-amber-300 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden">
            {refreshing && (
              <div className="absolute top-3 right-3 z-10">
                <RefreshCw className="w-5 h-5 text-amber-600 animate-spin" />
              </div>
            )}

            {/* Pending Badge Indicator - Top Banner */}
            <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-amber-400 to-orange-400 py-2 px-4">
              <div className="flex items-center justify-center gap-2 text-white">
                <Clock className="w-4 h-4 animate-pulse" />
                <span className="text-xs font-bold tracking-wide">BADGE PENDING</span>
              </div>
            </div>

            {/* Watermark Background */}
            <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none mt-8">
              <div className="text-8xl font-black text-gray-900 transform -rotate-12">TEMPORARY</div>
            </div>

            {/* Content Container - Relative to sit above watermark */}
            <div className="relative z-10 mt-8">
              {/* Header with Icon */}
              <div className="mb-4">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-8 h-8 text-amber-600" />
                </div>
                <h1 className="text-xl font-black mb-1 tracking-wide text-amber-700">
                  등록 확인 바우처
                </h1>
                <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Registration Voucher</p>
              </div>

              {/* Warning Notice */}
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl py-2 px-3 mb-4">
                <p className="text-xs font-bold text-amber-800">
                  ⚠️ 현장 인포데스크에서 QR을 스캔하여<br />디지털 명찰을 발급받아야 합니다
                </p>
              </div>

              {/* Organization */}
              <p className="text-sm text-gray-600 font-medium mb-1">{reg.affiliation || '-'}</p>

              {/* Name */}
              <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">{reg.name}</h2>

              {/* Receipt Number - Prominent */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl py-3 px-4 mb-4 border border-amber-200">
                <p className="text-xs font-bold text-amber-600 uppercase mb-1">Receipt Number</p>
                <p className="text-xl font-black text-amber-700 tracking-wider">{reg.receiptNumber}</p>
              </div>

              {/* License Number */}
              {reg.licenseNumber && reg.licenseNumber !== '-' && (
                <div className="bg-gray-50 rounded-lg py-2 px-3 mb-4">
                  <p className="text-xs font-semibold text-gray-600">면허번호</p>
                  <p className="text-sm font-bold text-gray-800">{reg.licenseNumber}</p>
                </div>
              )}

              {/* QR Code - The Main Element */}
              <div className="bg-white p-3 inline-block rounded-2xl shadow-lg border-2 border-amber-200 mb-4">
                <div className="text-xs font-semibold text-gray-500 mb-2">인포데스크 제시용 QR</div>
                <QRCodeSVG
                  key={voucherQrValue}
                  value={voucherQrValue}
                  size={160}
                  level="M"
                  includeMargin={false}
                />
              </div>

              {/* Instruction */}
              <div className="bg-amber-100 border border-amber-300 rounded-xl py-3 px-4">
                <p className="text-sm font-bold text-amber-900 flex items-center justify-center gap-2">
                  <User className="w-4 h-4" />
                  현장 인포데스크에 QR 제시
                </p>
                <p className="text-xs text-amber-700 mt-1">디지털 명찰을 발급받으세요</p>
              </div>
            </div>
          </div>

          {/* Refresh Indicator */}
          {refreshing && (
            <div className="mt-4 text-center text-sm text-amber-700 font-medium flex items-center justify-center gap-2 bg-white/80 rounded-lg py-2 px-4">
              <RefreshCw className="w-4 h-4 animate-spin" />
              명찰 발급 상태 확인 중...
            </div>
          )}

          {/* Home Button */}
          <a
            href={`https://${hostname}/${slug}`}
            className="block w-full mt-4 py-3 px-6 bg-white text-amber-700 font-bold rounded-xl hover:bg-amber-50 transition-colors text-center border-2 border-amber-200 shadow-md"
          >
            학술대회 홈페이지
          </a>
        </div>
      </div>
    );
  }

  // Issued → Show Digital Badge with Tabbed Interface
  if (result.tokenStatus === 'ISSUED' && result.registration) {
    const reg = result.registration;

    // ISSUED BADGE STATE
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 flex flex-col p-4 font-sans">
        <div className="w-full max-w-sm mx-auto flex-1 flex flex-col justify-center py-6">
          {/* Digital Badge Card - Professional Name Tag */}
          <div className="bg-white border-0 md:border-4 border-emerald-500 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col relative z-10 ring-1 ring-black/5">

            {/* Issued Badge Header - Always Visible */}
            <div className="bg-gradient-to-r from-emerald-600 to-green-500 py-3 px-4 shadow-sm">
              <div className="flex items-center justify-center gap-2 text-white">
                <CheckCircle className="w-5 h-5 drop-shadow-sm" />
                <span className="text-sm font-bold tracking-wider drop-shadow-sm">DIGITAL BADGE ISSUED</span>
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
                <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full py-1.5 px-4 mb-6 inline-flex items-center shadow-sm">
                  <span className="text-xs font-bold tracking-wide">면허번호 : {reg.licenseNumber}</span>
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
                입장/퇴장 시 위 QR코드를 스캔하세요
              </p>
            </div>

            {/* Tabbed Interface - Compact & Clean */}
            <div className="bg-gray-50/80 border-t border-gray-100 p-2">
              <Tabs defaultValue="status" className="w-full">
                <TabsList className="grid grid-cols-5 w-full h-auto p-1 bg-white border border-gray-200 shadow-sm rounded-xl">
                  <TabsTrigger value="status" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-lg transition-all">
                    <User className="w-4 h-4" />
                    <span className="text-[10px] font-bold">상태</span>
                  </TabsTrigger>
                  <TabsTrigger value="sessions" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-lg transition-all">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-[10px] font-bold">수강</span>
                  </TabsTrigger>
                  <TabsTrigger value="materials" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-lg transition-all">
                    <FileText className="w-4 h-4" />
                    <span className="text-[10px] font-bold">자료</span>
                  </TabsTrigger>
                  <TabsTrigger value="program" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-lg transition-all">
                    <Calendar className="w-4 h-4" />
                    <span className="text-[10px] font-bold">일정</span>
                  </TabsTrigger>
                  <TabsTrigger value="translation" className="flex flex-col items-center justify-center py-2 px-0 gap-1 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-lg transition-all">
                    <Languages className="w-4 h-4" />
                    <span className="text-[10px] font-bold">번역</span>
                  </TabsTrigger>
                </TabsList>

                {/* Status Tab */}
                <TabsContent value="status" className="mt-2 p-1 space-y-2">
                  <div className={`py-4 px-4 rounded-2xl font-bold text-center border shadow-sm transition-all ${reg.attendanceStatus === 'INSIDE'
                    ? 'bg-green-100 text-green-700 border-green-200 ring-4 ring-green-50'
                    : 'bg-white text-gray-500 border-gray-200'
                    }`}>
                    <div className="flex items-center justify-center gap-2">
                      {reg.attendanceStatus === 'INSIDE'
                        ? <><span className="w-3 h-3 bg-green-500 rounded-full animate-ping" /><span>입장 완료 (INSIDE)</span></>
                        : <><span className="w-3 h-3 bg-gray-300 rounded-full" /><span>퇴장 상태 (OUTSIDE)</span></>
                      }
                    </div>
                  </div>

                  {reg.currentZone && (
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl py-3 px-4 flex justify-between items-center">
                      <p className="text-xs text-blue-600 font-bold">현재 위치</p>
                      <p className="text-sm font-black text-blue-800 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-blue-500" />
                        {reg.currentZone}
                      </p>
                    </div>
                  )}

                  {reg.totalMinutes > 0 && (
                    <div className="bg-purple-50/50 border border-purple-100 rounded-xl py-3 px-4 flex justify-between items-center">
                      <p className="text-xs text-purple-600 font-bold">총 체류 시간</p>
                      <p className="text-sm font-black text-purple-800 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-purple-500" />
                        {Math.floor(reg.totalMinutes / 60)}시간 {reg.totalMinutes % 60}분
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* Sessions Tab */}
                <TabsContent value="sessions" className="mt-2 p-1">
                  <div className="bg-white rounded-2xl py-6 px-4 border border-gray-100 shadow-sm text-center">
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <TrendingUp className="w-6 h-6 text-emerald-600" />
                    </div>
                    <p className="text-xs text-emerald-600 font-bold mb-1 uppercase tracking-wider">Session Progress</p>
                    <p className="text-sm text-gray-500 font-medium mb-4">평점 이수 현황</p>

                    <div className="flex items-baseline justify-center gap-1 mb-4">
                      <span className="text-4xl font-black text-gray-900 tracking-tight">
                        {reg.sessionsCompleted || 0}
                      </span>
                      <span className="text-xl text-gray-400 font-medium">/</span>
                      <span className="text-xl font-bold text-gray-400">
                        {reg.sessionsTotal || '-'}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (Number(reg.sessionsCompleted || 0) / Number(reg.sessionsTotal || 1)) * 100)}%` }}></div>
                    </div>
                  </div>
                </TabsContent>

                {/* Materials Tab */}
                <TabsContent value="materials" className="mt-2 p-1 space-y-2">
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
                      <p className="text-sm font-bold text-gray-900">강의 자료실</p>
                      <p className="text-xs text-gray-500">발표자료 다운로드</p>
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
                      <p className="text-sm font-bold text-gray-900">초록집 (Abstract)</p>
                      <p className="text-xs text-gray-500">학술대회 초록 모음</p>
                    </div>
                  </a>
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
                      <p className="text-lg font-bold text-gray-900">전체 프로그램 보기</p>
                      <p className="text-sm text-gray-500">Google Calendar / App</p>
                    </div>
                  </a>
                </TabsContent>

                {/* Translation Tab */}
                <TabsContent value="translation" className="mt-2 p-1">
                  <div className="bg-gray-50 rounded-2xl py-12 px-4 border border-dashed border-gray-300 text-center">
                    <Languages className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                    <p className="text-sm text-gray-900 font-bold mb-1">실시간 번역 서비스</p>
                    <p className="text-xs text-gray-500">현재 준비 중입니다</p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Home Button - Floating Bottom aesthetics */}
          <div className="mt-6 text-center">
            <a
              href={`https://${hostname}/${slug.split('_')[1]}`}
              className="inline-flex items-center justify-center py-3 px-8 bg-white/80 backdrop-blur-sm text-emerald-800 font-bold rounded-full hover:bg-white transition-colors border border-emerald-100 shadow-sm text-sm"
            >
              학술대회 홈페이지로 이동
            </a>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default BadgePrepPage;
