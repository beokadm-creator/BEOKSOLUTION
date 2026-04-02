import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

import {
    assertStampTourAdmin,
    getRequiredCount,
    normalizeRewards,
    StampReward,
    StampTourConfig,
    CompletionRule
} from "./shared";

type StampProgressDoc = {
    userId?: string;
    userName?: string | null;
    userOrg?: string | null;
    rewardStatus?: "NONE" | "REQUESTED" | "REDEEMED";
    lotteryStatus?: "PENDING" | "SELECTED" | "NOT_SELECTED";
    completedAt?: admin.firestore.Timestamp;
    lotteryExecutedAt?: admin.firestore.Timestamp;
};

type CallablePayload = {
    confId?: string;
    drawAllRemaining?: boolean;
    drawCountsByRewardId?: Record<string, number>;
};

const shuffle = <T>(items: T[]) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

const getSelectableRewards = (rewards: StampReward[]) => {
    const primary = rewards.filter((reward) => reward.remainingQty > 0 && reward.name.length > 0 && !reward.isFallback);
    const fallback = rewards.filter((reward) => reward.remainingQty > 0 && reward.name.length > 0 && reward.isFallback);
    return primary.length > 0 ? primary : fallback;
};

const sanitizeDrawCounts = (requested: Record<string, number> | undefined, rewards: StampReward[]) => {
    const rewardMap = new Map(rewards.map((reward) => [reward.id, reward]));
    return Object.entries(requested || {}).reduce<Record<string, number>>((acc, [rewardId, rawCount]) => {
        const reward = rewardMap.get(rewardId);
        if (!reward) return acc;
        const safeCount = Math.max(0, Math.floor(Number(rawCount) || 0));
        if (safeCount <= 0) return acc;
        acc[rewardId] = Math.min(safeCount, reward.remainingQty || 0);
        return acc;
    }, {});
};

const buildRewardSlots = (
    rewards: StampReward[],
    drawAllRemaining: boolean,
    drawCountsByRewardId: Record<string, number>
) => {
    if (drawAllRemaining) {
        return rewards.flatMap((reward) =>
            Array.from({ length: Math.max(0, reward.remainingQty || 0) }, () => reward)
        );
    }

    return rewards.flatMap((reward) =>
        Array.from({ length: Math.max(0, drawCountsByRewardId[reward.id] || 0) }, () => reward)
    );
};

