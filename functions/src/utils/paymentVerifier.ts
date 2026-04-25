import * as admin from 'firebase-admin';

export interface VerificationResult {
    isValid: boolean;
    expectedAmount: number;
    error?: string;
}

// KST is UTC+9. Cloud Functions run in UTC.

/**
 * Get a YYYY-MM-DD date string in KST from any Date object.
 * This is the simplest and most reliable way to do KST date comparisons
 * regardless of where the server is running.
 */
function toKSTDateString(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
}

interface SelectedOption {
    optionId: string;
    quantity?: number;
}

interface RegistrationPeriod {
    startDate?: admin.firestore.Timestamp;
    start?: admin.firestore.Timestamp;
    endDate?: admin.firestore.Timestamp;
    end?: admin.firestore.Timestamp;
    name?: string;
    label?: string;
    totalPrice?: Record<string, number>;
    prices?: Record<string, number>;
}

interface DbOption {
    id: string;
    price?: number;
}

export async function verifyPaymentAmount(
    confId: string,
    tierId: string,
    selectedOptions: SelectedOption[],
    claimedAmount: number
): Promise<VerificationResult> {
    const db = admin.firestore();

    try {
        // 1. Get Conference Registration Settings
        const regSettingsSnap = await db.collection(`conferences/${confId}/settings`).doc('registration').get();
        if (!regSettingsSnap.exists) {
            console.warn(`[PaymentVerifier] Registration settings not found for ${confId}. Bypassing period check.`);
            return { isValid: true, expectedAmount: claimedAmount };
        }
        const regSettings = regSettingsSnap.data() || {};
        const isFreeAll = regSettings.paymentMode === 'FREE_ALL';

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

        const activePeriod = periods.find((p: RegistrationPeriod) => {
            const s = p.startDate || p.start;
            const e = p.endDate || p.end;
            if (!s || !e) return false;

            const startDate: Date = s.toDate();
            const endDate: Date = e.toDate();

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

        // 3. Get Base Price for Tier
        const prices = activePeriod.totalPrices || activePeriod.prices || {};
        let basePrice = 0;
        
        if (isFreeAll) {
            console.log(`[PaymentVerifier] FREE_ALL mode active for ${confId}. Base price forced to 0.`);
            basePrice = 0;
        } else {
            basePrice = prices[tierId] ?? 0;
            console.log(`[PaymentVerifier] Tier: "${tierId}", Base price: ${basePrice}, Available: ${JSON.stringify(Object.keys(prices))}`);

            if (basePrice === 0 && Object.keys(prices).length > 0) {
                console.warn(`[PaymentVerifier] Price is 0 for tier "${tierId}". Check tier key mapping.`);
            }
        }

        // 4. Calculate Options Total
        let optionsTotal = 0;
        if (selectedOptions && selectedOptions.length > 0) {
            const optionsSnap = await db.collection(`conferences/${confId}/conference_options`).get();
            const dbOptions = optionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            for (const selected of selectedOptions) {
                const dbOption: DbOption | undefined = dbOptions.find(o => o.id === selected.optionId);
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

    } catch (error) {
        console.error('[PaymentVerifier] Error:', error);
        return { isValid: false, expectedAmount: 0, error: 'Internal verification error' };
    }
}
