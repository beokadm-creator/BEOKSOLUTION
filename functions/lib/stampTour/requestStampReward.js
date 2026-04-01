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
exports.requestStampReward = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const shared_1 = require("./shared");
exports.requestStampReward = functions
    .runWith({ ingressSettings: "ALLOW_ALL" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "濡쒓렇?몄씠 ?꾩슂?⑸땲??");
    }
    const { confId, userName, userOrg } = data;
    if (!confId) {
        throw new functions.https.HttpsError("invalid-argument", "?숈닠????뺣낫媛 ?놁뒿?덈떎.");
    }
    const db = admin.firestore();
    const userId = context.auth.uid;
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
        const configSnap = await tx.get(configRef);
        if (!configSnap.exists) {
            throw new functions.https.HttpsError("failed-precondition", "?ㅽ꺃?꾪닾???ㅼ젙???놁뒿?덈떎.");
        }
        const config = configSnap.data();
        if (config.enabled !== true) {
            throw new functions.https.HttpsError("failed-precondition", "?ㅽ꺃?꾪닾?닿? 鍮꾪솢?깊솕 ?곹깭?낅땲??");
        }
        if (config.endAt && config.endAt.toMillis() < Date.now()) {
            throw new functions.https.HttpsError("failed-precondition", "?ㅽ꺃?꾪닾?닿? 醫낅즺?섏뿀?듬땲??");
        }
        if (config.drawMode === "ADMIN") {
            throw new functions.https.HttpsError("failed-precondition", "관리자 추첨 모드입니다. 운영 화면에서 추첨을 진행해 주세요.");
        }
        if (config.rewardFulfillmentMode === "LOTTERY") {
            throw new functions.https.HttpsError("failed-precondition", "예약 추첨형 미션입니다. 지정된 추첨 시간 이후 관리자 추첨 결과를 확인해 주세요.");
        }
        const completionRule = config.completionRule || { type: "COUNT", requiredCount: 5 };
        const requiredCount = (0, shared_1.getRequiredCount)(completionRule, boothCandidates.length);
        const completed = requiredCount > 0 && stampedVendorIds.size >= requiredCount;
        if (!completed) {
            throw new functions.https.HttpsError("failed-precondition", "?꾩쭅 ?꾨즺?섏? ?딆븯?듬땲??");
        }
        const progressSnap = await tx.get(progressRef);
        const progress = progressSnap.exists ? progressSnap.data() : {};
        if (progress.rewardStatus === "REQUESTED" || progress.rewardStatus === "REDEEMED") {
            throw new functions.https.HttpsError("failed-precondition", "?대? ?곹뭹 ?섎졊 ?붿껌???꾨즺?섏뿀?듬땲??");
        }
        const { mode, rewards, selectableRewards } = (0, shared_1.resolveSelectableRewards)(config);
        if (selectableRewards.length === 0) {
            throw new functions.https.HttpsError("failed-precondition", config.soldOutMessage || "?곹뭹??紐⑤몢 ?뚯쭊?섏뿀?듬땲??");
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
            drawModeUsed: "PARTICIPANT",
            userName: userName || null,
            userOrg: userOrg || null,
            isCompleted: true,
            completedAt: progress.completedAt || admin.firestore.Timestamp.now()
        }, { merge: true });
        return {
            rewardId: selected.id,
            rewardName: selected.name,
            rewardStatus: "REQUESTED"
        };
    });
});
//# sourceMappingURL=requestStampReward.js.map