export const runStampRewardLottery = functions
    .runWith({ ingressSettings: "ALLOW_ALL" })
    .https.onCall(async (data, context) => {
        const { confId, drawAllRemaining = false, drawCountsByRewardId } = (data || {}) as CallablePayload;
        if (!confId) {
            throw new functions.https.HttpsError("invalid-argument", "confId is required.");
        }

        const db = admin.firestore();
        const adminActor = await assertStampTourAdmin(db, confId, context.auth);

        const configRef = db.doc(`conferences/${confId}/settings/stamp_tour`);
        const [configSnap, sponsorsSnap, stampsSnap, progressSnap] = await Promise.all([
            configRef.get(),
            db.collection(`conferences/${confId}/sponsors`).where("isStampTourParticipant", "==", true).get(),
            db.collection(`conferences/${confId}/stamps`).get(),
            db.collection(`conferences/${confId}/stamp_tour_progress`).get()
        ]);

        if (!configSnap.exists) {
            throw new functions.https.HttpsError("failed-precondition", "Stamp tour config not found.");
        }

        const config = configSnap.data() as StampTourConfig;
        if (config.enabled !== true) {
            throw new functions.https.HttpsError("failed-precondition", "Stamp tour is disabled.");
        }
        if (config.rewardFulfillmentMode !== "LOTTERY") {
            throw new functions.https.HttpsError("failed-precondition", "This stamp tour is not configured for scheduled lottery.");
        }
        if (!config.lotteryScheduledAt) {
            throw new functions.https.HttpsError("failed-precondition", "Lottery schedule is not configured.");
        }
        if (config.lotteryScheduledAt.toMillis() > Date.now()) {
            throw new functions.https.HttpsError("failed-precondition", "Lottery can only run after the scheduled time.");
        }
        if (drawAllRemaining && config.lotteryExecutedAt) {
            throw new functions.https.HttpsError("failed-precondition", "Scheduled lottery has already been executed.");
        }

        const completionRule: CompletionRule = config.completionRule || { type: "COUNT", requiredCount: 5 };
        const requiredCount = getRequiredCount(completionRule, sponsorsSnap.size);
        if (requiredCount === 0) {
            throw new functions.https.HttpsError("failed-precondition", "No eligible booths configured.");
        }

        const stampCounts = new Map<string, Set<string>>();
        stampsSnap.docs.forEach((docSnap) => {
            const stamp = docSnap.data() as { userId?: string; vendorId?: string };
            if (!stamp.userId || !stamp.vendorId) return;
            const current = stampCounts.get(stamp.userId) || new Set<string>();
            current.add(stamp.vendorId);
            stampCounts.set(stamp.userId, current);
        });

        const progressMap = new Map<string, StampProgressDoc>();
        progressSnap.docs.forEach((docSnap) => {
            progressMap.set(docSnap.id, docSnap.data() as StampProgressDoc);
        });

        const eligibleEntries = Array.from(stampCounts.entries())
            .filter(([, vendorIds]) => vendorIds.size >= requiredCount)
            .map(([userId]) => ({ userId, progress: progressMap.get(userId) }))
            .filter(({ progress }) =>
                progress?.rewardStatus !== "REQUESTED"
                && progress?.rewardStatus !== "REDEEMED"
                && !progress?.lotteryExecutedAt
                && !!progress?.completedAt
                && progress.completedAt.toMillis() <= config.lotteryScheduledAt!.toMillis()
            );

        if (eligibleEntries.length === 0) {
            throw new functions.https.HttpsError("failed-precondition", "No eligible participants are waiting for lottery.");
        }

        const normalizedRewards = normalizeRewards(
            Array.isArray(config.rewards) ? config.rewards : [],
            config.rewardMode === "FIXED" ? "FIXED" : "RANDOM"
        );
        const selectableRewards = getSelectableRewards(normalizedRewards);
        if (selectableRewards.length === 0) {
            throw new functions.https.HttpsError("failed-precondition", config.soldOutMessage || "No rewards remain.");
        }

        const safeDrawCounts = sanitizeDrawCounts(drawCountsByRewardId, selectableRewards);
        const rewardSlots = buildRewardSlots(selectableRewards, drawAllRemaining, safeDrawCounts);
        if (rewardSlots.length === 0) {
            throw new functions.https.HttpsError("invalid-argument", "Select at least one reward slot to draw.");
        }

        const mutableRewards = normalizedRewards.map((reward) => ({ ...reward }));
        const shuffledEligible = shuffle(eligibleEntries);
        const winners = shuffledEligible.slice(0, Math.min(shuffledEligible.length, rewardSlots.length));
        const executedAt = admin.firestore.Timestamp.now();
        const batch = db.batch();
        const selectedParticipants: Array<{ userId: string; userName?: string | null; userOrg?: string | null; rewardName?: string }> = [];

        winners.forEach((entry, index) => {
            const selectedReward = rewardSlots[index];
            const rewardIndex = mutableRewards.findIndex((reward) => reward.id === selectedReward.id);
            if (rewardIndex >= 0) {
                mutableRewards[rewardIndex].remainingQty = Math.max(0, (mutableRewards[rewardIndex].remainingQty || 0) - 1);
            }

            selectedParticipants.push({
                userId: entry.userId,
                userName: entry.progress?.userName || null,
                userOrg: entry.progress?.userOrg || null,
                rewardName: selectedReward.name
            });

            batch.set(db.doc(`conferences/${confId}/stamp_tour_progress/${entry.userId}`), {
                userId: entry.userId,
                conferenceId: confId,
                userName: entry.progress?.userName || null,
                userOrg: entry.progress?.userOrg || null,
                isCompleted: true,
                completedAt: entry.progress?.completedAt || admin.firestore.Timestamp.now(),
                rewardId: selectedReward.id,
                rewardName: selectedReward.name,
                rewardStatus: "REQUESTED",
                lotteryStatus: "SELECTED",
                requestedAt: executedAt,
                requestedBy: adminActor.email || adminActor.uid,
                drawModeUsed: "ADMIN",
                lotteryExecutedAt: drawAllRemaining ? executedAt : admin.firestore.FieldValue.delete()
            }, { merge: true });
        });

        let totalNotSelected = 0;
        if (drawAllRemaining) {
            const nonWinners = shuffledEligible.slice(winners.length);
            totalNotSelected = nonWinners.length;
            nonWinners.forEach((entry) => {
                batch.set(db.doc(`conferences/${confId}/stamp_tour_progress/${entry.userId}`), {
                    userId: entry.userId,
                    conferenceId: confId,
                    userName: entry.progress?.userName || null,
                    userOrg: entry.progress?.userOrg || null,
                    isCompleted: true,
                    completedAt: entry.progress?.completedAt || admin.firestore.Timestamp.now(),
                    rewardStatus: "NONE",
                    lotteryStatus: "NOT_SELECTED",
                    requestedBy: adminActor.email || adminActor.uid,
                    drawModeUsed: "ADMIN",
                    lotteryExecutedAt: executedAt
                }, { merge: true });
            });
        }

        batch.set(configRef, {
            rewards: mutableRewards,
            ...(drawAllRemaining ? { lotteryExecutedAt: executedAt } : {})
        }, { merge: true });

        await batch.commit();

        return {
            totalEligible: eligibleEntries.length,
            totalSelected: selectedParticipants.length,
            totalNotSelected,
            selectedParticipants,
            drawMode: drawAllRemaining ? "ALL" : "PARTIAL"
        };
    });
