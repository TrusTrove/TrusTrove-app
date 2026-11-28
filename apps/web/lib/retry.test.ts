import { describe, it, expect } from "vitest";
import {
  TRANSIENT_HTTP_STATUSES,
  MAX_TRANSIENT_QUERY_RETRIES,
  MUTATION_RETRY_DISABLED,
  TRANSIENT_RETRY_BASE_DELAY_MS,
  TRANSIENT_RETRY_MAX_DELAY_MS,
  isRetryableTransientError,
  transientRetryDelayMs,
  retryTransientQuery,
} from "./retry";

/**
 * Mirrors the `ApiError` shape `@/lib/api` throws, without importing it: the
 * policy module classifies errors structurally, and these tests must keep
 * doing the same so a refactor of the HTTP client cannot quietly change what
 * is considered retryable.
 */
function apiErrorLike(
  kind: "http" | "network" | "timeout" | "aborted",
  status: number | null,
  message = "api failure",
): Error & { kind: string; status: number | null } {
  const err = new Error(message) as Error & {
    kind: string;
    status: number | null;
  };
  err.name = "ApiError";
  err.kind = kind;
  err.status = status;
  return err;
}

describe("TRANSIENT_HTTP_STATUSES", () => {
  it("is exactly 429, 502, 503, 504", () => {
    expect([...TRANSIENT_HTTP_STATUSES]).toEqual([429, 502, 503, 504]);
  });
});

describe("MUTATION_RETRY_DISABLED", () => {
  // Issue #639 / PR #713 rejection: a lost response on a money-moving
  // mutation does not prove the transaction failed, so no mutation may retry
  // automatically. The constant exists so the decision is greppable.
  it("is 0 so no mutation ever retries automatically", () => {
    expect(MUTATION_RETRY_DISABLED).toBe(0);
  });
});

describe("isRetryableTransientError", () => {
  it.each([429, 502, 503, 504])("retries an http %i", (status) => {
    expect(isRetryableTransientError(apiErrorLike("http", status))).toBe(true);
  });

  it.each([400, 401, 403, 404, 409, 422, 500, 501])(
    "does not retry an http %i",
    (status) => {
      expect(isRetryableTransientError(apiErrorLike("http", status))).toBe(
        false,
      );
    },
  );

  it("retries a network-kind error", () => {
    expect(isRetryableTransientError(apiErrorLike("network", null))).toBe(true);
  });

  it("retries a timeout-kind error", () => {
    expect(isRetryableTransientError(apiErrorLike("timeout", null))).toBe(true);
  });

  it("does not retry an http error with no status", () => {
    expect(isRetryableTransientError(apiErrorLike("http", null))).toBe(false);
  });

  it("decides an http error on status alone, ignoring its message", () => {
    // A 400 whose body happens to mention "network" must stay non-retryable.
    const err = apiErrorLike("http", 400, "network validation failed");
    expect(isRetryableTransientError(err)).toBe(false);
  });

  describe("aborted errors are never retried", () => {
    it("does not retry the kind:'aborted' shape", () => {
      expect(isRetryableTransientError(apiErrorLike("aborted", null))).toBe(
        false,
      );
    });

    it("does not retry an AbortError DOMException", () => {
      const err = new DOMException("The operation was aborted.", "AbortError");
      expect(err.name).toBe("AbortError");
      expect(isRetryableTransientError(err)).toBe(false);
    });

    it("does not retry a plain Error named AbortError", () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      expect(isRetryableTransientError(err)).toBe(false);
    });

    it("prefers abort over an otherwise transient message", () => {
      // A cancelled fetch can surface with a connectivity-sounding message;
      // a deliberate cancellation must not become a retry or a server error.
      const err = new Error("network request aborted by the user");
      err.name = "AbortError";
      expect(isRetryableTransientError(err)).toBe(false);
    });

    it("prefers abort over a transient status", () => {
      const err = apiErrorLike("aborted", 503);
      expect(isRetryableTransientError(err)).toBe(false);
    });
  });

  describe("plain Error message heuristics", () => {
    it.each([
      "Failed to fetch",
      "fetch failed",
      "Network request failed",
      "The operation timed out",
      "socket hang up",
      "ECONNRESET",
      "ETIMEDOUT",
    ])("retries a plain Error whose message reads %s", (message) => {
      expect(isRetryableTransientError(new Error(message))).toBe(true);
    });

    it.each([
      "Wallet not connected",
      "Insufficient shares",
      "Pool full",
      "Invoice already repaid",
    ])("does not retry a plain Error whose message reads %s", (message) => {
      expect(isRetryableTransientError(new Error(message))).toBe(false);
    });

    it("matches message markers case-insensitively", () => {
      expect(isRetryableTransientError(new Error("TIMEOUT"))).toBe(true);
    });
  });

  describe("bare status objects", () => {
    it.each([429, 502, 503, 504])("retries { status: %i }", (status) => {
      expect(isRetryableTransientError({ status })).toBe(true);
    });

    it("does not retry { status: 404 }", () => {
      expect(isRetryableTransientError({ status: 404 })).toBe(false);
    });

    it("does not retry a non-numeric status", () => {
      expect(isRetryableTransientError({ status: "503" })).toBe(false);
    });

    it("does not retry a non-integer status", () => {
      expect(isRetryableTransientError({ status: 503.5 })).toBe(false);
    });
  });

  describe("odd inputs are classified, not thrown on", () => {
    it.each([
      ["null", null],
      ["undefined", undefined],
      ["a string", "503 Service Unavailable"],
      ["a number", 503],
      ["an empty object", {}],
      ["a boolean", false],
      ["an array", []],
    ])("treats %s as non-retryable", (_label, value) => {
      expect(() => isRetryableTransientError(value)).not.toThrow();
      expect(isRetryableTransientError(value)).toBe(false);
    });

    it("tolerates an unknown kind by falling back to the heuristics", () => {
      const err = apiErrorLike("weird" as "http", null, "connection timed out");
      expect(isRetryableTransientError(err)).toBe(true);
    });

    it("tolerates an object with a non-string message", () => {
      expect(isRetryableTransientError({ message: 42 })).toBe(false);
    });
  });
});

