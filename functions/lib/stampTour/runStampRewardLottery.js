"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runStampRewardLottery = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const shared_1 = require("./shared");
const shuffle = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};
const getSelectableRewards = (rewards) => {
    const primary = rewards.filter((reward) => reward.remainingQty > 0
        && (reward.name.length > 0 || (reward.label || "").length > 0)
        && !reward.isFallback
        && !(0, shared_1.isRewardDrawCompleted)(reward));
    const fallback = rewards.filter((reward) => reward.remainingQty > 0
        && (reward.name.length > 0 || (reward.label || "").length > 0)
        && reward.isFallback
        && !(0, shared_1.isRewardDrawCompleted)(reward));
    return primary.length > 0 ? primary : fallback;
};
const sanitizeDrawCounts = (requested, rewards) => {
    const rewardMap = new Map(rewards.map((reward) => [reward.id, reward]));
    return Object.entries(requested || {}).reduce((acc, [rewardId, rawCount]) => {
        const reward = rewardMap.get(rewardId);
        if (!reward)
            return acc;
        const safeCount = Math.max(0, Math.floor(Number(rawCount) || 0));
        if (safeCount <= 0)
            return acc;
        acc[rewardId] = Math.min(safeCount, reward.remainingQty || 0);
        return acc;
    }, {});
};
const buildRewardSlots = (rewards, drawAllRemaining, drawCountsByRewardId) => {
    if (drawAllRemaining) {
        return rewards.flatMap((reward) => Array.from({ length: Math.max(0, reward.remainingQty || 0) }, () => reward));
    }
    return rewards.flatMap((reward) => Array.from({ length: Math.max(0, drawCountsByRewardId[reward.id] || 0) }, () => reward));
};
exports.runStampRewardLottery = functions
    .runWith({ ingressSettings: "ALLOW_ALL" })
    .https.onCall(async (data, context) => {
    const { confId, drawAllRemaining = false, drawCountsByRewardId } = (data || {});
    if (!confId) {
        throw new functions.https.HttpsError("invalid-argument", "confId is required.");
    }
    const db = admin.firestore();
    const adminActor = await (0, shared_1.assertStampTourAdmin)(db, confId, context.auth);
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
    const config = configSnap.data();
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
    const completionRule = config.completionRule || { type: "COUNT", requiredCount: 5 };
    const requiredCount = (0, shared_1.getRequiredCount)(completionRule, sponsorsSnap.size);
    if (requiredCount === 0) {
        throw new functions.https.HttpsError("failed-precondition", "No eligible booths configured.");
    }
    const stampCounts = new Map();
    stampsSnap.docs.forEach((docSnap) => {
        const stamp = docSnap.data();
        if (!stamp.userId || !stamp.vendorId)
            return;
        const current = stampCounts.get(stamp.userId) || new Set();
        current.add(stamp.vendorId);
        stampCounts.set(stamp.userId, current);
    });
    const progressMap = new Map();
    progressSnap.docs.forEach((docSnap) => {
        progressMap.set(docSnap.id, docSnap.data());
    });
    const eligibleEntries = Array.from(stampCounts.entries())
        .filter(([, vendorIds]) => vendorIds.size >= requiredCount)
        .map(([userId]) => ({ userId, progress: progressMap.get(userId) }))
        .filter(({ progress }) => (progress === null || progress === void 0 ? void 0 : progress.rewardStatus) !== "REQUESTED"
        && (progress === null || progress === void 0 ? void 0 : progress.rewardStatus) !== "REDEEMED"
        && !(progress === null || progress === void 0 ? void 0 : progress.lotteryExecutedAt)
        && !!(progress === null || progress === void 0 ? void 0 : progress.completedAt)
        && progress.completedAt.toMillis() <= config.lotteryScheduledAt.toMillis());
    if (eligibleEntries.length === 0) {
        throw new functions.https.HttpsError("failed-precondition", "No eligible participants are waiting for lottery.");
    }
    const normalizedRewards = (0, shared_1.normalizeRewards)(Array.isArray(config.rewards) ? config.rewards : [], config.rewardMode === "FIXED" ? "FIXED" : "RANDOM");
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
    const selectedParticipants = [];
    winners.forEach((entry, index) => {
        var _a, _b, _c, _d, _e;
        const selectedReward = rewardSlots[index];
        const rewardIndex = mutableRewards.findIndex((reward) => reward.id === selectedReward.id);
        if (rewardIndex >= 0) {
            mutableRewards[rewardIndex].remainingQty = Math.max(0, (mutableRewards[rewardIndex].remainingQty || 0) - 1);
            mutableRewards[rewardIndex].drawCompletedAt = executedAt;
        }
        selectedParticipants.push({
            userId: entry.userId,
            userName: ((_a = entry.progress) === null || _a === void 0 ? void 0 : _a.userName) || null,
            userOrg: ((_b = entry.progress) === null || _b === void 0 ? void 0 : _b.userOrg) || null,
            rewardName: selectedReward.name,
            rewardLabel: selectedReward.label || (0, shared_1.getRewardDisplayLabel)(selectedReward)
        });
        batch.set(db.doc(`conferences/${confId}/stamp_tour_progress/${entry.userId}`), {
            userId: entry.userId,
            conferenceId: confId,
            userName: ((_c = entry.progress) === null || _c === void 0 ? void 0 : _c.userName) || null,
            userOrg: ((_d = entry.progress) === null || _d === void 0 ? void 0 : _d.userOrg) || null,
            isCompleted: true,
            completedAt: ((_e = entry.progress) === null || _e === void 0 ? void 0 : _e.completedAt) || admin.firestore.Timestamp.now(),
            rewardId: selectedReward.id,
            rewardName: selectedReward.name,
            rewardLabel: selectedReward.label || null,
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
            var _a, _b, _c;
            batch.set(db.doc(`conferences/${confId}/stamp_tour_progress/${entry.userId}`), {
                userId: entry.userId,
                conferenceId: confId,
                userName: ((_a = entry.progress) === null || _a === void 0 ? void 0 : _a.userName) || null,
                userOrg: ((_b = entry.progress) === null || _b === void 0 ? void 0 : _b.userOrg) || null,
                isCompleted: true,
                completedAt: ((_c = entry.progress) === null || _c === void 0 ? void 0 : _c.completedAt) || admin.firestore.Timestamp.now(),
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
//# sourceMappingURL=runStampRewardLottery.js.map