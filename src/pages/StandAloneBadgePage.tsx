import React from "react";
import { useParams } from "react-router-dom";
import {
  Loader2,
  Clock,
  CheckCircle,
  FileText,
  Calendar,
  Languages,
  Download,
  MapPin,
  TrendingUp,
} from "lucide-react";
import { TranslationPanel } from "@/components/translation/TranslationPanel";
import { QnAPanel } from "@/components/badge/QnAPanel";
import { CertificateDownloader } from "@/components/badge/CertificateDownloader";
import { StampTourPanel } from "@/components/badge/StampTourPanel";
import { UnifiedBadgeView } from "@/components/badge/UnifiedBadgeView";
import { useStandAloneBadge } from "@/hooks/useStandAloneBadge";

const StandAloneBadgePage: React.FC = () => {
  const { slug } = useParams();
  const {
    status,
    ui,
    zones,
    liveMinutes,
    attendanceMode,
    attendanceGoalMinutes,
    badgeConfig,
    msg,
    refreshing,
    badgeLang,
    setBadgeLang,
    t,
    formatMinutes,
    getConfIdToUse,
    qrValue,
    effectiveMenuVis,
    certificateEnabled,
    todayAccumulated,
    remainingMinutes,
    progressPercent,
    confId,
    navigate,
    publicSlug,
  } = useStandAloneBadge(slug);

  if (msg && status !== "READY")
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center font-sans">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-xl font-medium text-gray-600">{msg}</p>
        </div>
      </div>
    );
  if (!ui)
    return (
      <div className="p-10 text-center flex items-center justify-center min-h-screen">
        {t(
          "명찰 정보를 찾을 수 없습니다.",
          "Badge information is not available.",
        )}
      </div>
    );

  return (
    <UnifiedBadgeView
      mode={ui.issued ? "issued" : "voucher"}
      ui={ui}
      menuVis={effectiveMenuVis}
      badgeConfig={badgeConfig}
      badgeLang={badgeLang}
      setBadgeLang={setBadgeLang}
      attendance={ui ? {
        status: ui.status as "INSIDE" | "OUTSIDE",
        currentZone: ui.zone !== "OUTSIDE" ? ui.zone : null,
        isCheckedIn: ui.isCheckedIn,
        paymentStatus: ui.paymentStatus,
        amount: ui.amount,
      } : null}
      liveMinutes={liveMinutes}
      refreshing={refreshing}
      isCompleted={ui.isCompleted}
      voucherQr={qrValue}
      onNavigateHome={() => navigate(`/${publicSlug}`)}
      renderStatusTab={() => (
        <>
          <div
            className={`py-6 px-6 rounded-2xl font-body font-semibold text-center border-2 shadow-lg transition-all relative overflow-hidden ${
              ui.status === "INSIDE"
                ? "bg-gradient-to-br from-emerald-50 via-green-50/80 to-teal-50/60 text-emerald-700 border-emerald-200/70 shadow-emerald-100/50"
                : "bg-gradient-to-br from-slate-50 to-gray-50/80 text-slate-600 border-slate-200/70 shadow-slate-100/50"
            }`}
          >
            {ui.status === "INSIDE" && (
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 via-transparent to-green-400/10 animate-pulse"></div>
            )}
            <div className="flex items-center justify-center gap-3 relative z-10">
              {ui.status === "INSIDE" ? (
                <>
                  <div className="relative">
                    <span className="w-4 h-4 bg-emerald-500 rounded-full flex animate-pulse shadow-lg" />
                    <span className="absolute inset-0 w-4 h-4 bg-emerald-400 rounded-full animate-ping" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-display font-semibold">{t("학술대회 입장중", "Conference Active")}</span>
                    <span className="text-sm opacity-80">{t("출석 인정 중", "Attendance Active")}</span>
                  </div>
                </>
              ) : (
                <>
                  <span className="w-4 h-4 bg-slate-400 rounded-full shadow-md" />
                  <div className="flex flex-col">
                    <span className="text-lg font-display font-semibold">{t("대기중", "Standby")}</span>
                    <span className="text-sm opacity-80">{t("입장 전 상태", "Pre-entry")}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {ui.zone && ui.zone !== "OUTSIDE" && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl py-3 px-4 flex justify-between items-center">
              <p className="text-xs text-blue-600 font-bold">
                {t("현재 구역", "Current zone")}
              </p>
              <p className="text-sm font-black text-blue-800 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-blue-500" />
                {zones.find((z) => z.id === ui.zone)?.name || ui.zone}
              </p>
            </div>
          )}

          {liveMinutes > 0 && (
            <div className="bg-purple-50/50 border border-purple-100 rounded-xl py-3 px-4 flex justify-between items-center">
              <div className="flex flex-col">
                <p className="text-xs text-purple-600 font-bold">
                  {t("누적 체류 시간", "Total attendance time")}
                </p>
                {ui.status === "INSIDE" && (
                  <p className="text-[10px] text-purple-400">
                    {t(
                      "현재 세션 시간이 계속 반영됩니다.",
                      "Current session time is updating live.",
                    )}
                  </p>
                )}
              </div>
              <p className="text-sm font-black text-purple-800 flex items-center gap-1">
                <Clock className="w-3 h-3 text-purple-500" />
                {formatMinutes(liveMinutes)}
              </p>
            </div>
          )}

          {certificateEnabled && (
            <div className="mt-4">
              <CertificateDownloader
                confId={confId}
                ui={ui}
                badgeLang={badgeLang}
              />
            </div>
          )}

          {(attendanceMode === "CUMULATIVE" && attendanceGoalMinutes > 0) && (
            <div className="bg-eregi-primary/5 border border-eregi-primary/10 rounded-xl py-3 px-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-eregi-primary font-body font-semibold">
                  {t("이수 목표 / 남은 시간", "Goal / Remaining")}
                </p>
                <p className="text-xs font-body font-bold text-eregi-primary">
                  {progressPercent}%
                </p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-eregi-primary/10 overflow-hidden">
                <div
                  className="h-full bg-eregi-primary"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between items-center text-sm font-body font-semibold">
                <span className="text-eregi-primary">
                  {formatMinutes(attendanceGoalMinutes)}
                </span>
                <span className="text-gray-500">{t("남음", "Left")}</span>
                <span className="text-gray-900">
                  {formatMinutes(remainingMinutes)}
                </span>
              </div>
            </div>
          )}

          {(attendanceMode === "CUMULATIVE" && (attendanceGoalMinutes > 0 || todayAccumulated > 0)) && (
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl py-3 px-4 flex justify-between items-center">
              <div className="flex flex-col">
                <p className="text-xs text-indigo-700 font-bold">
                  {t("오늘 인정 시간", "Today tracked time")}
                </p>
                {ui.status === "INSIDE" && (
                  <p className="text-[10px] text-indigo-400">
                    {t(
                      "현재 세션 시간이 계속 반영됩니다.",
                      "Current session time is updating live.",
                    )}
                  </p>
                )}
              </div>
              <p className="text-sm font-black text-indigo-900 flex items-center gap-1">
                <Clock className="w-3 h-3 text-indigo-500" />
                {formatMinutes(todayAccumulated)}
              </p>
            </div>
          )}
        </>
      )}
      renderSessionsTab={() => (
        <div className="bg-white rounded-2xl py-6 px-4 border border-gray-100 shadow-sm text-center">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg border-3 transition-all ${ui.isCompleted ? "bg-gradient-to-br from-emerald-50 to-green-100/80 text-emerald-600 border-emerald-200 shadow-emerald-100/50" : "bg-gradient-to-br from-slate-50 to-gray-100/80 text-slate-500 border-slate-200 shadow-slate-100/50"}`}
          >
            {ui.isCompleted ? (
              <CheckCircle className="w-8 h-8 text-emerald-600 drop-shadow-sm" />
            ) : (
              <TrendingUp className="w-8 h-8 text-slate-500" />
            )}
          </div>
          <p className="text-xs text-gray-500 font-bold mb-1 uppercase tracking-wider">
            {t("세션 진행", "Session Progress")}
          </p>
          <p className="text-sm text-gray-500 font-medium mb-4">
            {t(
              "참가자의 출석 진행 상태입니다.",
              "This shows the attendee session progress.",
            )}
          </p>

          <div className="flex flex-col items-center gap-1 mb-4">
            <span
              className={`text-3xl font-display font-semibold tracking-tight ${ui.isCompleted ? "text-eregi-primary" : "text-foreground"}`}
            >
              {ui.isCompleted
                ? t("이수 완료", "Completed")
                : t("진행 중", "In Progress")}
            </span>
            <span className="text-sm font-bold text-gray-500 mt-2 bg-gray-50 px-4 py-2 rounded-lg">
              {t("누적 인정 시간", "Tracked time")}:{" "}
              <span className="text-purple-600">
                {formatMinutes(liveMinutes)}
              </span>
            </span>
            {(attendanceMode === "CUMULATIVE" &&
              attendanceGoalMinutes > 0) && (
              <div className="mt-3 w-full bg-eregi-primary/5 border border-eregi-primary/10 rounded-xl px-4 py-3">
                <div className="flex justify-between items-center text-xs font-body font-semibold text-eregi-primary">
                  <span>
                    {t("목표", "Goal")}:{" "}
                    {formatMinutes(attendanceGoalMinutes)}
                  </span>
                  <span>
                    {t("남은 시간", "Remaining")}:{" "}
                    {formatMinutes(remainingMinutes)}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-eregi-primary/10 overflow-hidden">
                  <div
                    className="h-full bg-eregi-primary"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      renderMaterialsTab={() =>
        badgeConfig?.materialsUrls &&
        badgeConfig.materialsUrls.length > 0 ? (
          badgeConfig.materialsUrls.map((mat, idx: number) => (
            <a
              key={idx}
              href={mat.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center p-4 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl transition-all group"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-blue-200 transition-colors">
                <Download className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-gray-900">
                  {mat.name}
                </p>
                <p className="text-xs text-gray-500">
                  {t(
                    "자료를 새 창에서 엽니다.",
                    "Open material in a new window.",
                  )}
                </p>
              </div>
            </a>
          ))
        ) : (
          <>
            <a
              href={`/${slug}/materials`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center p-4 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl transition-all group"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-blue-200 transition-colors">
                <Download className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-gray-900">
                  {t("강의 자료집", "Lecture materials")}
                </p>
                <p className="text-xs text-gray-500">
                  {t(
                    "발표 자료를 확인할 수 있습니다.",
                    "Open presentation materials.",
                  )}
                </p>
              </div>
            </a>
            <a
              href={`/${slug}/abstracts`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center p-4 bg-white hover:bg-purple-50 border border-gray-200 hover:border-purple-200 rounded-xl transition-all group"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-purple-200 transition-colors">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-gray-900">
                  {t("초록집", "Abstract book")}
                </p>
                <p className="text-xs text-gray-500">
                  {t(
                    "초록 자료를 확인할 수 있습니다.",
                    "Open the abstract book.",
                  )}
                </p>
              </div>
            </a>
          </>
        )
      }
      renderProgramTab={() => (
        <a
          href={`/${slug}/program`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center p-8 bg-white border border-gray-200 rounded-2xl hover:border-amber-300 hover:bg-amber-50 transition-all text-center gap-3"
        >
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
            <Calendar className="w-8 h-8 text-amber-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">
              {t("프로그램 일정 보기", "Open program schedule")}
            </p>
            <p className="text-sm text-gray-500">
              Google Calendar / App
            </p>
          </div>
        </a>
      )}
      renderTranslationTab={() =>
        badgeConfig?.translationUrl &&
        badgeConfig.translationUrl.startsWith("http") ? (
          <a
            href={badgeConfig.translationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full"
          >
            <div className="bg-blue-50 rounded-2xl py-12 px-4 border border-blue-200 text-center hover:bg-blue-100 transition-colors cursor-pointer shadow-sm">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 relative overflow-hidden">
                <Languages className="w-8 h-8 relative z-10" />
                <span className="absolute inset-0 bg-blue-400 opacity-20 animate-ping rounded-full" />
              </div>
              <p className="text-sm text-blue-900 font-bold mb-1">
                {t(
                  "실시간 번역 서비스 연결",
                  "Real-time Translation",
                )}
              </p>
              <p className="text-xs text-blue-600">
                {t(
                  "클릭하면 번역 서비스로 이동합니다",
                  "Click to open translation service",
                )}
              </p>
            </div>
          </a>
        ) : (
          <TranslationPanel
            defaultConferenceId={getConfIdToUse(slug)}
          />
        )
      }
      renderStampTourTab={() => (
        <StampTourPanel
          confId={getConfIdToUse(slug)}
          userId={ui.userId}
          userName={ui.name}
          userAff={ui.aff}
          badgeLang={badgeLang}
        />
      )}
      renderQnATab={() => (
        <QnAPanel
          confId={getConfIdToUse(slug)}
          userId={ui.userId}
          userName={ui.name}
          userAff={ui.aff}
          badgeLang={badgeLang}
        />
      )}
    />
  );
};

export default StandAloneBadgePage;
