import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import toast from 'react-hot-toast';

import { db } from '@/firebase';
import type { ExternalAttendeeDoc } from '../types';

export const useExternalAttendeesList = (confId: string | null) => {
  const [externalAttendees, setExternalAttendees] = useState<ExternalAttendeeDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!confId) return;

    const attendeesRef = collection(db, `conferences/${confId}/external_attendees`);
    const q = query(attendeesRef, where('deleted', '==', false));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((docSnap) => docSnap.data() as ExternalAttendeeDoc);
        data.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
        setExternalAttendees(data);
        setLoading(false);
      },
      (error) => {
        console.error('Failed to fetch external attendees:', error);
        toast.error('외부 참석자 목록을 불러오는데 실패했습니다.');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [confId]);

  return { externalAttendees, setExternalAttendees, loading };
};
