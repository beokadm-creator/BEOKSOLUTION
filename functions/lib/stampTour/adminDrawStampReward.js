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
exports.adminDrawStampReward = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const shared_1 = require("./shared");
exports.adminDrawStampReward = functions
    .runWith({ ingressSettings: "ALLOW_ALL" })
    .https.onCall(async (data, context) => {
    const { confId, userId, userName, userOrg } = data;
    if (!confId || !userId) {
        throw new functions.https.HttpsError("invalid-argument", "confId and userId are required.");
    }
    const db = admin.firestore();
    const adminActor = await (0, shared_1.assertStampTourAdmin)(db, confId, context.auth);
    const configRef = db.doc(`conferences/${confId}/settings/stamp_tour`);
    const progressRef = db.doc(`conferences/${confId}/stamp_tour_progress/${userId}`);
    const stampsQuery = db.collection(`conferences/${confId}/stamps`).where("userId", "==", userId);
    const sponsorsQuery = db.collection(`conferences/${confId}/sponsors`).where("isStampTourParticipant", "==", true);
    const [stampsSnap, sponsorsSnap] = await Promise.all([stampsQuery.get(), sponsorsQuery.get()]);
    const stampedVendorIds = new Set(stampsSnap.docs.map(doc => { var _a; return (_a = doc.data()) === null || _a === void 0 ? void 0 : _a.vendorId; }).filter(Boolean));
    const boothCandidates = sponsorsSnap.docs.map(doc => {
        const sponsor = doc.data();
        return sponsor.vendorId || doc.id;
    });
    return db.runTransaction(async (tx) => {
        var _a;
        const [configSnap, progressSnap] = await Promise.all([
            tx.get(configRef),
            tx.get(progressRef)
        ]);
        if (!configSnap.exists) {
            throw new functions.https.HttpsError("failed-precondition", "Stamp tour config not found.");
        }
        const config = configSnap.data();
        if (config.enabled !== true) {
            throw new functions.https.HttpsError("failed-precondition", "Stamp tour is disabled.");
        }
        if (config.endAt && config.endAt.toMillis() < Date.now()) {
            throw new functions.https.HttpsError("failed-precondition", "Stamp tour has ended.");
        }
        if (config.rewardFulfillmentMode === "LOTTERY") {
            throw new functions.https.HttpsError("failed-precondition", "예약 추첨형은 전체 완료자를 대상으로 일괄 추첨해야 합니다.");
        }
        const completionRule = config.completionRule || { type: "COUNT", requiredCount: 5 };
        const requiredCount = (0, shared_1.getRequiredCount)(completionRule, boothCandidates.length);
        const completed = requiredCount > 0 && stampedVendorIds.size >= requiredCount;
        if (!completed) {
            throw new functions.https.HttpsError("failed-precondition", "Participant has not completed the mission yet.");
        }
        const progress = progressSnap.exists ? progressSnap.data() : {};
        if (progress.rewardStatus === "REQUESTED" || progress.rewardStatus === "REDEEMED") {
            throw new functions.https.HttpsError("failed-precondition", "Reward has already been drawn.");
        }
        const { mode, rewards, selectableRewards } = (0, shared_1.resolveSelectableRewards)(config);
        if (selectableRewards.length === 0) {
            throw new functions.https.HttpsError("failed-precondition", config.soldOutMessage || "No rewards remain.");
        }
        const selected = (0, shared_1.selectReward)(selectableRewards, mode);
        const updatedRewards = rewards.map(reward => reward.id === selected.id
            ? { ...reward, remainingQty: Math.max(0, (reward.remainingQty || 0) - 1) }
            : reward);
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
            completedAt: progressSnap.exists ? ((_a = progressSnap.data()) === null || _a === void 0 ? void 0 : _a.completedAt) || admin.firestore.Timestamp.now() : admin.firestore.Timestamp.now()
        }, { merge: true });
        return {
            rewardId: selected.id,
            rewardName: selected.name,
            rewardStatus: "REQUESTED"
        };
    });
});
//# sourceMappingURL=adminDrawStampReward.js.map