import { useState, useEffect } from 'react';
import {
  getNotices,
  getAllNotices,
  getNotice,
  getActiveNoticeCount,
  createNotice,
  updateNotice,
  deleteNotice,
  incrementNoticeReadCount,
  subscribeToNotices,
  subscribeToNoticeCount
} from '../services/notices';
import type { Notice } from '../types/schema';
import { useConference } from './useConference';
import { useConfContextSafe } from '../contexts/ConfContext';

/**
 * Hook for fetching and managing conference notices (published only)
 * For public pages - uses useConference only
 */
export function useNotices() {
  const conferenceData = useConference();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!conferenceData?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToNotices(
      conferenceData.id,
      (data) => {
        setNotices(data);
        setLoading(false);
      },
      'PUBLISHED'
    );

    return () => unsubscribe();
  }, [conferenceData?.id]);

  return { notices, loading, error };
}

/**
 * Hook for fetching all notices (for admin dashboard)
 * For admin pages - uses ConfContext primarily, falls back to useConference
 */
export function useAllNotices() {
  const conferenceData = useConference();
  const confContext = useConfContextSafe(); // Safe - doesn't throw
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Use ConfContext if available (admin pages), otherwise use useConference (public pages)
  const confId = confContext?.confId || conferenceData?.id;

  useEffect(() => {
    if (!confId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToNotices(
      confId,
      (data) => {
        setNotices(data);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [confId]);

  return { notices, loading, error };
}

/**
 * Hook for getting active notice count (for badge)
 * For public pages - uses useConference only
 */
export function useNoticeCount() {
  const conferenceData = useConference();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conferenceData?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToNoticeCount(
      conferenceData.id,
      (newCount) => {
        setCount(newCount);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [conferenceData?.id]);

  return { count, loading };
}

/**
 * Hook for CRUD operations on notices (admin only)
 * For admin pages - uses ConfContext primarily, falls back to useConference
 */
export function useNoticeActions() {
  const conferenceData = useConference();
  const confContext = useConfContextSafe(); // Safe - doesn't throw
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Use ConfContext if available (admin pages), otherwise use useConference (public pages)
  const confId = confContext?.confId || conferenceData?.id;

  const create = async (data: Omit<Notice, 'id' | 'conferenceId' | 'createdAt' | 'updatedAt' | 'readCount'>) => {
    if (!confId) {
      throw new Error('No conference context');
    }

    setLoading(true);
    setError(null);

    try {
      const noticeId = await createNotice(confId, data);
      return noticeId;
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to create notice');
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const update = async (noticeId: string, data: Partial<Omit<Notice, 'id' | 'conferenceId' | 'createdAt' | 'authorId'>>) => {
    if (!confId) {
      throw new Error('No conference context');
    }

    setLoading(true);
    setError(null);

    try {
      await updateNotice(confId, noticeId, data);
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to update notice');
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const remove = async (noticeId: string) => {
    if (!confId) {
      throw new Error('No conference context');
    }

    setLoading(true);
    setError(null);

    try {
      await deleteNotice(confId, noticeId);
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to delete notice');
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (noticeId: string) => {
    if (!confId) {
      throw new Error('No conference context');
    }

    try {
      await incrementNoticeReadCount(confId, noticeId);
    } catch (e) {
      console.error('Failed to mark notice as read:', e);
    }
  };

  return {
    create,
    update,
    remove,
    markAsRead,
    loading,
    error
  };
}

/**
 * Hook for fetching a single notice by ID
 */
export function useNotice(noticeId: string | null) {
  const conferenceData = useConference();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!conferenceData?.id || !noticeId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getNotice(conferenceData.id, noticeId)
      .then((data) => {
        setNotice(data);
        setLoading(false);
      })
      .catch((e) => {
        const err = e instanceof Error ? e : new Error('Failed to fetch notice');
        setError(err);
        setLoading(false);
      });
  }, [conferenceData?.id, noticeId]);

  return { notice, loading, error };
}

