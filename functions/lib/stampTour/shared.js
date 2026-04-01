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
exports.assertStampTourAdmin = exports.resolveSelectableRewards = exports.selectReward = exports.normalizeRewards = exports.getRequiredCount = void 0;
const functions = __importStar(require("firebase-functions"));
const getRequiredCount = (rule, boothCount) => {
    var _a;
    const safeBoothCount = Math.max(0, Math.floor(boothCount));
    if (safeBoothCount === 0)
        return 0;
    if ((rule === null || rule === void 0 ? void 0 : rule.type) === "ALL") {
        return safeBoothCount;
    }
    const requestedCount = Number((_a = rule === null || rule === void 0 ? void 0 : rule.requiredCount) !== null && _a !== void 0 ? _a : safeBoothCount);
    const safeRequestedCount = Number.isFinite(requestedCount)
        ? Math.max(1, Math.floor(requestedCount))
        : safeBoothCount;
    return Math.min(safeBoothCount, safeRequestedCount);
};
exports.getRequiredCount = getRequiredCount;
const normalizeRewards = (rewards, mode) => rewards.map((reward, index) => {
    var _a, _b, _c, _d, _e;
    const totalQty = Math.max(0, Math.floor(Number((_b = (_a = reward.totalQty) !== null && _a !== void 0 ? _a : reward.remainingQty) !== null && _b !== void 0 ? _b : 0) || 0));
    const remainingQty = Math.min(totalQty, Math.max(0, Math.floor(Number((_c = reward.remainingQty) !== null && _c !== void 0 ? _c : totalQty) || 0)));
    return {
        ...reward,
        name: (reward.name || "").trim(),
        totalQty,
        remainingQty,
        weight: mode === "RANDOM" ? Math.max(1, Math.floor(Number((_d = reward.weight) !== null && _d !== void 0 ? _d : 1) || 1)) : undefined,
        order: mode === "FIXED" ? Math.max(1, Math.floor(Number((_e = reward.order) !== null && _e !== void 0 ? _e : index + 1) || index + 1)) : undefined
    };
});
exports.normalizeRewards = normalizeRewards;
const selectReward = (rewards, mode) => {
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
exports.selectReward = selectReward;
const resolveSelectableRewards = (config) => {
    const mode = config.rewardMode === "FIXED" ? "FIXED" : "RANDOM";
    const rewards = (0, exports.normalizeRewards)(Array.isArray(config.rewards) ? config.rewards : [], mode);
    const primaryRewards = rewards.filter(reward => reward.remainingQty > 0 && reward.name.length > 0 && !reward.isFallback);
    const fallbackRewards = rewards.filter(reward => reward.remainingQty > 0 && reward.name.length > 0 && reward.isFallback);
    return {
        mode,
        rewards,
        selectableRewards: primaryRewards.length > 0 ? primaryRewards : fallbackRewards
    };
};
exports.resolveSelectableRewards = resolveSelectableRewards;
const assertStampTourAdmin = async (db, confId, auth) => {
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
exports.assertStampTourAdmin = assertStampTourAdmin;
//# sourceMappingURL=shared.js.map