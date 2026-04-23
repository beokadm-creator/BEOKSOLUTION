import React, { useCallback, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  RefreshCw,
  CheckCircle,
  Clock,
  FileText,
  Calendar,
  Languages,
  User,
  TrendingUp,
  Gift,
  HelpCircle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  BadgeConfig,
  BadgeUiState,
  ResolvedMenuVisibility,
} from "@/types/badge";
import {
  t as tFn,
  resolveMenuLabel,
  badgeGridColsClass,
} from "@/utils/badgeUi";

/** Live attendance data passed from the page container. */
export interface AttendanceData {
  status: "INSIDE" | "OUTSIDE";
  currentZone: string | null;
  isCheckedIn: boolean;
  paymentStatus: string;
  amount: number;
}

export interface UnifiedBadgeViewProps {
  mode: "voucher" | "issued";
  ui: BadgeUiState;
  menuVis: ResolvedMenuVisibility;
  badgeConfig: BadgeConfig | null;
  badgeLang: "ko" | "en";
  setBadgeLang: (lang: "ko" | "en") => void;
  attendance: AttendanceData | null;
  liveMinutes: number;
  refreshing: boolean;
  isCompleted: boolean;
  voucherQr: string;
  onNavigateHome?: () => void;
  renderStatusTab?: () => React.ReactNode;
  renderSessionsTab?: () => React.ReactNode;
  renderMaterialsTab?: () => React.ReactNode;
  renderProgramTab?: () => React.ReactNode;
  renderTranslationTab?: () => React.ReactNode;
  renderQnATab?: () => React.ReactNode;
  renderStampTourTab?: () => React.ReactNode;
}

