import * as admin from 'firebase-admin';

export interface VerificationResult {
    isValid: boolean;
    expectedAmount: number;
    error?: string;
}

export async function verifyPaymentAmount(
    confId: string,
    tierId: string,
    selectedOptions: any[],
    claimedAmount: number
): Promise<VerificationResult> {
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
        const activePeriod = periods.find((p: any) => {
            const s = p.startDate || p.start;
            const e = p.endDate || p.end;
            if (!s || !e) return false;

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
        const basePrice = prices[tierId] ?? 0;

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
                const dbOption: any = dbOptions.find(o => o.id === selected.optionId);
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

    } catch (error) {
        console.error('Error verifying payment amount:', error);
        return { isValid: false, expectedAmount: 0, error: 'Internal verification error' };
    }
}
