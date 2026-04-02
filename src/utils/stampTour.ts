export type StampTourCompletionRule = {
  type?: "COUNT" | "ALL";
  requiredCount?: number;
};

export type StampTourRewardMode = "RANDOM" | "FIXED";

export type StampTourRewardLike = {
  id?: string;
  name?: string;
  totalQty?: number;
  remainingQty?: number;
  weight?: number;
  order?: number;
  isFallback?: boolean;
};

const toSafeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

export const getStampMissionTargetCount = (
  completionRule: StampTourCompletionRule | null | undefined,
  boothCount: number
) => {
  const safeBoothCount = Math.max(0, Math.floor(boothCount));
  if (safeBoothCount === 0) return 0;

  if (completionRule?.type === "ALL") {
    return safeBoothCount;
  }

  const requestedCount = Number(completionRule?.requiredCount ?? safeBoothCount);
  const safeRequestedCount = Number.isFinite(requestedCount)
    ? Math.max(1, Math.floor(requestedCount))
    : safeBoothCount;

  return Math.min(safeBoothCount, safeRequestedCount);
};

export const normalizeStampTourRewards = <T extends StampTourRewardLike>(
  rewards: T[],
  rewardMode: StampTourRewardMode
) => {
  return rewards.map((reward, index) => {
    const totalQty = toSafeNonNegativeNumber(reward.totalQty);
    const remainingQty = Math.min(totalQty, toSafeNonNegativeNumber(reward.remainingQty ?? totalQty));

    return {
      ...reward,
      name: (reward.name || "").trim(),
      totalQty,
      remainingQty,
      weight: rewardMode === "RANDOM"
        ? Math.max(1, Math.floor(Number(reward.weight ?? 1) || 1))
        : undefined,
      order: rewardMode === "FIXED"
        ? Math.max(1, Math.floor(Number(reward.order ?? index + 1) || index + 1))
        : undefined
    };
  });
};

export const hasValidStampTourRewards = (
  rewards: StampTourRewardLike[],
  rewardMode: StampTourRewardMode
) => {
  if (rewards.length === 0) return false;

  return rewards.every((reward) => {
    const hasName = (reward.name || "").trim().length > 0;
    const totalQty = toSafeNonNegativeNumber(reward.totalQty);
    const remainingQty = toSafeNonNegativeNumber(reward.remainingQty ?? totalQty);

    if (!hasName || totalQty <= 0 || remainingQty > totalQty) {
      return false;
    }

    if (rewardMode === "RANDOM") {
      return Number(reward.weight ?? 1) > 0;
    }

    return Number(reward.order ?? 1) > 0;
  });
};

export const maskStampTourParticipantName = (name: string | null | undefined) => {
  const trimmed = (name || "").trim();
  if (!trimmed) return "이름 비공개";

  const chars = Array.from(trimmed);
  if (chars.length === 1) return `${chars[0]}*`;
  if (chars.length === 2) return `${chars[0]}*`;

  return chars.map((char, index) => {
    if (index === 0 || index === chars.length - 1) return char;
    return "*";
  }).join("");
};
