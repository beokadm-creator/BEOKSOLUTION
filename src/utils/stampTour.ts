export const defaultStampTourConfig = {
    enabled: false,
    completionRule: {
        type: 'COUNT' as const,
        requiredCount: 5
    },
    boothOrderMode: 'SPONSOR_ORDER' as const,
    customBoothOrder: [],
    rewardMode: 'RANDOM' as const,
    drawMode: 'PARTICIPANT' as const,
    rewardFulfillmentMode: 'INSTANT' as const,
    rewards: [],
    soldOutMessage: '모든 경품이 소진되었습니다.',
    completionMessage: '스탬프 투어를 완료했습니다!'
};

export type StampTourCompletionRule = {
  type?: "COUNT" | "ALL";
  requiredCount?: number;
};

export type StampTourRewardMode = "RANDOM" | "FIXED";

export type StampTourRewardLike = {
  id?: string;
  name?: string;
  label?: string;
  totalQty?: number;
  remainingQty?: number;
  weight?: number;
  order?: number;
  isFallback?: boolean;
  drawCompletedAt?: unknown;
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
      label: (reward.label || "").trim(),
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

export const isStampTourRewardDrawCompleted = (reward: StampTourRewardLike) => (
  Boolean(reward.drawCompletedAt)
);

export const getStampTourRewardTitle = (reward: Pick<StampTourRewardLike, "name" | "label">) => {
  const label = (reward.label || "").trim();
  const name = (reward.name || "").trim();

  if (label && name) return `${label} - ${name}`;
  return label || name;
};

export const getSelectableStampTourRewards = <T extends StampTourRewardLike>(
  rewards: T[],
  options?: {
    excludeCompletedDraws?: boolean;
  }
) => {
  const canUseReward = (reward: T) => (
    reward.remainingQty !== undefined
    && reward.remainingQty > 0
    && (((reward.name || "").trim().length > 0) || ((reward.label || "").trim().length > 0))
    && (!options?.excludeCompletedDraws || !isStampTourRewardDrawCompleted(reward))
  );

  const primary = rewards.filter((reward) => canUseReward(reward) && !reward.isFallback);
  const fallback = rewards.filter((reward) => canUseReward(reward) && reward.isFallback);
  return primary.length > 0 ? primary : fallback;
};

export const hasValidStampTourRewards = (
  rewards: StampTourRewardLike[],
  rewardMode: StampTourRewardMode
) => {
  if (rewards.length === 0) return false;

  return rewards.every((reward) => {
    const hasName = (reward.name || "").trim().length > 0;
    const hasLabel = (reward.label || "").trim().length > 0;
    const totalQty = toSafeNonNegativeNumber(reward.totalQty);
    const remainingQty = toSafeNonNegativeNumber(reward.remainingQty ?? totalQty);

    if ((!hasName && !hasLabel) || totalQty <= 0 || remainingQty > totalQty) {
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
  if (!trimmed) return "Name unavailable";

  const chars = Array.from(trimmed);
  if (chars.length === 1) return `${chars[0]}*`;
  if (chars.length === 2) return `${chars[0]}*`;

  return chars.map((char, index) => {
    if (index === 0 || index === chars.length - 1) return char;
    return "*";
  }).join("");
};
