import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { signTransaction } from "@stellar/freighter-api";
import { useAuth } from "@/hooks/useAuth";
import { useWalletStore } from "@/store/wallet";
import { apiClient } from "@/lib/api";

// Regression lock-in for issue #637 - "`apiClient` keeps a stale bearer token
// after logout, sending it on subsequent requests."
//
// The cached-token shape of that bug is gone by design: `apiClient` is a
// stateless facade over `apiFetch`, which reads
// `useWalletStore.getState().token` on every call, so there is no second copy
// of the credential to go stale (apps/web/lib/api.ts). There is therefore no
// `setToken`/`clearToken`/`initApiClientWithToken` left to assert against, and
// re-introducing one would re-create the very cache the current design removed.
//
// What these cases lock in instead is the property the issue actually asked
// for, end to end through the real store, the real `apiFetch` and the real
// `useAuth().logout`, with only the wallet extension and `fetch` stubbed:
//   1. an authenticated session sends `Authorization: Bearer <jwt>`;
//   2. after `logout()` the header is absent entirely - not empty, not stale;
//   3. a JWT arriving from a login that was still in flight when `logout()`
//      ran is discarded instead of resurrecting the session (the race-shaped
//      version of the same bug, fixed in `useAuth` via its session guard);
//   4. the JWT never reaches `localStorage`;
//   5. no console sink ever receives a credential value.
// Reverting any of those should turn these cases red.

vi.mock("@stellar/freighter-api", () => ({
  signTransaction: vi.fn(),
}));

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

const ADDRESS = "GTESTADDRESS637";
const CHALLENGE_XDR = "challenge_xdr_637";
const SIGNED_XDR = "signed_xdr_637";
const JWT = "jwt.637.stale-token-must-not-survive-logout";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const WALLET_STORAGE_KEY = "wallet-storage";

interface RecordedRequest {
  url: string;
  method: string;
  headers: Headers;
}

/** Every request the mocked `fetch` saw, in order. */
let requests: RecordedRequest[] = [];

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

/**
 * Routes the SEP-10 endpoints and records every request so the tests can
 * inspect the headers `apiFetch` actually put on the wire. `verifyChallenge`
 * resolves through `verifyBody` so individual cases can delay or fail it.
 */
function installFetchMock(options?: {
  verify?: () => Promise<Response>;
}): void {
  const mockFetch = vi.fn(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const method = init?.method ?? "GET";
      requests.push({ url, method, headers: new Headers(init?.headers) });

      if (url.startsWith(`${API_BASE}/auth`) && method === "GET") {
        return Promise.resolve(
          jsonResponse({
            transaction: CHALLENGE_XDR,
            network_passphrase: NETWORK_PASSPHRASE,
          }),
        );
      }
      if (url.startsWith(`${API_BASE}/auth`) && method === "POST") {
        return options?.verify
          ? options.verify()
          : Promise.resolve(jsonResponse({ token: JWT }));
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    },
  );

  global.fetch = mockFetch as unknown as typeof fetch;
}

/** The `Authorization` header of the last recorded request, if any. */
function lastAuthorizationHeader(): string | null {
  const last = requests[requests.length - 1];
  if (!last) throw new Error("no request was recorded");
  return last.headers.get("Authorization");
}

function lastRequestHasAuthorization(): boolean {
  const last = requests[requests.length - 1];
  if (!last) throw new Error("no request was recorded");
  return last.headers.has("Authorization");
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Flattens an arbitrary logged argument into one searchable string.
 *
 * `JSON.stringify` renders an `Error` as `{}`, which would hide exactly the
 * leak this audit is looking for, so errors contribute their name, message and
 * stack, and own properties (`AppError.originalError`, `cause`, ...) are walked
 * recursively.
 */
function stringifyArg(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "string") return value;
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[circular]";
  seen.add(value);

  const parts: string[] = [];
  if (value instanceof Error) {
    parts.push(value.name, value.message, value.stack ?? "");
  }
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    parts.push(key, stringifyArg(inner, seen));
  }
  return parts.join(" ");
}

/** Drives a full, successful SEP-10 login through the real hook. */
async function loginWith(result: {
  current: ReturnType<typeof useAuth>;
}): Promise<void> {
  vi.mocked(signTransaction).mockResolvedValue(SIGNED_XDR);
  await act(async () => {
    await result.current.login();
  });
}

