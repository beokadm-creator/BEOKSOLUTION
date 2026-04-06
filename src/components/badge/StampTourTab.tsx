import React from "react";
import { Gift } from "lucide-react";
import type {
  StampTourConfig,
  StampProgress,
  StampBooth,
  GuestbookEntry,
} from "./useStampTour";

type StampTourTabProps = {
  stampConfig: StampTourConfig | null;
  stampBooths: StampBooth[];
  stampBoothCandidates: Array<{ id: string; name: string }>;
  myStamps: string[];
  stampProgress: StampProgress;
  guestbookEntries: GuestbookEntry[];
  requiredCount: number;
  isCompleted: boolean;
  rewardStatus: "NONE" | "REQUESTED" | "REDEEMED";
  lotteryStatus: "PENDING" | "SELECTED" | "NOT_SELECTED" | undefined;
  isInstantReward: boolean;
  canParticipantDraw: boolean;
  missedLotteryCutoff: boolean;
  rewardRequesting: boolean;
  rewardMessage: string;
  onRewardRequest: () => void;
  badgeLang: "ko" | "en";
  t: (ko: string, en: string) => string;
};

const StampTourTab: React.FC<StampTourTabProps> = ({
  stampConfig,
  stampBooths,
  stampBoothCandidates,
  myStamps,
  stampProgress,
  guestbookEntries,
  requiredCount,
  isCompleted,
  rewardStatus,
  lotteryStatus,
  isInstantReward,
  canParticipantDraw,
  missedLotteryCutoff,
  rewardRequesting,
  rewardMessage,
  onRewardRequest,
  badgeLang,
  t,
}) => {
  if (!stampConfig?.enabled) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-10 px-4 text-center">
        <Gift className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-bold text-gray-800 mb-1">
          {t("스탬프 투어 미운영", "Stamp tour unavailable")}
        </p>
        <p className="text-xs text-gray-500">
          {t(
            "이 행사에서는 스탬프 투어가 열려 있지 않습니다.",
            "Stamp tour is not active for this event."
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stamp tour progress overview */}
      <div className="bg-[#f0f5fa] rounded-2xl border border-[#c3daee] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-black text-[#003366]">
              {t("스탬프 투어 진행", "Stamp tour progress")}
            </p>
            <p className="text-xs text-[#24669e]">
              {t(
                "참여 부스를 방문해 스탬프를 모아 주세요.",
                "Visit participating booths and collect stamps."
              )}
            </p>
          </div>
          <div className="rounded-full bg-white px-3 py-1 text-sm font-black text-[#003366] shadow-sm">
            {myStamps.length} / {requiredCount || stampBoothCandidates.length}
          </div>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-[#c3daee]">
          <div
            className="h-3 rounded-full bg-[#003366] transition-all duration-700"
            style={{
              width: `${Math.min(100, requiredCount > 0 ? (myStamps.length / requiredCount) * 100 : 0)}%`,
            }}
          />
        </div>

        {/* Completion / reward status */}
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-[#003366]">
            {isCompleted
              ? stampConfig.completionMessage ||
                t("스탬프 투어를 완료했습니다.", "Stamp tour completed.")
              : t(
                  `${myStamps.length}개의 스탬프를 모았습니다.`,
                  `${myStamps.length} stamps collected.`
                )}
          </p>

          {isCompleted && rewardStatus === "NONE" && canParticipantDraw && (
            <button
              type="button"
              onClick={onRewardRequest}
              disabled={rewardRequesting}
              className="w-full rounded-xl bg-[#003366] py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {rewardRequesting
                ? t("처리 중...", "Processing...")
                : t("상품 요청", "Request reward")}
            </button>
          )}

          {isCompleted &&
            rewardStatus === "NONE" &&
            !canParticipantDraw &&
            isInstantReward && (
              <div className="rounded-xl bg-sky-100 py-2 text-sm font-semibold text-sky-700">
                {t("관리자 추첨 대기 중", "Waiting for admin draw")}
              </div>
            )}

          {!isInstantReward && lotteryStatus === "PENDING" && (
            <div className="rounded-xl bg-sky-100 py-2 text-sm font-semibold text-sky-700">
              {t("예약 추첨 대기 중", "Scheduled draw pending")}
            </div>
          )}

          {!isInstantReward &&
            lotteryStatus === "PENDING" &&
            stampConfig.lotteryScheduledAt && (
              <div className="text-xs text-[#24669e]">
                {t("추첨 예정", "Scheduled draw")}:{" "}
                {stampConfig.lotteryScheduledAt
                  .toDate()
                  .toLocaleString(badgeLang === "ko" ? "ko-KR" : "en-US")}
              </div>
            )}

          {missedLotteryCutoff && (
            <div className="rounded-xl bg-slate-100 py-2 text-sm font-semibold text-slate-600">
              {t(
                "예약 추첨 마감 이후 완료되어 이번 추첨 대상에서 제외되었습니다.",
                "Completed after the draw cutoff, so excluded from this round."
              )}
            </div>
          )}

          {rewardStatus === "REQUESTED" && (
            <div className="rounded-xl bg-amber-100 py-2 text-sm font-semibold text-amber-700">
              {stampProgress.rewardName
                ? t(
                    `${stampProgress.rewardName} 상품 요청이 접수되었습니다.`,
                    `${stampProgress.rewardName} request received.`
                  )
                : t("상품 요청 완료", "Reward request submitted")}
            </div>
          )}

          {rewardStatus === "REDEEMED" && (
            <div className="rounded-xl bg-green-50 py-2 text-sm font-semibold text-green-700">
              {t("상품 수령 완료", "Reward redeemed")}
            </div>
          )}

          {!isInstantReward && lotteryStatus === "NOT_SELECTED" && (
            <div className="rounded-xl bg-slate-100 py-2 text-sm font-semibold text-slate-600">
              {t(
                "이번 추첨에서는 미당첨입니다.",
                "Not selected in this draw."
              )}
            </div>
          )}

          {rewardMessage && (
            <div className="text-xs text-[#24669e]">{rewardMessage}</div>
          )}
        </div>
      </div>

      {/* Participating booths */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <h4 className="mb-3 text-sm font-bold text-slate-800">
          {t("참여 부스 안내", "Participating booths")}
        </h4>
        {stampBooths.length === 0 ? (
          <div className="text-xs text-slate-400">
            {t("참여 부스가 없습니다.", "No participating booths.")}
          </div>
        ) : (
          <div className="space-y-2">
            {stampBooths.map((booth) => (
              <div
                key={booth.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-medium text-slate-700">
                  {booth.name}
                </span>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${booth.isStamped ? "bg-[#f0f5fa] text-[#003366]" : "bg-slate-100 text-slate-500"}`}
                >
                  {booth.isStamped
                    ? t("스탬프 완료", "Stamped")
                    : t("미완료", "Pending")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Guestbook entries */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <h4 className="mb-3 text-sm font-bold text-slate-800">
          {t("방명록 참여 업체", "Guestbook booths")}
        </h4>
        {guestbookEntries.length === 0 ? (
          <div className="text-xs text-slate-400">
            {t(
              "방명록 참여 업체가 없습니다.",
              "No guestbook booth entries."
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {guestbookEntries.map((entry, index) => (
              <div
                key={`${entry.vendorName}-${index}`}
                className="text-sm text-slate-700"
              >
                <span className="font-medium">{entry.vendorName}</span>
                {entry.message && (
                  <span className="text-xs text-slate-500">
                    {" "}
                    - {entry.message}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StampTourTab;
