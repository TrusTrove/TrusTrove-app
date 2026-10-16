import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncQueryState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface AsyncMutationState<TArgs extends unknown[], TResult> {
  mutate: (...args: TArgs) => Promise<TResult>;
  isPending: boolean;
  error: Error | null;
}

/**
 * Runs an async query whenever `deps` change, exposing
 * loading/error/data state plus a `refetch` trigger.
 */
export function useAsyncQuery<T>(
  queryFn: () => Promise<T>,
  deps: unknown[],
): AsyncQueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const run = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await queryFnRef.current();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    data,
    isLoading,
    error,
    refetch: run,
  };
}

/**
 * Wraps a mutation function, exposing pending/error state and a `mutate`
 * caller that rethrows so callers can handle failures locally too.
 */
export function useAsyncMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
): AsyncMutationState<TArgs, TResult> {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutationFnRef = useRef(mutationFn);
  mutationFnRef.current = mutationFn;

  // Counted rather than a boolean: concurrent calls must not let the first one
  // to settle report idle while another is still running.
  const inFlightRef = useRef(0);

  const mutate = useCallback(async (...args: TArgs): Promise<TResult> => {
    inFlightRef.current += 1;
    setIsPending(true);
    setError(null);
    try {
      return await mutationFnRef.current(...args);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      inFlightRef.current -= 1;
      if (inFlightRef.current === 0) setIsPending(false);
    }
  }, []);

  return { mutate, isPending, error };
}
