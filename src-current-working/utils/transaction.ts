import { doc } from 'firebase/firestore';
import { db } from '../firebase';
import { v4 as uuidv4 } from 'uuid';

interface TransactionHelper {
    get: (ref: unknown) => { exists: () => boolean; data: () => Record<string, unknown> };
    update: (ref: unknown, data: Record<string, unknown>) => void;
}

/**
 * Generate Receipt Number atomically.
 * Format: {Year}-SP-{Serial} (e.g., 2026-SP-001)
 */
export const generateReceiptNumber = async (conferenceId: string, transaction: TransactionHelper): Promise<string> => {
    // Ideally, we read a counter doc in a transaction
    const configRef = doc(db, `conferences/${conferenceId}/info/general`); // Assuming this holds receiptConfig
    // Note: In real logic, we must pass the transaction object to read.
    // However, Firestore JS SDK transactions require all reads before writes.
    // This helper function is intended to be called INSIDE a runTransaction callback.
    
    const configSnap = transaction.get(configRef);
    if (!configSnap.exists()) throw new Error("Config not found");

    const data = configSnap.data();
    const currentSerial = (data.receiptConfig as { nextSerialNo?: number } | undefined)?.nextSerialNo || 1;
    
    // Update next serial
    transaction.update(configRef, {
        'receiptConfig.nextSerialNo': currentSerial + 1
    });

    const year = new Date().getFullYear();
    // Padding logic
    const serialStr = String(currentSerial).padStart(3, '0');
    return `${year}-SP-${serialStr}`;
};

/**
 * Generate Confirmation QR Data.
 * Simple JSON string or hash.
 */
export const generateConfirmationQr = (regId: string, userId: string): string => {
    return JSON.stringify({ type: 'CONFIRM', regId, userId, t: Date.now() });
};

/**
 * Generate Badge QR (UUID).
 */
export const generateBadgeQr = (): string => {
    return uuidv4();
};
