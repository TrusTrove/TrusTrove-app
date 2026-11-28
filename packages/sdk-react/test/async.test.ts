import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAsyncQuery, useAsyncMutation } from "../src/async.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useAsyncQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs the query on mount and exposes the resolved data", async () => {
    const queryFn = vi.fn().mockResolvedValue("first");

    const { result } = renderHook(() => useAsyncQuery(queryFn, []));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBe("first");
    expect(result.current.error).toBeNull();
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("re-runs when deps change", async () => {
    const queryFn = vi.fn().mockResolvedValue("first");

    const { result, rerender } = renderHook(
      ({ dep }: { dep: number }) => useAsyncQuery(queryFn, [dep]),
      { initialProps: { dep: 1 } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    queryFn.mockResolvedValue("second");
    rerender({ dep: 2 });
    await waitFor(() => expect(result.current.data).toBe("second"));

    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("refetch re-runs the query and toggles loading then error", async () => {
    let shouldFail = false;
    const queryFn = vi.fn(async () => {
      if (shouldFail) throw new Error("rpc unavailable");
      return "ok";
    });

    const { result } = renderHook(() => useAsyncQuery(queryFn, []));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBe("ok");

    shouldFail = true;
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.refetch();
    });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await pending;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("rpc unavailable");
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("clears the error and restores data once a refetch succeeds", async () => {
    let shouldFail = true;
    const queryFn = vi.fn(async () => {
      if (shouldFail) throw new Error("boom");
      return "recovered";
    });

    const { result } = renderHook(() => useAsyncQuery(queryFn, []));
    await waitFor(() => expect(result.current.error).not.toBeNull());

    shouldFail = false;
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toBe("recovered");
    expect(result.current.isLoading).toBe(false);
  });

  it("wraps a non-Error rejection", async () => {
    const queryFn = vi.fn().mockRejectedValue("plain string failure");

    const { result } = renderHook(() => useAsyncQuery(queryFn, []));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("plain string failure");
  });
});

describe("useAsyncMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("holds isPending for the whole call and resolves with the result", async () => {
    const call = deferred<string>();
    const mutationFn = vi.fn(() => call.promise);

    const { result } = renderHook(() => useAsyncMutation(mutationFn));
    expect(result.current.isPending).toBe(false);

    let pending!: Promise<string>;
    act(() => {
      pending = result.current.mutate();
    });
    expect(result.current.isPending).toBe(true);

    call.resolve("minted");
    await act(async () => {
      await expect(pending).resolves.toBe("minted");
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("sets error and rethrows when the mutation fails", async () => {
    const mutationFn = vi.fn().mockRejectedValue(new Error("not enough funds"));

    const { result } = renderHook(() => useAsyncMutation(mutationFn));

    await act(async () => {
      await expect(result.current.mutate()).rejects.toThrow("not enough funds");
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.error?.message).toBe("not enough funds");
  });

  it("clears a previous error on a subsequent success", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("ledger busy")) as (
      value: string,
    ) => Promise<string>;
    const { result, rerender } = renderHook(
      ({ fn }: { fn: (value: string) => Promise<string> }) =>
        useAsyncMutation<[string], string>(fn),
      { initialProps: { fn: failing } },
    );

    await act(async () => {
      await result.current.mutate("fund").catch(() => undefined);
    });
    expect(result.current.error?.message).toBe("ledger busy");

    rerender({ fn: vi.fn().mockResolvedValue("funded") });
    await act(async () => {
      await result.current.mutate("fund");
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isPending).toBe(false);
  });

  it("keeps isPending true while any concurrent mutate is still running", async () => {
    const calls = [deferred<string>(), deferred<string>()];
    const mutationFn = vi
      .fn()
      .mockImplementationOnce(() => calls[0].promise)
      .mockImplementationOnce(() => calls[1].promise);

    const { result } = renderHook(() => useAsyncMutation(mutationFn));

    let first!: Promise<string>;
    let second!: Promise<string>;
    act(() => {
      first = result.current.mutate();
    });
    act(() => {
      second = result.current.mutate();
    });
    expect(result.current.isPending).toBe(true);

    // The first call settles while the second is still in flight.
    await act(async () => {
      calls[0].resolve("one");
      await expect(first).resolves.toBe("one");
    });
    expect(result.current.isPending).toBe(true);

    await act(async () => {
      calls[1].resolve("two");
      await expect(second).resolves.toBe("two");
    });
    expect(result.current.isPending).toBe(false);
  });

  it("leaves isPending false once a rejected concurrent call settles", async () => {
    const calls = [deferred<string>(), deferred<string>()];
    const mutationFn = vi
      .fn()
      .mockImplementationOnce(() => calls[0].promise)
      .mockImplementationOnce(() => calls[1].promise);

    const { result } = renderHook(() => useAsyncMutation(mutationFn));

    let first!: Promise<string>;
    let second!: Promise<string>;
    act(() => {
      first = result.current.mutate();
    });
    act(() => {
      second = result.current.mutate();
    });

    await act(async () => {
      calls[0].reject(new Error("rejected tx"));
      await expect(first).rejects.toThrow("rejected tx");
    });
    expect(result.current.isPending).toBe(true);
    expect(result.current.error?.message).toBe("rejected tx");

    await act(async () => {
      calls[1].resolve("two");
      await expect(second).resolves.toBe("two");
    });
    expect(result.current.isPending).toBe(false);
  });
});
