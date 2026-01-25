import { getFirestore, runTransaction, doc, serverTimestamp, increment, collection } from 'firebase/firestore';

/**
 * [Step 512-D] Points Logic Engine
 * Handles atomic updates for user points to ensure data consistency.
 */
export class PointsRuleEngine {
    /**
     * Atomically awards points to a user and logs the transaction.
     * @param userId The UID of the user
     * @param points The amount of points to award
     * @param reason Description of why points are awarded
     * @param sourceId Optional: ID of the source (e.g., registration ID, conference ID)
     */
    static async awardPoints(userId: string, points: number, reason: string, sourceId?: string) {
        const db = getFirestore();
        const userRef = doc(db, 'users', userId);
        const historyRef = doc(collection(db, 'users', userId, 'points')); // Auto-ID for history

        try {
            await runTransaction(db, async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) {
                    throw new Error(`User ${userId} does not exist.`);
                }

                // 1. Update Total Points (Atomic Increment)
                transaction.update(userRef, {
                    totalPoints: increment(points),
                    lastPointUpdate: serverTimestamp()
                });

                // 2. Add History Record (Atomic Insert)
                transaction.set(historyRef, {
                    amount: points,
                    reason: reason,
                    sourceId: sourceId || null,
                    type: 'EARNED',
                    createdAt: serverTimestamp()
                });
            });

            console.log(`[PointsRuleEngine] Successfully awarded ${points} pts to ${userId}.`);
            return true;
        } catch (error) {
            console.error("[PointsRuleEngine] Transaction Failed:", error);
            throw error; // Propagate error for caller to handle
        }
    }

    /**
     * Atomically deducts points from a user.
     */
    static async deductPoints(userId: string, points: number, reason: string) {
        return this.awardPoints(userId, -points, reason);
    }
}
