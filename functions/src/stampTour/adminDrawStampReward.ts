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

export const adminDrawStampReward = functions
    .runWith({ ingressSettings: "ALLOW_ALL" })
    .https.onCall(async (data, context) => {
        const { confId, userId, userName, userOrg } = data as {
            confId?: string;
            userId?: string;
            userName?: string;
            userOrg?: string;
        };

        if (!confId || !userId) {
            throw new functions.https.HttpsError("invalid-argument", "confId and userId are required.");
        }

        const db = admin.firestore();
        const adminActor = await assertStampTourAdmin(db, confId, context.auth);

        const configRef = db.doc(`conferences/${confId}/settings/stamp_tour`);
        const progressRef = db.doc(`conferences/${confId}/stamp_tour_progress/${userId}`);
        const stampsQuery = db.collection(`conferences/${confId}/stamps`).where("userId", "==", userId);
        const sponsorsQuery = db.collection(`conferences/${confId}/sponsors`).where("isStampTourParticipant", "==", true);

        const [stampsSnap, sponsorsSnap] = await Promise.all([stampsQuery.get(), sponsorsQuery.get()]);
        const stampedVendorIds = new Set(
            stampsSnap.docs.map(doc => doc.data()?.vendorId).filter(Boolean) as string[]
        );
        const boothCandidates = sponsorsSnap.docs.map(doc => {
            const sponsor = doc.data() as { vendorId?: string };
            return sponsor.vendorId || doc.id;
        });

        return db.runTransaction(async (tx) => {
            const [configSnap, progressSnap] = await Promise.all([
                tx.get(configRef),
                tx.get(progressRef)
            ]);

            if (!configSnap.exists) {
                throw new functions.https.HttpsError("failed-precondition", "Stamp tour config not found.");
            }

            const config = configSnap.data() as StampTourConfig;
            if (config.enabled !== true) {
                throw new functions.https.HttpsError("failed-precondition", "Stamp tour is disabled.");
            }

            if (config.endAt && config.endAt.toMillis() < Date.now()) {
                throw new functions.https.HttpsError("failed-precondition", "Stamp tour has ended.");
            }

            if (config.rewardFulfillmentMode === "LOTTERY") {
                throw new functions.https.HttpsError(
                    "failed-precondition",
                    "예약 추첨형은 전체 완료자를 대상으로 일괄 추첨해야 합니다."
                );
            }

            const completionRule: CompletionRule = config.completionRule || { type: "COUNT", requiredCount: 5 };
            const requiredCount = getRequiredCount(completionRule, boothCandidates.length);
            const completed = requiredCount > 0 && stampedVendorIds.size >= requiredCount;
            if (!completed) {
                throw new functions.https.HttpsError("failed-precondition", "Participant has not completed the mission yet.");
            }

            const progress = progressSnap.exists ? progressSnap.data() as { rewardStatus?: string; userName?: string; userOrg?: string } : {};
            if (progress.rewardStatus === "REQUESTED" || progress.rewardStatus === "REDEEMED") {
                throw new functions.https.HttpsError("failed-precondition", "Reward has already been drawn.");
            }

            const { mode, rewards, selectableRewards } = resolveSelectableRewards(config);
            if (selectableRewards.length === 0) {
                throw new functions.https.HttpsError(
                    "failed-precondition",
                    config.soldOutMessage || "No rewards remain."
                );
            }

            const selected = selectReward(selectableRewards, mode);
            const updatedRewards = rewards.map(reward => reward.id === selected.id
                ? { ...reward, remainingQty: Math.max(0, (reward.remainingQty || 0) - 1) }
                : reward
            );

            tx.set(configRef, { rewards: updatedRewards }, { merge: true });
            tx.set(progressRef, {
                userId,
                conferenceId: confId,
                rewardId: selected.id,
                rewardName: selected.name,
                rewardStatus: "REQUESTED",
                lotteryStatus: "SELECTED",
                requestedAt: admin.firestore.Timestamp.now(),
                requestedBy: adminActor.email || adminActor.uid,
                drawModeUsed: "ADMIN",
                userName: userName || progress.userName || null,
                userOrg: userOrg || progress.userOrg || null,
                isCompleted: true,
                completedAt: progressSnap.exists ? progressSnap.data()?.completedAt || admin.firestore.Timestamp.now() : admin.firestore.Timestamp.now()
            }, { merge: true });

            return {
                rewardId: selected.id,
                rewardName: selected.name,
                rewardStatus: "REQUESTED"
            };
        });
    });
