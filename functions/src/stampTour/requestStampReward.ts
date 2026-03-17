import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

type StampReward = {
    id: string;
    name: string;
    remainingQty: number;
    weight?: number;
    order?: number;
    isFallback?: boolean;
};

type CompletionRule = {
    type: "COUNT" | "ALL";
    requiredCount?: number;
};

type StampTourConfig = {
    enabled?: boolean;
    endAt?: admin.firestore.Timestamp;
    completionRule?: CompletionRule;
    rewardMode?: "RANDOM" | "FIXED";
    rewards?: StampReward[];
    soldOutMessage?: string;
};

const selectReward = (rewards: StampReward[], mode: "RANDOM" | "FIXED") => {
    if (mode === "RANDOM") {
        const totalWeight = rewards.reduce((sum, r) => sum + (r.weight || 1), 0);
        let roll = Math.random() * totalWeight;
        for (const reward of rewards) {
            roll -= (reward.weight || 1);
            if (roll <= 0) {
                return reward;
            }
        }
        return rewards[rewards.length - 1];
    }

    return rewards.slice().sort((a, b) => (a.order || 0) - (b.order || 0))[0];
};

export const requestStampReward = functions
    .runWith({ ingressSettings: "ALLOW_ALL" })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
        }

        const { confId, userName, userOrg } = data as {
            confId?: string;
            userName?: string;
            userOrg?: string;
        };

        if (!confId) {
            throw new functions.https.HttpsError("invalid-argument", "학술대회 정보가 없습니다.");
        }

        const db = admin.firestore();
        const userId = context.auth.uid;
        const configRef = db.doc(`conferences/${confId}/settings/stamp_tour`);
        const progressRef = db.doc(`conferences/${confId}/stamp_tour_progress/${userId}`);
        const stampsQuery = db.collection(`conferences/${confId}/stamps`).where("userId", "==", userId);
        const sponsorsQuery = db.collection(`conferences/${confId}/sponsors`).where("isStampTourParticipant", "==", true);

        const [stampsSnap, sponsorsSnap] = await Promise.all([stampsQuery.get(), sponsorsQuery.get()]);
        const stampedVendorIds = new Set(
            stampsSnap.docs.map(doc => doc.data()?.vendorId).filter(Boolean) as string[]
        );
        const boothCandidates = sponsorsSnap.docs.map(doc => {
            const data = doc.data() as { vendorId?: string };
            return data.vendorId || doc.id;
        });

        return db.runTransaction(async (tx) => {
            const configSnap = await tx.get(configRef);
            if (!configSnap.exists) {
                throw new functions.https.HttpsError("failed-precondition", "스탬프투어 설정이 없습니다.");
            }

            const config = configSnap.data() as StampTourConfig;
            if (config.enabled !== true) {
                throw new functions.https.HttpsError("failed-precondition", "스탬프투어가 비활성화 상태입니다.");
            }

            if (config.endAt && config.endAt.toMillis() < Date.now()) {
                throw new functions.https.HttpsError("failed-precondition", "스탬프투어가 종료되었습니다.");
            }

            const completionRule: CompletionRule = config.completionRule || { type: "COUNT", requiredCount: 5 };
            const requiredCount = completionRule.type === "ALL"
                ? boothCandidates.length
                : Math.max(1, completionRule.requiredCount || boothCandidates.length);
            const completed = requiredCount > 0 && stampedVendorIds.size >= requiredCount;

            if (!completed) {
                throw new functions.https.HttpsError("failed-precondition", "아직 완료되지 않았습니다.");
            }

            const progressSnap = await tx.get(progressRef);
            const progress = progressSnap.exists ? progressSnap.data() as { rewardStatus?: string } : {};

            if (progress.rewardStatus === "REQUESTED" || progress.rewardStatus === "REDEEMED") {
                throw new functions.https.HttpsError("failed-precondition", "이미 상품 수령 요청이 완료되었습니다.");
            }

            const rewards = Array.isArray(config.rewards) ? config.rewards : [];
            const availableRewards = rewards.filter(r => (r.remainingQty || 0) > 0);
            if (availableRewards.length === 0) {
                throw new functions.https.HttpsError(
                    "failed-precondition",
                    config.soldOutMessage || "상품이 모두 소진되었습니다."
                );
            }

            const mode = config.rewardMode === "FIXED" ? "FIXED" : "RANDOM";
            const selected = selectReward(availableRewards, mode);
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
                requestedAt: admin.firestore.Timestamp.now(),
                userName: userName || null,
                userOrg: userOrg || null,
                isCompleted: true,
                completedAt: admin.firestore.Timestamp.now()
            }, { merge: true });

            return {
                rewardId: selected.id,
                rewardName: selected.name,
                rewardStatus: "REQUESTED"
            };
        });
    });
