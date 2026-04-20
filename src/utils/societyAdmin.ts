import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { SocietyPrivateConfig } from '../types/schema';

export async function getSocietyAdminEmails(societyId: string): Promise<string[]> {
  const adminDocRef = doc(db, 'societies', societyId, 'private', 'admin');
  const adminDoc = await getDoc(adminDocRef);
  if (adminDoc.exists()) {
    const config = adminDoc.data() as SocietyPrivateConfig;
    return config.adminEmails || [];
  }
  return [];
}

export async function writeSocietyAdminEmails(societyId: string, adminEmails: string[]): Promise<void> {
  const adminDocRef = doc(db, 'societies', societyId, 'private', 'admin');
  const config: SocietyPrivateConfig = { adminEmails };
  await adminDocRef.set(config);
}