describe("Regression: auth token lifecycle after logout (#637)", () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    requests = [];
    localStorage.clear();
    useWalletStore.getState().disconnect();
    installFetchMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = realFetch;
  });

  it("sends Authorization: Bearer <jwt> while the session is authenticated", async () => {
    act(() => {
      useWalletStore.getState().connect(ADDRESS, "testnet");
    });

    const { result } = renderHook(() => useAuth());
    await loginWith(result);

    expect(result.current.isAuthenticated).toBe(true);
    expect(useWalletStore.getState().token).toBe(JWT);

    await apiClient.fetch("/invoices");

    expect(lastRequestHasAuthorization()).toBe(true);
    expect(lastAuthorizationHeader()).toBe(`Bearer ${JWT}`);
  });

  it("sends no Authorization header at all once logout() has run", async () => {
    act(() => {
      useWalletStore.getState().connect(ADDRESS, "testnet");
    });

    const { result } = renderHook(() => useAuth());
    await loginWith(result);
    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(useWalletStore.getState().token).toBeNull();

    await apiClient.fetch("/invoices");

    // Absent, not merely empty: a blank `Authorization` header would still be
    // a behavioural change for the API and would mask a half-cleared token.
    expect(lastRequestHasAuthorization()).toBe(false);
    expect(lastAuthorizationHeader()).toBeNull();

    // And it stays absent for every later request, not just the first one.
    await apiClient.fetch("/pool/stats");
    expect(lastRequestHasAuthorization()).toBe(false);
  });

  it("discards a JWT that arrives from a login still in flight at logout()", async () => {
    const verify = deferred<Response>();
    installFetchMock({ verify: () => verify.promise });

    act(() => {
      useWalletStore.getState().connect(ADDRESS, "testnet");
    });
    vi.mocked(signTransaction).mockResolvedValue(SIGNED_XDR);

    const { result } = renderHook(() => useAuth());

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.login();
    });

    // The user logs out while the verify request is still outstanding.
    act(() => {
      result.current.logout();
    });
    expect(result.current.loading).toBe(false);

    // The indexer now answers the abandoned request with a perfectly valid JWT.
    await act(async () => {
      verify.resolve(jsonResponse({ token: JWT }));
      await pending;
    });

    expect(useWalletStore.getState().token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);

    await apiClient.fetch("/invoices");
    expect(lastRequestHasAuthorization()).toBe(false);
  });

  it("never writes the JWT to localStorage", async () => {
    act(() => {
      useWalletStore.getState().connect(ADDRESS, "testnet");
    });

    const { result } = renderHook(() => useAuth());
    await loginWith(result);
    expect(useWalletStore.getState().token).toBe(JWT);

    // The store is `persist`-wrapped, so the key exists - it just must not
    // carry the credential (`partialize` keeps `role` only).
    const raw = localStorage.getItem(WALLET_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(raw).not.toContain(JWT);
    expect(JSON.parse(raw as string).state).toEqual({ role: "issuer" });

    // Nothing else on the origin picked it up either.
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      expect(localStorage.getItem(key as string)).not.toContain(JWT);
    }

    act(() => {
      result.current.logout();
    });
    expect(localStorage.getItem(WALLET_STORAGE_KEY)).not.toContain(JWT);
  });

  it("passes no credential value to console across a login-failure and logout cycle", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    act(() => {
      useWalletStore.getState().connect(ADDRESS, "testnet");
    });

    const { result } = renderHook(() => useAuth());

    // A successful login first, so a real credential is in play.
    await loginWith(result);
    expect(useWalletStore.getState().token).toBe(JWT);

    // Then a failing verify, which routes through `createErrorHandler`'s
    // `captureError` and therefore does reach `console.error`.
    installFetchMock({
      verify: () =>
        Promise.resolve(jsonResponse({ error: "Invalid signature" }, 401)),
    });
    await loginWith(result);
    expect(result.current.error).toBe("Invalid signature");

    act(() => {
      result.current.logout();
    });

    // Guard against a vacuous pass: the cycle must have logged something.
    const calls = [
      ...logSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
    ];
    expect(calls.length).toBeGreaterThan(0);

    for (const call of calls) {
      for (const arg of call) {
        const text = stringifyArg(arg);
        expect(text).not.toContain(JWT);
        expect(text).not.toContain(SIGNED_XDR);
      }
    }
  });
});
