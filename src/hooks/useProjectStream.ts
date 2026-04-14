import { useState, useEffect, useRef } from 'react';
import { translationDb as rtdb } from '../lib/translationFirebase';
import { ref, onValue, get, query, orderByChild, equalTo } from 'firebase/database';

export const useProjectStream = (
  projectIdOrSlug: string | undefined, 
  activeSessionId: string | null,
  options: { subscribe?: boolean } = { subscribe: true }
) => {
  const [realProjectId, setRealProjectId] = useState<string | null>(null);
  const [streamData, setStreamData] = useState<Record<string, { original: string; refined?: string; ko?: string; en?: string; status: 'raw' | 'translating' | 'final' | 'merged'; timestamp: number; seq?: number; mergedIds?: string[], sessionId?: string }> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectIdOrSlug) {
      setStreamData(null);
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
          // If activeSessionId is null/empty, we don't subscribe to the stream
          // because it will cause permission denied or fetch the whole DB.
          // Wait until there is a valid session ID.
          if (!activeSessionId) {
            setStreamData({});
            setLoading(false);
            return;
          }

          const streamQuery = query(
            ref(rtdb, `projects/${resolvedId}/stream`),
            orderByChild('sessionId'),
            equalTo(activeSessionId)
          );

          unsubscribeStream = onValue(streamQuery, (snapshot: any) => {
            if (!mounted) return;
            const data = snapshot.val() || {};
            
            setStreamData(data);
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
  }, [projectIdOrSlug, activeSessionId, options.subscribe]);

  return { realProjectId, streamData, loading, error };
};
