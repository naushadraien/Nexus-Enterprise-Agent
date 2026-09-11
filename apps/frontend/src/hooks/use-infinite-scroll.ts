import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Props for {@link useInfiniteScroll}.
 *
 * @template T The shape of a single item in the paginated list.
 */
export interface UseInfiniteScrollProps<T> {
  fetchFunction: (
    page: number,
    searchQuery: string,
    signal: AbortSignal,
  ) => Promise<{ data: T[]; hasMore: boolean }>;
  searchQuery?: string;
  enabled?: boolean;
  debounceMs?: number;
}

export interface UseInfiniteScrollResult<T> {
  data: T[];
  isLoading: boolean;
  hasMore: boolean;
  error: Error | null;
  loadMoreRef: (node: HTMLElement | null) => void;
  retry: () => void;
  setData: React.Dispatch<React.SetStateAction<T[]>>; // Added for optimistic updates
}

export function useInfiniteScroll<T>({
  fetchFunction,
  searchQuery = '',
  enabled = true,
  debounceMs = 500,
}: UseInfiniteScrollProps<T>): UseInfiniteScrollResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keep state in refs so the observer doesn't need to be recreated on every state change
  const stateRef = useRef({ isLoading, hasMore, page, error });
  useEffect(() => {
    stateRef.current = { isLoading, hasMore, page, error };
  }, [isLoading, hasMore, page, error]);

  const fetchFunctionRef = useRef(fetchFunction);
  useEffect(() => {
    fetchFunctionRef.current = fetchFunction;
  }, [fetchFunction]);

  const cancelInFlight = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;
    const debounceTimeout = setTimeout(() => {
      const loadInitialData = async () => {
        cancelInFlight();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        setError(null);

        try {
          const result = await fetchFunctionRef.current(1, searchQuery, controller.signal);
          if (isMounted && !controller.signal.aborted) {
            setData(result.data);
            setHasMore(result.hasMore);
            setPage(1);
          }
        } catch (err) {
          if (isMounted && !controller.signal.aborted) {
            const error = err instanceof Error ? err : new Error('Failed to fetch data');
            console.error('Failed to fetch data in useInfiniteScroll', error);
            setError(error);
          }
        } finally {
          if (isMounted && !controller.signal.aborted) {
            setIsLoading(false);
          }
        }
      };

      loadInitialData();
    }, debounceMs);

    return () => {
      isMounted = false;
      clearTimeout(debounceTimeout);
      cancelInFlight();
    };
  }, [searchQuery, enabled, debounceMs, cancelInFlight]);

  const loadMore = useCallback(
    (nextPage: number) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setError(null);

      fetchFunctionRef
        .current(nextPage, searchQuery, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setData((prev) => [...prev, ...result.data]);
          setHasMore(result.hasMore);
          setPage(nextPage);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          const error = err instanceof Error ? err : new Error('Failed to fetch more data');
          console.error('Failed to fetch more data', error);
          setError(error);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    },
    [searchQuery],
  );

  const loadMoreRef = useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            const state = stateRef.current;
            if (state.hasMore && !state.isLoading && !state.error) {
              loadMore(state.page + 1);
            }
          }
        },
        { rootMargin: '100px' },
      );

      observerRef.current.observe(node);
    },
    [loadMore],
  );

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  const retry = useCallback(() => {
    if (page === 1 || data.length === 0) {
      loadMore(1);
    } else {
      loadMore(page + 1);
    }
  }, [page, data.length, loadMore]);

  return { data, isLoading, hasMore, error, loadMoreRef, retry, setData };
}
