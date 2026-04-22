import React, { useCallback, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, CheckCircle, Loader2, Clock, FileText, Calendar, Languages, Download, User, MapPin, TrendingUp, Sparkles, Gift, HelpCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { TranslationPanel } from "../../components/translation/TranslationPanel";

export interface BadgeUiState {
  name: string;
  aff: string;
  id: string;
  userId: string;
  issued: boolean;
  status: string;
  badgeQr: string | null;
  receiptNumber?: string;
  isCheckedIn?: boolean;
  paymentStatus?: string;
  amount?: number;
  license?: string;
  zone?: string;
  time?: string;
  isCompleted?: boolean;
  lastCheckIn?: any;
  baseMinutes?: number;
  dailyMinutes?: Record<string, number>;
  zoneMinutes?: Record<string, number>;
  zoneCompleted?: Record<string, boolean>;
}

export interface UnifiedBadgeViewProps {
  status: string;
  ui: BadgeUiState | null;
  msg: string;
  badgeLang: "ko" | "en";
  setBadgeLang: (lang: "ko" | "en") => void;
  badgeConfig: any;
  liveMinutes: number;
  liveSessionMinutes: number;
  zones: any[];
  attendanceMode: string;
  attendanceGoalMinutes: number;
  publicSlug: string;
  refreshing: boolean;
  renderStampTour?: () => React.ReactNode;
  renderQnA?: () => React.ReactNode;
  renderCertificate?: () => React.ReactNode;
}


export const UnifiedBadgeView: React.FC<UnifiedBadgeViewProps> = ({
  status, ui, msg, badgeLang, setBadgeLang, badgeConfig, liveMinutes, liveSessionMinutes, zones, attendanceMode, attendanceGoalMinutes, publicSlug, refreshing, renderStampTour, renderQnA, renderCertificate
}) => {
  const navigate = useNavigate();
  const t = useCallback((ko: string, en: string) => (badgeLang === "ko" ? ko : en), [badgeLang]);
  const formatMinutes = useCallback((minutes: number) => badgeLang === "ko" ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`, [badgeLang]);

  const getMenuLabel = useCallback((key: string, fallbackKo: string, fallbackEn: string) => {
    const labels = badgeConfig?.menuLabels?.[key];
    if (badgeLang === "ko") return labels?.ko || fallbackKo;
    return labels?.en || fallbackEn;
  }, [badgeConfig, badgeLang]);

  const effectiveMenuVisibility = useMemo(() => {
    return { status: true, sessions: true, materials: true, program: true, stampTour: true, home: true, qna: true, ...badgeConfig?.menuVisibility };
  }, [badgeConfig]);

  const translationEnabled = effectiveMenuVisibility.translation ?? true;
  const qrValue = ui?.badgeQr || ui?.id || "ERROR";

  if (status === "INIT" || status === "LOADING") {
    return <div className="flex min-h-[100dvh] items-center justify-center p-6 text-center">Loading...</div>;
  }
  if (status === "NO_AUTH" || status === "NO_DATA") {
    return <div className="flex min-h-[100dvh] items-center justify-center p-6 text-center">{msg}</div>;
  }
  if (!ui) return null;

  const defaultTab = "status";
  const visibleTabsCount = 6;
  const gridColsClass = "grid-cols-4"; // Simple fallback
  const showBadgeQr = !!ui.badgeQr && ui.badgeQr.trim() !== "";

  if (!ui.issued) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-4 bg-slate-50">
        <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-sm w-full">
          <h2 className="text-2xl font-bold mb-4">Voucher</h2>
          <QRCodeSVG value={qrValue} size={200} className="mx-auto" />
          <p className="mt-4 text-xl font-bold">{ui.name}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-slate-50 p-4">
      <div className="max-w-sm mx-auto w-full bg-white rounded-3xl shadow-xl p-6 text-center">
        <h2 className="text-3xl font-bold mb-2">{ui.name}</h2>
        <p className="text-gray-500 mb-6">{ui.aff}</p>
        <QRCodeSVG value={qrValue} size={150} className="mx-auto mb-6" />
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full h-auto gap-2">
             <TabsTrigger value="status"><User className="w-4 h-4"/></TabsTrigger>
             <TabsTrigger value="materials"><FileText className="w-4 h-4"/></TabsTrigger>
             {renderStampTour && <TabsTrigger value="stamp-tour"><Gift className="w-4 h-4"/></TabsTrigger>}
             {renderQnA && <TabsTrigger value="qna"><HelpCircle className="w-4 h-4"/></TabsTrigger>}
          </TabsList>
          <TabsContent value="status">
             <div className="p-4 bg-slate-100 rounded-xl mt-4">Status Info: {ui.status} ({formatMinutes(liveMinutes)})</div>
             {renderCertificate && <div className="mt-4">{renderCertificate()}</div>}
          </TabsContent>
          <TabsContent value="materials">
             <div className="p-4 bg-slate-100 rounded-xl mt-4">Materials</div>
          </TabsContent>
          {renderStampTour && <TabsContent value="stamp-tour">{renderStampTour()}</TabsContent>}
          {renderQnA && <TabsContent value="qna">{renderQnA()}</TabsContent>}
        </Tabs>
      </div>
    </div>
  );
};
