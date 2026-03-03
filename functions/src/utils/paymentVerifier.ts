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
            const start = p.start?.toDate ? p.start.toDate() : new Date(p.start);
            const end = p.end?.toDate ? p.end.toDate() : new Date(p.end);
            return now.toDate() >= start && now.toDate() <= end;
        });

        if (!activePeriod) {
            return { isValid: false, expectedAmount: 0, error: 'No active registration period' };
        }

        // 3. Get Base Price for Tier
        // Note: activePeriod.totalPrices is a map like { 'TierCode': 100000 }
        const basePrice = activePeriod.totalPrices?.[tierId] ?? 0;

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
