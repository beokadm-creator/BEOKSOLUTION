import { SUPER_ADMINS } from '../constants/defaults';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Check if an email belongs to a super admin.
 * 
 * Resolution order:
 * 1. Firestore `super_admins/{email}` collection — role === 'SUPER_ADMIN'
 * 2. Fallback: hardcoded SUPER_ADMINS array (for offline/outage resilience)
 * 
 * This dual-source approach ensures admin access works even when
 * Firestore is unavailable (e.g., during outage or cold start).
 * 
 * @param email - Email address to check
 * @returns Promise<boolean> - true if the email belongs to a super admin
 */
export const checkIsSuperAdmin = async (email: string): Promise<boolean> => {
    if (!email) return false;

    // Trim and normalize
    const normalizedEmail = email.trim().toLowerCase();

    // Primary: Firestore lookup
    try {
        const docRef = doc(db, 'super_admins', normalizedEmail);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.role === 'SUPER_ADMIN') {
                return true;
            }
        }
    } catch {
        // Firestore unavailable — continue to fallback
    }

    // Fallback: hardcoded array
    return SUPER_ADMINS.includes(normalizedEmail) || SUPER_ADMINS.includes(email);
};
