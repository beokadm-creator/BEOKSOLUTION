import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import { RefreshCw, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

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
  const getConfIdToUse = (slugVal: string | undefined): string => {
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
  };

  // Validate token
  const validateToken = async () => {
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
  };

  // Initial validation
  useEffect(() => {
    validateToken();
  }, [token, slug]);

  // Handle token reissue redirect
  useEffect(() => {
    if (result?.redirectRequired && result.newToken) {
      // Redirect to new token URL
      window.location.href = `https://${hostname}/${slug}/badge-prep/${result.newToken}`;
    }
  }, [result?.redirectRequired, result?.newToken]);

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
  }, [result?.tokenStatus]);

  // Get hostname for URL
  const hostname = window.location.hostname;

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

  // Active → Show Voucher
  if (result.tokenStatus === 'ACTIVE' && result.registration) {
    const reg = result.registration;

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-full max-w-sm">
          {/* Main Badge Card */}
          <div className="bg-white border-4 border-gray-200 rounded-3xl p-8 text-center shadow-2xl relative">
            {refreshing && (
              <div className="absolute top-2 right-2">
                <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
              </div>
            )}

            <h1 className="text-lg font-bold mb-2 tracking-wide text-gray-600 uppercase">
              Registration Voucher
            </h1>

            {/* Organization */}
            <p className="text-base text-gray-600 font-medium mb-4">{reg.affiliation || '-'}</p>

            {/* Name */}
            <h2 className="text-3xl font-black text-gray-900 mb-6 tracking-tight">{reg.name}</h2>

            {/* Receipt Number */}
            <div className="bg-gray-50 rounded-xl py-2 px-4 mb-6">
              <p className="text-xs font-bold text-gray-500 uppercase">Receipt Number</p>
              <p className="text-lg font-bold text-indigo-600">{reg.receiptNumber}</p>
            </div>

            {/* QR Code */}
            <div className="bg-white p-4 inline-block rounded-2xl shadow-inner border border-gray-100 mb-6">
              <QRCodeSVG value={reg.confirmationQr} size={180} level="M" includeMargin={false} />
            </div>

            {/* License Number */}
            {reg.licenseNumber && reg.licenseNumber !== '-' && (
              <div className="bg-gray-50 rounded-lg py-2 px-4 mb-6">
                <p className="text-sm font-medium text-gray-700">면허번호: {reg.licenseNumber}</p>
              </div>
            )}

            {/* Instruction */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl py-3 px-4 mb-6">
              <p className="text-sm text-indigo-800 font-medium">
                현장 인포데스크에서 QR코드를 제시해주세요.
              </p>
            </div>
          </div>

          {/* Refresh Indicator */}
          {refreshing && (
            <div className="mt-4 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              명찰 발급 상태 확인 중...
            </div>
          )}

          {/* Home Button */}
          <a
            href={`https://${hostname}/${slug}`}
            className="block w-full mt-4 py-3 px-6 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-center"
          >
            학술대회 홈페이지
          </a>
        </div>
      </div>
    );
  }

  // Issued → Show Digital Badge
  if (result.tokenStatus === 'ISSUED' && result.registration) {
    const reg = result.registration;

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-full max-w-sm">
          {/* Digital Badge Card */}
          <div className="bg-white border-4 border-green-500 rounded-3xl p-8 text-center shadow-2xl">
            <div className="flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>

            <h1 className="text-xl font-bold mb-2 tracking-wide text-green-700 uppercase">
              Digital Name Tag
            </h1>

            {/* Organization */}
            <p className="text-lg text-gray-600 font-medium mb-2">{reg.affiliation || '-'}</p>

            {/* Name */}
            <h2 className="text-3xl font-black text-gray-900 mb-6 tracking-tight">{reg.name}</h2>

            {/* QR Code (Final) */}
            <div className="bg-white p-4 inline-block rounded-2xl shadow-inner border border-green-100 mb-6 relative">
              {reg.badgeQr && (
                <QRCodeSVG value={reg.badgeQr} size={180} level="M" includeMargin={false} />
              )}
            </div>

            {/* License Number */}
            {reg.licenseNumber && reg.licenseNumber !== '-' && (
              <div className="bg-green-50 rounded-lg py-2 px-4 mb-4 border border-green-100">
                <p className="text-sm font-medium text-gray-700">면허번호: {reg.licenseNumber}</p>
              </div>
            )}

            {/* Attendance Status */}
            <div className={`mb-4 py-3 px-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 ${
              reg.attendanceStatus === 'INSIDE'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {reg.attendanceStatus === 'INSIDE'
                ? '🟢 입장 중 (INSIDE)'
                : '🔴 퇴장 상태 (OUTSIDE)'}
            </div>

            {/* Current Zone */}
            {reg.currentZone && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl py-2 px-4 mb-4">
                <p className="text-sm text-blue-800 font-medium">
                  현재 위치: {reg.currentZone}
                </p>
              </div>
            )}

            {/* Total Minutes */}
            {reg.totalMinutes > 0 && (
              <div className="bg-purple-50 border border-purple-100 rounded-xl py-2 px-4 mb-6">
                <p className="text-sm text-purple-800 font-medium">
                  총 참여 시간: {Math.floor(reg.totalMinutes / 60)}시간 {reg.totalMinutes % 60}분
                </p>
              </div>
            )}

             {/* Instruction */}
            <div className="bg-green-50 border border-green-100 rounded-xl py-3 px-4">
              <p className="text-sm text-green-800 font-medium">
                수강 입장/퇴장 시 QR코드를 스캔해주세요.
              </p>
            </div>
          </div>

          {/* Home Button */}
          <a
            href={`https://${hostname}/${slug.split('_')[1]}`}
            className="block w-full mt-4 py-3 px-6 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-center"
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