export const UnifiedBadgeView: React.FC<UnifiedBadgeViewProps> = ({
  mode,
  ui,
  menuVis,
  badgeConfig,
  badgeLang,
  setBadgeLang,
  attendance,
  liveMinutes,
  refreshing,
  isCompleted,
  voucherQr,
  onNavigateHome,
  renderStatusTab,
  renderSessionsTab,
  renderMaterialsTab,
  renderProgramTab,
  renderTranslationTab,
  renderQnATab,
  renderStampTourTab,
}) => {
  const t = useCallback(
    (ko: string, en: string) => tFn(badgeLang, ko, en),
    [badgeLang],
  );

  const getMenuLabel = useCallback(
    (key: keyof NonNullable<BadgeConfig["menuLabels"]>, fallbackKo: string, fallbackEn: string) =>
      resolveMenuLabel(badgeConfig?.menuLabels, badgeLang, key, fallbackKo, fallbackEn),
    [badgeConfig?.menuLabels, badgeLang],
  );

  const translationEnabled =
    badgeConfig?.translationUrl !== "HIDE" && menuVis.translation;

  const tabsOrder = useMemo(
    () =>
      [
        menuVis.status ? "status" : null,
        menuVis.sessions ? "sessions" : null,
        menuVis.materials ? "materials" : null,
        menuVis.program ? "program" : null,
        translationEnabled ? "translation" : null,
        menuVis.stampTour ? "stamp-tour" : null,
        menuVis.qna ? "qna" : null,
      ].filter(Boolean) as string[],
    [menuVis, translationEnabled],
  );

  const defaultTab = tabsOrder[0] || "status";
  const gridColsClass = badgeGridColsClass(tabsOrder.length);

  const langToggle = (
    <div className="mb-4 flex justify-end gap-2">
      <button
        type="button"
        onClick={() => setBadgeLang("ko")}
        className={`rounded-full px-4 py-2 text-sm font-body font-semibold transition-all ${
          mode === "voucher" ? "px-4 py-2 text-sm" : "px-4 py-2 text-xs"
        } ${
          badgeLang === "ko"
            ? "bg-slate-900 text-white shadow-lg shadow-slate-900/15"
            : "border border-white/70 bg-white/80 text-slate-600 backdrop-blur hover:bg-white"
        }`}
      >
        한국어
      </button>
      <button
        type="button"
        onClick={() => setBadgeLang("en")}
        className={`rounded-full px-4 py-2 text-sm font-body font-semibold transition-all ${
          mode === "voucher" ? "px-4 py-2 text-sm" : "px-4 py-2 text-xs"
        } ${
          badgeLang === "en"
            ? "bg-slate-900 text-white shadow-lg shadow-slate-900/15"
            : "border border-white/70 bg-white/80 text-slate-600 backdrop-blur hover:bg-white"
        }`}
      >
        English
      </button>
    </div>
  );

  if (mode === "voucher") {
    return (
      <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.06),_transparent_40%),linear-gradient(180deg,_#f8fafc_0%,_#eef4ff_52%,_#f8fafc_100%)] flex flex-col items-center justify-center p-4 font-body">
        <div className="w-full max-w-sm">
          {langToggle}

          <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.45)] flex flex-col">
            <div className="relative bg-gradient-to-r from-amber-600 via-orange-500 to-amber-500 px-6 pt-6 pb-12 text-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.2),_transparent_28%),linear-gradient(90deg,_transparent,_rgba(255,255,255,0.08),_transparent)]" />
              {refreshing && (
                <div className="absolute top-4 right-4 z-10">
                  <RefreshCw className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
              <div className="relative flex items-start justify-between gap-4">
                <div className="text-left flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/80">
                    Conference Pass
                  </p>
                  <h1 className="mt-2 text-2xl font-display font-semibold tracking-tight break-keep">
                    {t("등록 확인 바우처", "Registration Voucher")}
                  </h1>
                  <p className="mt-2 text-sm text-white/90 break-keep">
                    {t(
                      "현장 등록 데스크에서 확인 후 디지털 명찰로 전환됩니다.",
                      "Present this at the on-site desk to activate your digital badge.",
                    )}
                  </p>
                </div>
                <div className="rounded-full border border-white/20 bg-white/20 p-3 backdrop-blur shrink-0 mt-1">
                  <Clock className="h-5 w-5 animate-pulse" />
                </div>
              </div>
            </div>

            <div className="relative px-6 pb-6 -mt-6">
              <div className="rounded-[1.6rem] border border-slate-200/70 bg-white p-6 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] relative z-20">
                <div className="mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                      Status
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {t("명찰 발급 대기 중", "Badge issuance pending")}
                    </p>
                  </div>
                  <FileText className="h-5 w-5 text-slate-400" />
                </div>

                <div className="flex flex-col items-center justify-center text-center">
                  <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-400 break-keep">
                    {ui.aff || "-"}
                  </p>
                  <h2 className="mt-3 text-3xl font-display font-semibold tracking-tight text-slate-950">
                    {ui.name}
                  </h2>

                  {ui.license && ui.license !== "-" && (
                    <div className="mt-4 inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                      {t("면허번호", "License No.")}: {ui.license}
                    </div>
                  )}
                </div>

                <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-slate-50/50 p-5">
                  <div className="mb-5 flex flex-col items-center justify-center text-center">
                    <div className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white mb-3">
                      Voucher
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                      Desk QR
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-600 break-keep">
                      {t("인포데스크 제시용 QR 코드", "Show this QR at the info desk")}
                    </p>
                  </div>
                  <div className="mx-auto flex justify-center rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm w-fit">
                    <QRCodeSVG
                      key={voucherQr}
                      value={voucherQr}
                      size={176}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 text-center">
                  <p className="flex items-center justify-center gap-2 text-sm font-semibold text-amber-900">
                    <User className="h-4 w-4" />
                    {t("현장 안내", "On-site guidance")}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-amber-800 break-keep">
                    {t(
                      "위 QR 코드를 현장 인포데스크에 제시하면 디지털 명찰이 발급됩니다.",
                      "Present the QR code above at the desk to receive your digital badge.",
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {refreshing && (
            <div className="mt-6 flex items-center justify-center gap-2 rounded-full border border-sky-100 bg-white/80 px-5 py-3 text-center text-sm font-body text-sky-800 shadow-sm backdrop-blur">
              <RefreshCw className="w-5 h-5 animate-spin" />
              {t("명찰 발급 상태 확인 중...", "Checking badge issuance...")}
            </div>
          )}

          {menuVis.home && onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="mt-6 block w-full rounded-full border border-slate-200 bg-white/85 px-6 py-4 text-center font-body font-semibold text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-white"
            >
              {getMenuLabel("home", "학술대회 홈페이지로 이동", "Conference Home")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const qrValue = ui.badgeQr || `BADGE-${ui.id}`;

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.16),_transparent_36%),linear-gradient(180deg,_#eff6ff_0%,_#f8fafc_48%,_#eef2ff_100%)] flex flex-col p-4 font-body">
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col justify-start sm:justify-center py-4 sm:py-6">
        {langToggle}

        <div className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/90 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.45)] backdrop-blur flex flex-col">
          <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-eregi-primary to-sky-700 px-6 pb-6 pt-5 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.2),_transparent_28%),linear-gradient(90deg,_transparent,_rgba(255,255,255,0.08),_transparent)]" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/70">
                  Conference Badge
                </p>
                <h2 className="mt-2 text-[1.75rem] font-display font-semibold tracking-tight">
                  {badgeLang === "en" ? "Digital Badge" : "디지털 명찰"}
                </h2>
                <p className="mt-2 text-sm text-white/80">
                  {badgeLang === "en"
                    ? "You can enter/exit with the QR code."
                    : "QR로 입장/퇴장 하실 수 있습니다."}
                </p>
              </div>
              <div className="rounded-full border border-white/20 bg-white/10 p-3 backdrop-blur">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="relative p-6 flex flex-col items-center text-center bg-[linear-gradient(180deg,_rgba(248,250,252,0.92)_0%,_white_100%)]">
            <div className="absolute right-[-18%] top-5 h-36 w-36 rounded-full bg-sky-100/60 blur-2xl" />
            <div className="absolute left-[-20%] bottom-10 h-32 w-32 rounded-full bg-indigo-100/60 blur-2xl" />

            <div className="relative z-10 w-full">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400 break-keep">
                {ui.aff || "-"}
              </p>
              <h3 className="mt-3 text-3xl font-display font-semibold tracking-tight text-slate-950">
                {ui.name}
              </h3>

              {ui.license && ui.license !== "-" && (
                <div className="mx-auto mt-5 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
                  {badgeLang === "en" ? "License" : "면허번호"}: {ui.license}
                </div>
              )}

              <div className="mx-auto mt-6 max-w-[18rem] rounded-[1.8rem] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.5)]">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-400">
                    Access QR
                  </p>
                  <div className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white">
                    Active
                  </div>
                </div>
                <div className="mt-4 rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm flex justify-center items-center">
                  <QRCodeSVG
                    key={qrValue}
                    value={qrValue}
                    size={176}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-600 text-center">
                  {badgeLang === "en"
                    ? "You can enter/exit with the QR code."
                    : "QR로 입장/퇴장 하실 수 있습니다."}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200/80 bg-[linear-gradient(180deg,_rgba(248,250,252,0.78)_0%,_rgba(255,255,255,0.98)_100%)] p-3">
            <Tabs defaultValue={defaultTab} className="w-full">
              <TabsList
                className={`grid w-full h-auto rounded-2xl border border-slate-200 bg-white/90 p-1.5 shadow-sm ${gridColsClass}`}
              >
                {menuVis.status && (
                  <TabsTrigger
                    value="status"
                    className="flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                  >
                    <User className="w-4 h-4" />
                    <span className="text-xs font-body font-medium">
                      {getMenuLabel("status", "상태", "Status")}
                    </span>
                  </TabsTrigger>
                )}
                {menuVis.sessions && (
                  <TabsTrigger
                    value="sessions"
                    className="flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-body font-medium">
                      {getMenuLabel("sessions", "수강", "Sessions")}
                    </span>
                  </TabsTrigger>
                )}
                {menuVis.materials && (
                  <TabsTrigger
                    value="materials"
                    className="flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="text-xs font-body font-medium">
                      {getMenuLabel("materials", "자료", "Materials")}
                    </span>
                  </TabsTrigger>
                )}
                {menuVis.program && (
                  <TabsTrigger
                    value="program"
                    className="flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                  >
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-body font-medium">
                      {getMenuLabel("program", "일정", "Program")}
                    </span>
                  </TabsTrigger>
                )}
                {translationEnabled && (
                  <TabsTrigger
                    value="translation"
                    className="flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                  >
                    <Languages className="w-4 h-4" />
                    <span className="text-xs font-body font-medium">
                      {getMenuLabel("translation", "번역", "Translation")}
                    </span>
                  </TabsTrigger>
                )}
                {menuVis.stampTour && (
                  <TabsTrigger
                    value="stamp-tour"
                    className="flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                  >
                    <Gift className="w-4 h-4" />
                    <span className="text-xs font-body font-medium">
                      {getMenuLabel("stampTour", "메뉴", "Menu")}
                    </span>
                  </TabsTrigger>
                )}
                {menuVis.qna && (
                  <TabsTrigger
                    value="qna"
                    className="flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span className="text-xs font-body font-medium">
                      {getMenuLabel("qna", "Q&A", "Q&A")}
                    </span>
                  </TabsTrigger>
                )}
              </TabsList>

              {menuVis.status && renderStatusTab && (
                <TabsContent value="status" className="mt-3 p-2 space-y-3">
                  {renderStatusTab()}
                </TabsContent>
              )}
              {menuVis.sessions && renderSessionsTab && (
                <TabsContent value="sessions" className="mt-2 p-1">
                  {renderSessionsTab()}
                </TabsContent>
              )}
              {menuVis.materials && renderMaterialsTab && (
                <TabsContent value="materials" className="mt-2 p-1 space-y-2">
                  {renderMaterialsTab()}
                </TabsContent>
              )}
              {menuVis.program && renderProgramTab && (
                <TabsContent value="program" className="mt-2 p-1">
                  {renderProgramTab()}
                </TabsContent>
              )}
              {translationEnabled && renderTranslationTab && (
                <TabsContent value="translation" className="mt-2 p-1">
                  {renderTranslationTab()}
                </TabsContent>
              )}
              {menuVis.stampTour && renderStampTourTab && (
                <TabsContent value="stamp-tour" className="mt-2 p-1 space-y-3">
                  {renderStampTourTab()}
                </TabsContent>
              )}
              {menuVis.qna && renderQnATab && (
                <TabsContent value="qna" className="mt-2 p-1">
                  {renderQnATab()}
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>

        {menuVis.home && onNavigateHome && (
          <div className="mt-6 text-center">
            <button
              onClick={onNavigateHome}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/85 px-8 py-3 text-sm font-body font-semibold text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-white"
            >
              {getMenuLabel("home", "학술대회 홈페이지로 이동", "Conference Home")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
