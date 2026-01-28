import { collection, query, where, getDocs, Timestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Whitelist, UserTier } from '../types/schema';

export const validateWhitelist = async (
  conferenceId: string, 
  name: string, 
  authCode: string
): Promise<{ isValid: boolean; tier?: UserTier; whitelistId?: string }> => {
  const whitelistRef = collection(db, `conferences/${conferenceId}/whitelists`);
  // Query by authCode (assuming unique)
  const q = query(whitelistRef, where('authCode', '==', authCode));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return { isValid: false };
  }

  const docData = snapshot.docs[0].data() as Whitelist;
  const docId = snapshot.docs[0].id;

  // Validate Name (Optional strict check) and Usage
  if (docData.name !== name) {
      // Allow slight mismatch? Or strict? Strict for now.
      return { isValid: false };
  }

  if (docData.isUsed) {
    return { isValid: false };
  }

  return { isValid: true, tier: docData.tier, whitelistId: docId };
};

export const markWhitelistUsed = async (
    conferenceId: string, 
    whitelistId: string, 
    userId: string
) => {
    const docRef = collection(db, `conferences/${conferenceId}/whitelists`);
    // Need document reference by ID
    // Construct path: conferences/{confId}/whitelists/{id}
    // But we need doc ref.
    // Wait, collection(...) returns CollectionReference. doc(...) returns DocumentReference.
    // Correct usage: doc(db, path, path...)
    const wRef = doc(db, `conferences/${conferenceId}/whitelists/${whitelistId}`);
    await updateDoc(wRef, {
        isUsed: true,
        usedBy: userId,
        usedAt: Timestamp.now()
    });
};
