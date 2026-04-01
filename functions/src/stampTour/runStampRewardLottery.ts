import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

import {
    assertStampTourAdmin,
    getRequiredCount,
    resolveSelectableRewards,
    selectReward,
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

const shuffle = <T>(items: T[]) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = copy[i];
        copy[i] = copy[j];
        copy[j] = temp;
    }
    return copy;
};

export const runStampRewardLottery = functions
    .runWith({ ingressSettings: "ALLOW_ALL" })
    .https.onCall(async (data, context) => {
        const { confId } = data as { confId?: string };
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

        const lotteryScheduledAt = config.lotteryScheduledAt;
        if (!lotteryScheduledAt) {
            throw new functions.https.HttpsError("failed-precondition", "Lottery schedule is not configured.");
        }

        if (config.lotteryExecutedAt) {
            throw new functions.https.HttpsError("failed-precondition", "Scheduled lottery has already been executed.");
        }

        if (lotteryScheduledAt.toMillis() > Date.now()) {
            throw new functions.https.HttpsError("failed-precondition", "Lottery can only run after the scheduled time.");
        }

        const completionRule: CompletionRule = config.completionRule || { type: "COUNT", requiredCount: 5 };
        const boothCount = sponsorsSnap.size;
        const requiredCount = getRequiredCount(completionRule, boothCount);
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
            .map(([userId]) => ({
                userId,
                progress: progressMap.get(userId)
            }))
            .filter(({ progress }) =>
                progress?.rewardStatus !== "REQUESTED"
                && progress?.rewardStatus !== "REDEEMED"
                && !progress?.lotteryExecutedAt
                && !!progress?.completedAt
                && progress.completedAt.toMillis() <= lotteryScheduledAt.toMillis()
            );

        const { mode, rewards, selectableRewards } = resolveSelectableRewards(config);
        if (eligibleEntries.length === 0) {
            throw new functions.https.HttpsError("failed-precondition", "No eligible participants are waiting for lottery.");
        }

        if (selectableRewards.length === 0) {
            throw new functions.https.HttpsError(
                "failed-precondition",
                config.soldOutMessage || "No rewards remain."
            );
        }

        const shuffledEligible = shuffle(eligibleEntries);
        const mutableRewards = rewards.map((reward) => ({ ...reward }));
        const updates: Array<{
            userId: string;
            rewardId?: string;
            rewardName?: string;
            rewardStatus: "NONE" | "REQUESTED";
            lotteryStatus: "SELECTED" | "NOT_SELECTED";
            userName?: string | null;
            userOrg?: string | null;
            completedAt?: admin.firestore.Timestamp;
        }> = [];

        for (const entry of shuffledEligible) {
            const currentlySelectable = mutableRewards.filter(
                (reward) => reward.remainingQty > 0 && reward.name.length > 0 && !reward.isFallback
            );
            const currentFallbacks = mutableRewards.filter(
                (reward) => reward.remainingQty > 0 && reward.name.length > 0 && reward.isFallback
            );
            const rewardPool = currentlySelectable.length > 0 ? currentlySelectable : currentFallbacks;

            if (rewardPool.length === 0) {
                updates.push({
                    userId: entry.userId,
                    rewardStatus: "NONE",
                    lotteryStatus: "NOT_SELECTED",
                    userName: entry.progress?.userName || null,
                    userOrg: entry.progress?.userOrg || null,
                    completedAt: entry.progress?.completedAt
                });
                continue;
            }

            const selectedReward = selectReward(rewardPool, mode);
            const rewardIndex = mutableRewards.findIndex((reward) => reward.id === selectedReward.id);
            if (rewardIndex >= 0) {
                mutableRewards[rewardIndex] = {
                    ...mutableRewards[rewardIndex],
                    remainingQty: Math.max(0, (mutableRewards[rewardIndex].remainingQty || 0) - 1)
                };
            }

            updates.push({
                userId: entry.userId,
                rewardId: selectedReward.id,
                rewardName: selectedReward.name,
                rewardStatus: "REQUESTED",
                lotteryStatus: "SELECTED",
                userName: entry.progress?.userName || null,
                userOrg: entry.progress?.userOrg || null,
                completedAt: entry.progress?.completedAt
            });
        }

        const batch = db.batch();
        const executedAt = admin.firestore.Timestamp.now();
        batch.set(configRef, {
            rewards: mutableRewards,
            lotteryExecutedAt: executedAt
        }, { merge: true });

        updates.forEach((update) => {
            const progressRef = db.doc(`conferences/${confId}/stamp_tour_progress/${update.userId}`);
            batch.set(progressRef, {
                userId: update.userId,
                conferenceId: confId,
                userName: update.userName || null,
                userOrg: update.userOrg || null,
                isCompleted: true,
                completedAt: update.completedAt || admin.firestore.Timestamp.now(),
                rewardId: update.rewardId || admin.firestore.FieldValue.delete(),
                rewardName: update.rewardName || admin.firestore.FieldValue.delete(),
                rewardStatus: update.rewardStatus,
                lotteryStatus: update.lotteryStatus,
                requestedAt: update.rewardStatus === "REQUESTED" ? executedAt : admin.firestore.FieldValue.delete(),
                requestedBy: adminActor.email || adminActor.uid,
                drawModeUsed: "ADMIN",
                lotteryExecutedAt: executedAt
            }, { merge: true });
        });

        await batch.commit();

        return {
            totalEligible: eligibleEntries.length,
            totalSelected: updates.filter((update) => update.lotteryStatus === "SELECTED").length,
            totalNotSelected: updates.filter((update) => update.lotteryStatus === "NOT_SELECTED").length
        };
    });
