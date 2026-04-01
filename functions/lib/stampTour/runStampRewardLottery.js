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
        const temp = copy[i];
        copy[i] = copy[j];
        copy[j] = temp;
    }
    return copy;
};
exports.runStampRewardLottery = functions
    .runWith({ ingressSettings: "ALLOW_ALL" })
    .https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e, _f;
    const { confId } = data;
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
    const completionRule = config.completionRule || { type: "COUNT", requiredCount: 5 };
    const boothCount = sponsorsSnap.size;
    const requiredCount = (0, shared_1.getRequiredCount)(completionRule, boothCount);
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
        .map(([userId]) => ({
        userId,
        progress: progressMap.get(userId)
    }))
        .filter(({ progress }) => (progress === null || progress === void 0 ? void 0 : progress.rewardStatus) !== "REQUESTED"
        && (progress === null || progress === void 0 ? void 0 : progress.rewardStatus) !== "REDEEMED"
        && !(progress === null || progress === void 0 ? void 0 : progress.lotteryExecutedAt)
        && !!(progress === null || progress === void 0 ? void 0 : progress.completedAt)
        && progress.completedAt.toMillis() <= lotteryScheduledAt.toMillis());
    const { mode, rewards, selectableRewards } = (0, shared_1.resolveSelectableRewards)(config);
    if (eligibleEntries.length === 0) {
        throw new functions.https.HttpsError("failed-precondition", "No eligible participants are waiting for lottery.");
    }
    if (selectableRewards.length === 0) {
        throw new functions.https.HttpsError("failed-precondition", config.soldOutMessage || "No rewards remain.");
    }
    const shuffledEligible = shuffle(eligibleEntries);
    const mutableRewards = rewards.map((reward) => ({ ...reward }));
    const updates = [];
    for (const entry of shuffledEligible) {
        const currentlySelectable = mutableRewards.filter((reward) => reward.remainingQty > 0 && reward.name.length > 0 && !reward.isFallback);
        const currentFallbacks = mutableRewards.filter((reward) => reward.remainingQty > 0 && reward.name.length > 0 && reward.isFallback);
        const rewardPool = currentlySelectable.length > 0 ? currentlySelectable : currentFallbacks;
        if (rewardPool.length === 0) {
            updates.push({
                userId: entry.userId,
                rewardStatus: "NONE",
                lotteryStatus: "NOT_SELECTED",
                userName: ((_a = entry.progress) === null || _a === void 0 ? void 0 : _a.userName) || null,
                userOrg: ((_b = entry.progress) === null || _b === void 0 ? void 0 : _b.userOrg) || null,
                completedAt: (_c = entry.progress) === null || _c === void 0 ? void 0 : _c.completedAt
            });
            continue;
        }
        const selectedReward = (0, shared_1.selectReward)(rewardPool, mode);
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
            userName: ((_d = entry.progress) === null || _d === void 0 ? void 0 : _d.userName) || null,
            userOrg: ((_e = entry.progress) === null || _e === void 0 ? void 0 : _e.userOrg) || null,
            completedAt: (_f = entry.progress) === null || _f === void 0 ? void 0 : _f.completedAt
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
//# sourceMappingURL=runStampRewardLottery.js.map