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
exports.verifyPaymentAmount = verifyPaymentAmount;
const admin = __importStar(require("firebase-admin"));
// KST is UTC+9. Cloud Functions run in UTC.
/**
 * Get a YYYY-MM-DD date string in KST from any Date object.
 * This is the simplest and most reliable way to do KST date comparisons
 * regardless of where the server is running.
 */
function toKSTDateString(date) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
}
async function verifyPaymentAmount(confId, tierId, selectedOptions, claimedAmount) {
    var _a;
    const db = admin.firestore();
    try {
        // 1. Get Conference Registration Settings
        const regSettingsSnap = await db.collection(`conferences/${confId}/settings`).doc('registration').get();
        if (!regSettingsSnap.exists) {
            console.warn(`[PaymentVerifier] Registration settings not found for ${confId}. Bypassing period check.`);
            return { isValid: true, expectedAmount: claimedAmount };
        }
        const regSettings = regSettingsSnap.data() || {};
        // 2. Identify Active Period using KST date comparison
        //    Admin sets dates in KST, so we compare KST date strings (YYYY-MM-DD).
        //    e.g. endDate "2026-03-06" means the entire day of March 6 KST is valid.
        const nowKSTDateStr = toKSTDateString(new Date());
        console.log(`[PaymentVerifier] Now (KST): ${nowKSTDateStr}`);
        const periods = regSettings.periods || [];
        if (periods.length === 0) {
            console.warn(`[PaymentVerifier] No periods defined for ${confId}.`);
            return { isValid: true, expectedAmount: claimedAmount };
        }
        const activePeriod = periods.find((p) => {
            const s = p.startDate || p.start;
            const e = p.endDate || p.end;
            if (!s || !e)
                return false;
            const startDate = s.toDate ? s.toDate() : new Date(s);
            const endDate = e.toDate ? e.toDate() : new Date(e);
            const startKSTStr = toKSTDateString(startDate);
            const endKSTStr = toKSTDateString(endDate);
            const matches = nowKSTDateStr >= startKSTStr && nowKSTDateStr <= endKSTStr;
            console.log(`[PaymentVerifier] Period "${JSON.stringify(p.name || p.label)}": ${startKSTStr} ~ ${endKSTStr} → ${matches ? '✅ Active' : '❌'}`);
            return matches;
        });
        if (!activePeriod) {
            console.error(`[PaymentVerifier] No active period for ${confId}. Today (KST): ${nowKSTDateStr}`);
            return { isValid: false, expectedAmount: 0, error: 'No active registration period' };
        }
        console.log(`[PaymentVerifier] ✅ Active period: ${JSON.stringify(activePeriod.name || activePeriod.label)}`);
        // 3. Get Base Price for Tier (supports both 'totalPrices' and 'prices' field names)
        const prices = activePeriod.totalPrices || activePeriod.prices || {};
        const basePrice = (_a = prices[tierId]) !== null && _a !== void 0 ? _a : 0;
        console.log(`[PaymentVerifier] Tier: "${tierId}", Base price: ${basePrice}, Available: ${JSON.stringify(Object.keys(prices))}`);
        if (basePrice === 0 && Object.keys(prices).length > 0) {
            console.warn(`[PaymentVerifier] Price is 0 for tier "${tierId}". Check tier key mapping.`);
        }
        // 4. Calculate Options Total
        let optionsTotal = 0;
        if (selectedOptions && selectedOptions.length > 0) {
            const optionsSnap = await db.collection(`conferences/${confId}/conference_options`).get();
            const dbOptions = optionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            for (const selected of selectedOptions) {
                const dbOption = dbOptions.find(o => o.id === selected.optionId);
                if (!dbOption) {
                    return { isValid: false, expectedAmount: 0, error: `Invalid option: ${selected.optionId}` };
                }
                optionsTotal += (dbOption.price || 0) * (selected.quantity || 1);
            }
        }
        const expectedTotal = basePrice + optionsTotal;
        console.log(`[PaymentVerifier] Expected: ${expectedTotal}, Claimed: ${claimedAmount}`);
        if (expectedTotal !== claimedAmount) {
            return {
                isValid: false,
                expectedAmount: expectedTotal,
                error: `Amount mismatch. Expected: ${expectedTotal}, Received: ${claimedAmount}`
            };
        }
        return { isValid: true, expectedAmount: expectedTotal };
    }
    catch (error) {
        console.error('[PaymentVerifier] Error:', error);
        return { isValid: false, expectedAmount: 0, error: 'Internal verification error' };
    }
}
//# sourceMappingURL=paymentVerifier.js.map