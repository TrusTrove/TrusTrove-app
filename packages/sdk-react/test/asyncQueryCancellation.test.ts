import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAsyncQuery } from "../src/async.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useAsyncQuery — cancellation and stale-response guard", () => {
  it("keeps the newer result when an earlier request settles last", async () => {
    const older = deferred<string>();
    const newer = deferred<string>();
    let pending: Promise<string> = older.promise;

    const { result, rerender } = renderHook(
      ({ dep }: { dep: number }) => useAsyncQuery(() => pending, [dep]),
      { initialProps: { dep: 1 } },
    );

    // Deps change while the first request is still in flight, then the newer
    // request settles first and the older one lands on top of it.
    pending = newer.promise;
    rerender({ dep: 2 });

    await act(async () => {
      newer.resolve("newer");
    });
    expect(result.current.data).toBe("newer");

    await act(async () => {
      older.resolve("stale");
    });
    expect(
      result.current.data,
      "a superseded request must not overwrite fresh data",
    ).toBe("newer");
    expect(result.current.error).toBeNull();
  });

  it("ignores a rejection from a request that deps change superseded", async () => {
    const older = deferred<string>();
    const newer = deferred<string>();
    let pending: Promise<string> = older.promise;

    const { result, rerender } = renderHook(
      ({ dep }: { dep: number }) => useAsyncQuery(() => pending, [dep]),
      { initialProps: { dep: 1 } },
    );

    pending = newer.promise;
    rerender({ dep: 2 });

    await act(async () => {
      newer.resolve("current");
    });
    await act(async () => {
      older.reject(new Error("superseded request failed"));
    });

    expect(result.current.data).toBe("current");
    expect(
      result.current.error,
      "an invalidated request must not surface as an error",
    ).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("applies the latest request's result when it settles last", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    let pending: Promise<string> = first.promise;

    const { result, rerender } = renderHook(
      ({ dep }: { dep: number }) => useAsyncQuery(() => pending, [dep]),
      { initialProps: { dep: 1 } },
    );

    pending = second.promise;
    rerender({ dep: 2 });

    await act(async () => {
      first.resolve("dropped");
    });
    expect(result.current.isLoading, "the current run is still in flight").toBe(
      true,
    );

    await act(async () => {
      second.resolve("final");
    });
    expect(result.current.data).toBe("final");
    expect(result.current.isLoading).toBe(false);
  });

  it("aborts the previous request's signal when deps change", async () => {
    const signals: AbortSignal[] = [];
    const first = deferred<string>();
    const second = deferred<string>();
    let pending: Promise<string> = first.promise;

    const { result, rerender } = renderHook(
      ({ dep }: { dep: number }) =>
        useAsyncQuery(
          (signal) => {
            signals.push(signal);
            return pending;
          },
          [dep],
        ),
      { initialProps: { dep: 1 } },
    );

    expect(signals).toHaveLength(1);
    expect(
      signals[0].aborted,
      "the in-flight request must not be aborted yet",
    ).toBe(false);

    pending = second.promise;
    rerender({ dep: 2 });

    expect(signals).toHaveLength(2);
    expect(
      signals[0].aborted,
      "cleanup must abort the request the previous deps started",
    ).toBe(true);
    expect(signals[1].aborted).toBe(false);

    await act(async () => {
      second.resolve("done");
    });
    expect(result.current.data).toBe("done");
  });

  it("aborts an in-flight request and writes no state on unmount", async () => {
    const signals: AbortSignal[] = [];
    const inFlight = deferred<string>();

    const { result, unmount } = renderHook(() =>
      useAsyncQuery((signal) => {
        signals.push(signal);
        return inFlight.promise;
      }, []),
    );

    const snapshot = { ...result.current };
    unmount();

    expect(
      signals[0].aborted,
      "unmount cleanup must abort the in-flight request",
    ).toBe(true);

    await act(async () => {
      inFlight.resolve("late");
    });

    expect(result.current.data).toBe(snapshot.data);
    expect(result.current.isLoading).toBe(snapshot.isLoading);
    expect(result.current.error).toBe(snapshot.error);
  });

  it("does not surface the AbortError of a run the deps change superseded", async () => {
    const makeAbortAware = () => {
      let resolve!: (value: string) => void;
      const run = (signal: AbortSignal) =>
        new Promise<string>((res, rej) => {
          resolve = res;
          signal.addEventListener("abort", () =>
            rej(new Error("AbortError: request cancelled")),
          );
        });
      return { run, resolve: () => resolve("ok") };
    };
    const first = makeAbortAware();
    const second = makeAbortAware();
    let current = first.run;

    const { result, rerender } = renderHook(
      ({ dep }: { dep: number }) =>
        useAsyncQuery((signal) => current(signal), [dep]),
      { initialProps: { dep: 1 } },
    );

    current = second.run;
    rerender({ dep: 2 });
    await act(async () => {
      // Lets the aborted first run's rejection reach the hook.
      await Promise.resolve();
    });

    await act(async () => {
      second.resolve();
    });

    expect(result.current.data).toBe("ok");
    expect(
      result.current.error,
      "a cancelled run must not leave an error behind",
    ).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});
