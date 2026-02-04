import React, { useEffect, useState, useCallback } from 'react';
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
                  ⚠️ 현장 인포데스크에서 QR을 스캔하여<br/>디지털 명찰을 발급받아야 합니다
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
                  value={reg.confirmationQr || JSON.stringify({
                    type: 'CONFIRM',
                    regId: reg.id,
                    userId: 'FALLBACK',
                    t: Date.now()
                  })}
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

    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 flex flex-col p-4 font-sans">
        <div className="w-full max-w-md mx-auto">
          {/* Digital Badge Card - Professional Name Tag */}
          <div className="bg-white border-4 border-emerald-500 rounded-3xl overflow-hidden shadow-2xl">
            {/* Issued Badge Header - Always Visible */}
            <div className="bg-gradient-to-r from-emerald-500 to-green-500 py-2 px-4">
              <div className="flex items-center justify-center gap-2 text-white">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-bold tracking-wide">DIGITAL BADGE ISSUED</span>
              </div>
            </div>

            {/* Badge Info - Always Visible */}
            <div className="p-6 text-center">
              <p className="text-sm text-gray-600 font-medium mb-1">{reg.affiliation || '-'}</p>
              <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">{reg.name}</h2>

              {/* License Number */}
              {reg.licenseNumber && reg.licenseNumber !== '-' && (
                <div className="bg-emerald-50 rounded-lg py-1 px-3 mb-4 inline-block">
                  <p className="text-xs font-semibold text-emerald-700">면허번호: {reg.licenseNumber}</p>
                </div>
              )}

              {/* QR Code - Always Visible & Accessible */}
              <div className="bg-white p-3 inline-block rounded-2xl shadow-lg border-2 border-emerald-200 mb-3">
                {reg.badgeQr && (
                  <QRCodeSVG value={reg.badgeQr} size={140} level="M" includeMargin={false} />
                )}
              </div>
              <p className="text-xs font-semibold text-emerald-700">입장/퇴장용 QR 코드</p>
            </div>

            {/* Tabbed Interface */}
            <Tabs defaultValue="status" className="w-full">
              <TabsList className="grid grid-cols-5 w-full h-auto p-1 bg-gray-50 border-t border-gray-200">
                <TabsTrigger value="status" className="text-xs py-2 px-1 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700">
                  <User className="w-3 h-3 mr-1" />
                  상태
                </TabsTrigger>
                <TabsTrigger value="sessions" className="text-xs py-2 px-1 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  수강
                </TabsTrigger>
                <TabsTrigger value="materials" className="text-xs py-2 px-1 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700">
                  <FileText className="w-3 h-3 mr-1" />
                  자료
                </TabsTrigger>
                <TabsTrigger value="program" className="text-xs py-2 px-1 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700">
                  <Calendar className="w-3 h-3 mr-1" />
                  프로그램
                </TabsTrigger>
                <TabsTrigger value="translation" className="text-xs py-2 px-1 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700">
                  <Languages className="w-3 h-3 mr-1" />
                  번역
                </TabsTrigger>
              </TabsList>

              {/* Status Tab */}
              <TabsContent value="status" className="p-4 space-y-3">
                <div className={`py-3 px-4 rounded-xl font-bold text-center ${
                  reg.attendanceStatus === 'INSIDE'
                    ? 'bg-green-100 text-green-700 border-2 border-green-300'
                    : 'bg-gray-100 text-gray-500 border-2 border-gray-300'
                }`}>
                  <div className="flex items-center justify-center gap-2">
                    {reg.attendanceStatus === 'INSIDE'
                      ? <><span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" /><span>입장 중</span></>
                      : <><span className="w-3 h-3 bg-gray-400 rounded-full" /><span>퇴장 상태</span></>
                    }
                  </div>
                </div>

                {reg.currentZone && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl py-2 px-3">
                    <p className="text-xs text-blue-600 font-semibold mb-1">현재 위치</p>
                    <p className="text-sm font-bold text-blue-900 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {reg.currentZone}
                    </p>
                  </div>
                )}

                {reg.totalMinutes > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl py-2 px-3">
                    <p className="text-xs text-purple-600 font-semibold mb-1">총 참여 시간</p>
                    <p className="text-sm font-bold text-purple-900 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {Math.floor(reg.totalMinutes / 60)}시간 {reg.totalMinutes % 60}분
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* Sessions Tab */}
              <TabsContent value="sessions" className="p-4">
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl py-4 px-4 border border-emerald-200 text-center">
                  <p className="text-xs text-emerald-600 font-semibold mb-2">이수 현황</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-3xl font-black text-emerald-700">
                      {reg.sessionsCompleted || 0}
                    </span>
                    <span className="text-xl text-emerald-600">/</span>
                    <span className="text-xl font-bold text-emerald-600">
                      {reg.sessionsTotal || '-'}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-600 mt-2">완료된 세션</p>
                </div>
              </TabsContent>

              {/* Materials Tab */}
              <TabsContent value="materials" className="p-4">
                <div className="space-y-2">
                  <a
                    href={`https://${hostname}/${slug}/materials`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 px-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-center transition-colors"
                  >
                    <p className="text-sm font-bold text-blue-900 flex items-center justify-center gap-2">
                      <Download className="w-4 h-4" />
                      강의 자료실
                    </p>
                  </a>
                  <a
                    href={`https://${hostname}/${slug}/abstracts`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 px-4 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl text-center transition-colors"
                  >
                    <p className="text-sm font-bold text-purple-900 flex items-center justify-center gap-2">
                      <FileText className="w-4 h-4" />
                      초록집
                    </p>
                  </a>
                </div>
              </TabsContent>

              {/* Program Tab */}
              <TabsContent value="program" className="p-4">
                <a
                  href={`https://${hostname}/${slug}/program`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3 px-4 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-center transition-colors"
                >
                  <p className="text-sm font-bold text-amber-900 flex items-center justify-center gap-2">
                    <Calendar className="w-4 h-4" />
                    학술대회 프로그램 보기
                  </p>
                </a>
              </TabsContent>

              {/* Translation Tab */}
              <TabsContent value="translation" className="p-4">
                <div className="bg-gray-50 rounded-xl py-4 px-4 border border-gray-200 text-center">
                  <Languages className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 font-semibold mb-2">실시간 번역</p>
                  <p className="text-xs text-gray-400 mb-3">준비 중입니다</p>
                  <p className="text-xs text-gray-400">곧 제공될 서비스입니다</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Home Button */}
          <a
            href={`https://${hostname}/${slug.split('_')[1]}`}
            className="block w-full mt-4 py-3 px-6 bg-white text-emerald-700 font-bold rounded-xl hover:bg-emerald-50 transition-colors text-center border-2 border-emerald-200 shadow-md"
          >
            학술대회 홈페이지
          </a>
        </div>
      </div>
    );
  }

  return null;
};

export default BadgePrepPage;