describe("transientRetryDelayMs", () => {
  it("returns the base delay for the first retry", () => {
    expect(transientRetryDelayMs(0)).toBe(TRANSIENT_RETRY_BASE_DELAY_MS);
  });

  it("is deterministic across calls (no jitter)", () => {
    const first = Array.from({ length: 5 }, (_, i) => transientRetryDelayMs(i));
    const second = Array.from({ length: 5 }, (_, i) =>
      transientRetryDelayMs(i),
    );
    expect(first).toEqual(second);
  });

  it("doubles each attempt with the default base", () => {
    expect(transientRetryDelayMs(0)).toBe(300);
    expect(transientRetryDelayMs(1)).toBe(600);
    expect(transientRetryDelayMs(2)).toBe(1200);
    expect(transientRetryDelayMs(3)).toBe(2400);
  });

  it("increases strictly while below the cap", () => {
    const delays = [0, 1, 2, 3, 4].map((i) => transientRetryDelayMs(i));
    for (let i = 1; i < delays.length; i += 1) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });

  it("is monotonically non-decreasing once capped", () => {
    const delays = Array.from({ length: 12 }, (_, i) =>
      transientRetryDelayMs(i),
    );
    for (let i = 1; i < delays.length; i += 1) {
      expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
    }
  });

  it("never exceeds the cap, even for absurd attempt counts", () => {
    for (const index of [10, 50, 1000, Number.MAX_SAFE_INTEGER]) {
      const delay = transientRetryDelayMs(index);
      expect(delay).toBeLessThanOrEqual(TRANSIENT_RETRY_MAX_DELAY_MS);
      expect(Number.isFinite(delay)).toBe(true);
    }
  });

  it("honours an explicit base delay", () => {
    expect(transientRetryDelayMs(0, 50)).toBe(50);
    expect(transientRetryDelayMs(2, 50)).toBe(200);
  });

  it("treats negative and non-finite attempt indexes as the first attempt", () => {
    expect(transientRetryDelayMs(-5)).toBe(TRANSIENT_RETRY_BASE_DELAY_MS);
    expect(transientRetryDelayMs(Number.NaN)).toBe(
      TRANSIENT_RETRY_BASE_DELAY_MS,
    );
    expect(transientRetryDelayMs(Number.POSITIVE_INFINITY)).toBe(
      TRANSIENT_RETRY_BASE_DELAY_MS,
    );
  });

  it("floors a fractional attempt index", () => {
    expect(transientRetryDelayMs(1.9)).toBe(transientRetryDelayMs(1));
  });

  it("falls back to the default base for an invalid base delay", () => {
    expect(transientRetryDelayMs(0, -1)).toBe(TRANSIENT_RETRY_BASE_DELAY_MS);
    expect(transientRetryDelayMs(0, Number.NaN)).toBe(
      TRANSIENT_RETRY_BASE_DELAY_MS,
    );
  });
});

describe("retryTransientQuery", () => {
  const transient = apiErrorLike("http", 503);

  it("retries a transient failure while within budget", () => {
    // react-query passes a zero-based failureCount, so indexes 0..N-1 are the
    // N permitted retries.
    for (let i = 0; i < MAX_TRANSIENT_QUERY_RETRIES; i += 1) {
      expect(retryTransientQuery(i, transient)).toBe(true);
    }
  });

  it("stops once MAX_TRANSIENT_QUERY_RETRIES is reached", () => {
    expect(retryTransientQuery(MAX_TRANSIENT_QUERY_RETRIES, transient)).toBe(
      false,
    );
    expect(
      retryTransientQuery(MAX_TRANSIENT_QUERY_RETRIES + 1, transient),
    ).toBe(false);
    expect(retryTransientQuery(99, transient)).toBe(false);
  });

  it("allows exactly MAX_TRANSIENT_QUERY_RETRIES retries", () => {
    const allowed = Array.from({ length: 10 }, (_, i) =>
      retryTransientQuery(i, transient),
    ).filter(Boolean);
    expect(allowed).toHaveLength(MAX_TRANSIENT_QUERY_RETRIES);
  });

  it("does not retry a non-transient failure even at failureCount 0", () => {
    expect(retryTransientQuery(0, apiErrorLike("http", 404))).toBe(false);
    expect(retryTransientQuery(0, new Error("Wallet not connected"))).toBe(
      false,
    );
  });

  it("does not retry an aborted request", () => {
    expect(retryTransientQuery(0, apiErrorLike("aborted", null))).toBe(false);
    expect(
      retryTransientQuery(0, new DOMException("aborted", "AbortError")),
    ).toBe(false);
  });

  it("does not retry on a non-finite failureCount", () => {
    expect(retryTransientQuery(Number.NaN, transient)).toBe(false);
  });

  it("does not throw on odd error values", () => {
    for (const value of [null, undefined, "boom", {}, 503]) {
      expect(() => retryTransientQuery(0, value)).not.toThrow();
      expect(retryTransientQuery(0, value)).toBe(false);
    }
  });
});
