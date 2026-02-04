import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  QuerySnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Notice, NoticeStatus } from '../types/schema';

// Collection path: conferences/{confId}/notices

/**
 * Get all notices for a conference
 */
export async function getNotices(confId: string): Promise<Notice[]> {
  const q = query(
    collection(db, 'conferences', confId, 'notices'),
    where('status', '==', 'PUBLISHED'),
    orderBy('isPinned', 'desc'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Notice));
}

/**
 * Get all notices (including draft/archived) for admin
 */
export async function getAllNotices(confId: string): Promise<Notice[]> {
  const q = query(
    collection(db, 'conferences', confId, 'notices'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Notice));
}

/**
 * Get a single notice by ID
 */
export async function getNotice(confId: string, noticeId: string): Promise<Notice | null> {
  const docRef = doc(db, 'conferences', confId, 'notices', noticeId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data()
  } as Notice;
}

/**
 * Get active notice count for badge display
 */
export async function getActiveNoticeCount(confId: string): Promise<number> {
  const q = query(
    collection(db, 'conferences', confId, 'notices'),
    where('status', '==', 'PUBLISHED')
  );

  const snapshot = await getDocs(q);
  return snapshot.size;
}

/**
 * Create a new notice
 */
export async function createNotice(
  confId: string,
  data: Omit<Notice, 'id' | 'conferenceId' | 'createdAt' | 'updatedAt' | 'readCount'>
): Promise<string> {
  const noticeData = {
    ...data,
    conferenceId: confId,
    readCount: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  const docRef = await addDoc(collection(db, 'conferences', confId, 'notices'), noticeData);
  return docRef.id;
}

/**
 * Update an existing notice
 */
export async function updateNotice(
  confId: string,
  noticeId: string,
  data: Partial<Omit<Notice, 'id' | 'conferenceId' | 'createdAt' | 'authorId'>>
): Promise<void> {
  const docRef = doc(db, 'conferences', confId, 'notices', noticeId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now()
  });
}

/**
 * Delete a notice
 */
export async function deleteNotice(confId: string, noticeId: string): Promise<void> {
  const docRef = doc(db, 'conferences', confId, 'notices', noticeId);
  await deleteDoc(docRef);
}

/**
 * Increment read count for a notice
 */
export async function incrementNoticeReadCount(confId: string, noticeId: string): Promise<void> {
  const docRef = doc(db, 'conferences', confId, 'notices', noticeId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const currentCount = docSnap.data()?.readCount || 0;
    await updateDoc(docRef, {
      readCount: currentCount + 1
    });
  }
}

/**
 * Subscribe to real-time notice updates
 */
export function subscribeToNotices(
  confId: string,
  callback: (notices: Notice[]) => void,
  status?: NoticeStatus
): () => void {
  const q = status
    ? query(
        collection(db, 'conferences', confId, 'notices'),
        where('status', '==', status),
        orderBy('isPinned', 'desc'),
        orderBy('createdAt', 'desc')
      )
    : query(
        collection(db, 'conferences', confId, 'notices'),
        orderBy('createdAt', 'desc')
      );

  const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const notices = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Notice));
    callback(notices);
  });

  return unsubscribe;
}

/**
 * Subscribe to notice count changes (for badge)
 */
export function subscribeToNoticeCount(
  confId: string,
  callback: (count: number) => void
): () => void {
  const q = query(
    collection(db, 'conferences', confId, 'notices'),
    where('status', '==', 'PUBLISHED')
  );

  const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    callback(snapshot.size);
  });

  return unsubscribe;
}
