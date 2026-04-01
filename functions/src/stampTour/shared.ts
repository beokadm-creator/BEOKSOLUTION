import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

export type StampReward = {
    id: string;
    name: string;
    remainingQty: number;
    totalQty?: number;
    weight?: number;
    order?: number;
    isFallback?: boolean;
};

export type CompletionRule = {
    type: "COUNT" | "ALL";
    requiredCount?: number;
};

export type StampTourConfig = {
    enabled?: boolean;
    endAt?: admin.firestore.Timestamp;
    completionRule?: CompletionRule;
    rewardMode?: "RANDOM" | "FIXED";
    drawMode?: "PARTICIPANT" | "ADMIN" | "BOTH";
    rewardFulfillmentMode?: "INSTANT" | "LOTTERY";
    lotteryScheduledAt?: admin.firestore.Timestamp;
    lotteryExecutedAt?: admin.firestore.Timestamp;
    rewards?: StampReward[];
    soldOutMessage?: string;
};

export const getRequiredCount = (rule: CompletionRule | undefined, boothCount: number) => {
    const safeBoothCount = Math.max(0, Math.floor(boothCount));
    if (safeBoothCount === 0) return 0;

    if (rule?.type === "ALL") {
        return safeBoothCount;
    }

    const requestedCount = Number(rule?.requiredCount ?? safeBoothCount);
    const safeRequestedCount = Number.isFinite(requestedCount)
        ? Math.max(1, Math.floor(requestedCount))
        : safeBoothCount;

    return Math.min(safeBoothCount, safeRequestedCount);
};

export const normalizeRewards = (rewards: StampReward[], mode: "RANDOM" | "FIXED") => rewards.map((reward, index) => {
    const totalQty = Math.max(0, Math.floor(Number(reward.totalQty ?? reward.remainingQty ?? 0) || 0));
    const remainingQty = Math.min(totalQty, Math.max(0, Math.floor(Number(reward.remainingQty ?? totalQty) || 0)));

    return {
        ...reward,
        name: (reward.name || "").trim(),
        totalQty,
        remainingQty,
        weight: mode === "RANDOM" ? Math.max(1, Math.floor(Number(reward.weight ?? 1) || 1)) : undefined,
        order: mode === "FIXED" ? Math.max(1, Math.floor(Number(reward.order ?? index + 1) || index + 1)) : undefined
    };
});

export const selectReward = (rewards: StampReward[], mode: "RANDOM" | "FIXED") => {
    if (mode === "RANDOM") {
        const totalWeight = rewards.reduce((sum, reward) => sum + Math.max(1, reward.weight || 1), 0);
        let roll = Math.random() * totalWeight;
        for (const reward of rewards) {
            roll -= Math.max(1, reward.weight || 1);
            if (roll <= 0) {
                return reward;
            }
        }
        return rewards[rewards.length - 1];
    }

    return rewards.slice().sort((a, b) => (a.order || 0) - (b.order || 0))[0];
};

export const resolveSelectableRewards = (config: StampTourConfig) => {
    const mode: "RANDOM" | "FIXED" = config.rewardMode === "FIXED" ? "FIXED" : "RANDOM";
    const rewards = normalizeRewards(Array.isArray(config.rewards) ? config.rewards : [], mode);
    const primaryRewards = rewards.filter(
        reward => reward.remainingQty > 0 && reward.name.length > 0 && !reward.isFallback
    );
    const fallbackRewards = rewards.filter(
        reward => reward.remainingQty > 0 && reward.name.length > 0 && reward.isFallback
    );

    return {
        mode,
        rewards,
        selectableRewards: primaryRewards.length > 0 ? primaryRewards : fallbackRewards
    };
};

export const assertStampTourAdmin = async (
    db: admin.firestore.Firestore,
    confId: string,
    auth: functions.https.CallableContext["auth"]
) => {
    if (!auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }

    const email = auth.token.email;
    const isSuper = auth.token.admin === true || auth.token.super === true;
    if (isSuper) {
        return {
            uid: auth.uid,
            email: email || null,
            role: "SUPER_ADMIN"
        };
    }

    if (!email) {
        throw new functions.https.HttpsError("permission-denied", "Admin email not found.");
    }

    const adminSnap = await db.doc(`conferences/${confId}/admins/${email}`).get();
    if (!adminSnap.exists) {
        throw new functions.https.HttpsError("permission-denied", "Conference admin access denied.");
    }

    return {
        uid: auth.uid,
        email,
        role: "CONFERENCE_ADMIN"
    };
};
