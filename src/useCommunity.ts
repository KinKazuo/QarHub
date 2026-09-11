import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, requestApi, type CommunityState, type ApiResult } from './api';

const empty: CommunityState = {
  posts: [],
  cars: [],
  saved: [],
  liked: [],
  joined: [],
  name: '',
  user: null,
};

export function useCommunity() {
  const [state, setState] = useState<CommunityState>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const mutating = useRef(false);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    if (mutating.current) return;
    const current = ++revision.current;
    try {
      const result = await requestApi('/state');
      if (mounted.current && current === revision.current) {
        setState(result.state);
        setError('');
      }
    } catch (error) {
      if (mounted.current && current === revision.current)
        setError(error instanceof Error ? error.message : 'Нет связи с сервером.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 8000);
    const focus = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => {
      mounted.current = false;
      clearInterval(interval);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', focus);
    };
  }, [refresh]);

  const mutate = useCallback(
    async (path: string, method = 'POST', body?: unknown): Promise<ApiResult> => {
      if (mutating.current) throw new ApiError(409, 'Дождись завершения предыдущего действия.');
      mutating.current = true;
      revision.current++;
      setBusy(true);
      try {
        const result = await requestApi(path, method, body);
        if (mounted.current) {
          setState(result.state);
          setError('');
        }
        return result;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401 && !path.startsWith('/auth/')) {
          if (mounted.current)
            setState((s) => ({
              ...s,
              user: null,
              name: '',
              cars: [],
              liked: [],
              saved: [],
              joined: [],
              posts: s.posts.map((p) => ({ ...p, own: false })),
            }));
        }
        throw error;
      } finally {
        mutating.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [],
  );
  return { state, loading, error, busy, refresh, mutate };
}
