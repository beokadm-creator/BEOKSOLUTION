import React, { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import { useStampTour } from "@/hooks/badge/useStampTour";

interface StampTourPanelProps {
  confId: string;
  userId: string;
  userName: string;
  userAff: string;
  badgeLang: "ko" | "en";
}

export const StampTourPanel: React.FC<StampTourPanelProps> = ({
  confId,
  userId,
  userName,
  userAff,
  badgeLang,
}) => {
  const {
    stampConfig,
    stampProgress,
    stampBooths,
    guestbookEntries,
    requiredCount,
    isCompleted,
    totalVendors,
    myStamps
  } = useStampTour(confId, userId);

  const [rewardRequesting, setRewardRequesting] = useState(false);
  const [rewardMessage, setRewardMessage] = useState("");

  const t = (ko: string, en: string) => (badgeLang === "ko" ? ko : en);

  if (!stampConfig?.enabled) return null;

  const rewardStatus = stampProgress.rewardStatus || "NONE";
  const completedAtMs = stampProgress.completedAt?.toDate?.()?.getTime();
  const lotteryScheduledAtMs = stampConfig?.lotteryScheduledAt?.toDate?.()?.getTime();
  const completedBeforeLotteryCutoff =
    lotteryScheduledAtMs == null || completedAtMs == null || completedAtMs <= lotteryScheduledAtMs;

  const lotteryStatus =
    stampProgress.lotteryStatus ||
    (stampConfig?.rewardFulfillmentMode === "LOTTERY" && isCompleted && completedBeforeLotteryCutoff
      ? "PENDING"
      : undefined);

  const isInstantReward = stampConfig?.rewardFulfillmentMode !== "LOTTERY";
  const canParticipantDraw = isInstantReward && stampConfig?.drawMode !== "ADMIN";
  const missedLotteryCutoff = !isInstantReward && rewardStatus === "NONE" && !completedBeforeLotteryCutoff;

  const handleRewardRequest = async () => {
    if (!confId || !userId || !stampConfig?.enabled) return;

    setRewardRequesting(true);
    setRewardMessage("");
    try {
      const requestReward = httpsCallable(functions, "requestStampReward");
      const response = await requestReward({
        confId,
        userName,
        userOrg: userAff,
      });

      const payload = response.data as { rewardName?: string };
      setRewardMessage(
        payload.rewardName
          ? t(`상품 요청이 접수되었습니다. ${payload.rewardName}`, `Reward request received. ${payload.rewardName}`)
          : t("상품 요청이 접수되었습니다.", "Reward request received.")
      );
    } catch (error) {
      setRewardMessage(
        error instanceof Error ? error.message : t("요청 처리에 실패했습니다.", "Request failed.")
      );
    } finally {
      setRewardRequesting(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
        <h3 className="mb-3 text-xl font-bold text-blue-600">{t("스탬프 투어", "Stamp Tour")}</h3>
        <p className="mb-6 text-sm text-slate-500 leading-relaxed">
          {t("참여 부스를 방문하고 스탬프를 모아보세요", "Visit participating booths and collect stamps")}
        </p>

        <div className="mb-3 flex items-center justify-between text-sm font-bold text-slate-700">
          <span>{t("현재 진행 현황", "Current progress")}</span>
          <span className="rounded-full bg-blue-50 px-4 py-1.5 text-blue-600 border border-blue-100">
            {myStamps.length} / {requiredCount || totalVendors}
          </span>
        </div>

        <div className="mb-6 h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-1000 ease-out"
            style={{ width: `${Math.min(100, requiredCount > 0 ? (myStamps.length / requiredCount) * 100 : 0)}%` }}
          />
        </div>

        {isCompleted && (
          <div className="mt-6 space-y-3">
            <div className="text-sm font-bold text-green-600">
              {stampConfig.completionMessage || t("스탬프 투어를 완료했습니다!", "Stamp tour completed!")}
            </div>
            {rewardStatus === "NONE" && canParticipantDraw && (
              <button
                type="button"
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-50 transition-colors hover:bg-blue-700 shadow-sm"
                onClick={handleRewardRequest}
                disabled={rewardRequesting}
              >
                {rewardRequesting ? t("처리 중...", "Processing...") : t("상품 요청", "Request reward")}
              </button>
            )}
            {rewardStatus === "NONE" && !canParticipantDraw && isInstantReward && (
              <div className="rounded-xl bg-blue-50 border border-blue-100 py-3 px-4 text-sm font-bold text-blue-700">
                {t("관리자 추첨 대기 중", "Waiting for admin draw")}
              </div>
            )}
            {!isInstantReward && lotteryStatus === "PENDING" && (
              <div className="rounded-xl bg-blue-50 border border-blue-100 py-3 px-4 text-sm font-bold text-blue-700">
                {t("예약 추첨 대기 중", "Scheduled draw pending")}
              </div>
            )}
            {!isInstantReward && lotteryStatus === "PENDING" && stampConfig.lotteryScheduledAt && (
              <div className="text-xs text-slate-500">
                {t("추첨 예정", "Scheduled draw")}:{" "}
                {stampConfig.lotteryScheduledAt.toDate().toLocaleString(badgeLang === "ko" ? "ko-KR" : "en-US")}
              </div>
            )}
            {missedLotteryCutoff && (
              <div className="rounded-xl bg-slate-100 border border-slate-200 py-3 px-4 text-sm font-bold text-slate-500">
                {t("예약 추첨 마감 이후 완료되어 제외되었습니다", "Completed after the draw cutoff, excluded")}
              </div>
            )}
            {rewardStatus === "REQUESTED" && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 py-3 px-4 text-sm font-bold text-amber-700">
                {t("상품 요청 완료", "Reward request submitted")}
              </div>
            )}
            {rewardStatus === "REDEEMED" && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 py-3 px-4 text-sm font-bold text-emerald-700">
                {t("상품 수령 완료", "Reward redeemed")}
              </div>
            )}
            {!isInstantReward && lotteryStatus === "NOT_SELECTED" && (
              <div className="rounded-xl bg-slate-100 border border-slate-200 py-3 px-4 text-sm font-bold text-slate-500">
                {t("이번 추첨에서는 미당첨입니다", "Not selected in this draw")}
              </div>
            )}
            {rewardMessage && <div className="text-xs text-slate-500">{rewardMessage}</div>}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h4 className="mb-4 text-sm font-bold text-slate-800">{t("참여 부스 안내", "Participating booths")}</h4>
        {stampBooths.length === 0 ? (
          <div className="text-xs text-slate-400">{t("참여 부스가 없습니다", "No participating booths")}</div>
        ) : (
          <div className="space-y-3">
            {stampBooths.map((booth) => (
              <div key={booth.id} className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{booth.name}</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    booth.isStamped
                      ? "bg-green-100 text-green-700 border border-green-200"
                      : "bg-slate-100 text-slate-500 border border-slate-200"
                  }`}
                >
                  {booth.isStamped ? t("완료", "Completed") : t("대기", "Pending")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h4 className="mb-4 text-sm font-bold text-slate-800">{t("방명록 참여 업체", "Guestbook booths")}</h4>
        {guestbookEntries.length === 0 ? (
          <div className="text-xs text-slate-400">
            {t("방명록 참여 업체가 없습니다.", "No guestbook booth entries.")}
          </div>
        ) : (
          <div className="space-y-3">
            {guestbookEntries.map((entry, index) => (
              <div key={`${entry.vendorName}-${index}`} className="text-sm text-slate-700 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                <span className="font-bold text-slate-900">{entry.vendorName}</span>
                {entry.message && <div className="mt-1 text-slate-500">{entry.message}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};