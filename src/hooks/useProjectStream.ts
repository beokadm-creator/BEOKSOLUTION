import { useState, useEffect, useRef } from 'react';
import { translationDb as rtdb } from '../lib/translationFirebase';
import { ref, onValue, off, get, query, limitToLast, orderByChild, endBefore } from 'firebase/database';

export const useProjectStream = (projectIdOrSlug: string | undefined, activeSessionId?: string | null, options: { subscribe?: boolean } = { subscribe: true }) => {
  const [realProjectId, setRealProjectId] = useState<string | null>(null);
  const [streamData, setStreamData] = useState<Record<string, { original: string; refined?: string; ko?: string; en?: string; status: 'raw' | 'translating' | 'final' | 'merged'; timestamp: number; seq?: number; mergedIds?: string[], sessionId?: string }> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const oldestTimestampRef = useRef<number | null>(null);

  const loadOlderMessages = async () => {
    if (!realProjectId || !hasMore || !oldestTimestampRef.current) return;
    
    try {
      const olderQuery = query(
        ref(rtdb, `projects/${realProjectId}/stream`),
        orderByChild('timestamp'),
        endBefore(oldestTimestampRef.current),
        limitToLast(50)
      );
      
      const snapshot = await get(olderQuery);
      const data = snapshot.val();
      
      if (data) {
        const items = Object.values(data) as any[];
        if (items.length > 0) {
          const newOldest = Math.min(...items.map(i => i.timestamp));
          oldestTimestampRef.current = newOldest;
          
          setStreamData(prev => ({
            ...data,
            ...prev
          }));
        }
        if (items.length < 50) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("과거 메시지 불러오기 실패:", err);
    }
  };

  useEffect(() => {
    if (!projectIdOrSlug) {
      setLoading(false);
      return;
    }

    let mounted = true;
    let unsubscribeStream: (() => void) | null = null;

    const resolveAndSubscribe = async () => {
      try {
        setLoading(true);
        const resolvedId = projectIdOrSlug;
        setRealProjectId(resolvedId);

        if (options.subscribe) {
          const streamQuery = query(
            ref(rtdb, `projects/${resolvedId}/stream`),
            orderByChild('timestamp'),
            limitToLast(50)
          );

          unsubscribeStream = onValue(streamQuery, (snapshot: any) => {
            if (!mounted) return;
            const data = snapshot.val() || {};
            
            if (!oldestTimestampRef.current && Object.keys(data).length > 0) {
              const items = Object.values(data) as any[];
              oldestTimestampRef.current = Math.min(...items.map(i => i.timestamp));
            }

            setStreamData(prev => ({
              ...prev,
              ...data
            }));
            
            setLoading(false);
          }, (err) => {
            console.error("Stream subscription error:", err);
            if (mounted) {
              setError(err instanceof Error ? err.message : String(err));
              setLoading(false);
            }
          });
        }
      } catch (err: unknown) {
        console.error("Error in useProjectStream:", err);
        if (mounted) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    resolveAndSubscribe();

    return () => {
      mounted = false;
      if (unsubscribeStream) {
        unsubscribeStream();
      }
    };
  }, [projectIdOrSlug, options.subscribe]);

  return { realProjectId, streamData, loading, error, loadOlderMessages, hasMore };
};
