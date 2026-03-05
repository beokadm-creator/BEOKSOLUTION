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
async function verifyPaymentAmount(confId, tierId, selectedOptions, claimedAmount) {
    var _a;
    const db = admin.firestore();
    try {
        // 1. Get Conference Registration Settings
        const regSettingsSnap = await db.collection(`conferences/${confId}/settings`).doc('registration').get();
        if (!regSettingsSnap.exists) {
            return { isValid: false, expectedAmount: 0, error: 'Registration settings not found' };
        }
        const regSettings = regSettingsSnap.data() || {};
        // 2. Identify Active Period
        const now = admin.firestore.Timestamp.now();
        const periods = regSettings.periods || [];
        const activePeriod = periods.find((p) => {
            const s = p.startDate || p.start;
            const e = p.endDate || p.end;
            if (!s || !e)
                return false;
            const start = s.toDate ? s.toDate() : new Date(s);
            const end = e.toDate ? e.toDate() : new Date(e);
            return now.toDate() >= start && now.toDate() <= end;
        });
        if (!activePeriod) {
            return { isValid: false, expectedAmount: 0, error: 'No active registration period' };
        }
        // 3. Get Base Price for Tier
        // Support both 'totalPrices' and 'prices' field names
        const prices = activePeriod.totalPrices || activePeriod.prices || {};
        const basePrice = (_a = prices[tierId]) !== null && _a !== void 0 ? _a : 0;
        if (basePrice === 0) {
            console.warn(`[PaymentVerifier] Base price is 0 for tier: ${tierId}. Available tiers:`, Object.keys(prices));
        }
        // 4. Calculate Options Total
        let optionsTotal = 0;
        if (selectedOptions && selectedOptions.length > 0) {
            // Fetch options from subcollection to verify prices
            const optionsSnap = await db.collection(`conferences/${confId}/conference_options`).get();
            const dbOptions = optionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            for (const selected of selectedOptions) {
                const dbOption = dbOptions.find(o => o.id === selected.optionId);
                if (!dbOption) {
                    return { isValid: false, expectedAmount: 0, error: `Invalid option selected: ${selected.optionId}` };
                }
                optionsTotal += (dbOption.price || 0) * (selected.quantity || 1);
            }
        }
        const expectedTotal = basePrice + optionsTotal;
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
        console.error('Error verifying payment amount:', error);
        return { isValid: false, expectedAmount: 0, error: 'Internal verification error' };
    }
}
//# sourceMappingURL=paymentVerifier.js.map