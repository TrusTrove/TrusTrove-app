import { createElement, type ReactNode } from "react";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAllInvoices, getLPPosition, getPoolStats } from "@/lib/api";
import { useWalletStore } from "@/store/wallet";
import { usePool } from "@/hooks/usePool";
import { useProfile } from "@/hooks/useProfile";
import { useInvoiceStats } from "@/hooks/useInvoices";
import { useTxHistory } from "@/hooks/useTxHistory";
import { useNotifications } from "@/hooks/useNotifications";

// Regression lock-in for issue #636: the persisted wallet store used to keep
// `address` while resetting `connected`, so after a reload the UI rendered as
// disconnected (it checks `connected && address`) while every hook that gated
// purely on `!!address` happily fetched against the rehydrated address.
//
// apps/web/store/wallet.ts now discards the stale session fields on rehydrate,
// and the consumer hooks additionally require `connected`. These cases lock in
// the consumer half: nothing keyed on the wallet address may fetch while the
// store reports the wallet as disconnected, and the gate must still open once
// the wallet is genuinely connected.
//
// React Query is real here, so `enabled` decides whether a fetch happens; every
// fetcher is mocked, so a recorded call can only come from an enabled query.

const STALE_ADDRESS = "GSTALEADDRESSFROMLEGACYSTORAGE";
const LIVE_ADDRESS = "GLIVECONNECTEDWALLETADDRESS";

const getProfileMock = vi.fn();
const isVerifiedMock = vi.fn();
const horizonTransactionsCall = vi.fn();

/** `enabled` flags that `useNotifications` passed to its two wallet feeds. */
const recentEventsEnabled: (boolean | undefined)[] = [];
const invoicesListEnabled: (boolean | undefined)[] = [];

// Stable empty results: `useNotifications` lists its feed arrays in an effect's
// dependencies, so a fresh array per render would re-run the effect, re-set
// state and spin forever. That is pre-existing behaviour of the hook and not
// what these cases are about.
const NO_EVENTS: never[] = [];
const NO_INVOICES: never[] = [];

vi.mock("@/lib/api", () => ({
  getPoolStats: vi.fn(),
  getLPPosition: vi.fn(),
  getAllInvoices: vi.fn(),
  getInvoices: vi.fn(),
  getInvoiceByID: vi.fn(),
  createInvoice: vi.fn(),
  getRecentEvents: vi.fn(),
}));

// The real SDKs are replaced outright rather than spread over: `@/types` only
// re-exports types from @trusttrove/sdk, so nothing in this module graph needs
// the real implementations, and loading them is slow and network-capable.
vi.mock("@trusttrove/sdk", () => ({
  configureSDK: vi.fn(),
  RegistryClient: class {
    getProfile = getProfileMock;
    isVerified = isVerifiedMock;
  },
  PoolClient: class {
    deposit = vi.fn();
    withdraw = vi.fn();
  },
  InvoiceClient: class {},
}));

vi.mock("@stellar/stellar-sdk", () => {
  const transactionsBuilder = {
    forAccount: () => transactionsBuilder,
    limit: () => transactionsBuilder,
    order: () => transactionsBuilder,
    cursor: () => transactionsBuilder,
    call: () => horizonTransactionsCall(),
  };
  return {
    Horizon: {
      Server: class {
        transactions = () => transactionsBuilder;
        operations = () => ({
          forTransaction: () => ({
            limit: () => ({ call: async () => ({ records: [] }) }),
          }),
        });
      },
    },
  };
});

// `useNotifications` reaches its queries through these two hooks, so the gate it
// applies is observable as the `enabled` flag it hands them.
vi.mock("@/hooks/useEvents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useEvents")>();
  return {
    ...actual,
    useRecentEvents: (_limit?: number, options?: { enabled?: boolean }) => {
      recentEventsEnabled.push(options?.enabled);
      return {
        events: NO_EVENTS,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
    },
  };
});

vi.mock("@/hooks/useInvoices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useInvoices")>();
  return {
    ...actual,
    // `useInvoiceStats` stays real — it is one of the hooks under test.
    useInvoicesList: (filters?: { enabled?: boolean }) => {
      invoicesListEnabled.push(filters?.enabled);
      return {
        invoices: NO_INVOICES,
        total: 0,
        totalPages: 1,
        page: 1,
        limit: 20,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
    },
  };
});

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

/** Every mocked fetcher that an address-keyed query would reach. */
function addressKeyedFetchers() {
  return [
    vi.mocked(getLPPosition),
    vi.mocked(getAllInvoices),
    getProfileMock,
    isVerifiedMock,
    horizonTransactionsCall,
  ];
}

/**
 * Renders every hook that owns an address-keyed query, passing the address
 * explicitly where the hook takes it as an argument. Passing the stale address
 * is the point: it reproduces a component that still holds a rehydrated address
 * while the store reports the wallet as disconnected.
 */
function renderAddressKeyedHooks(address: string) {
  const rendered = [
    renderHook(() => usePool(), { wrapper }),
    renderHook(() => useProfile(), { wrapper }),
    renderHook(() => useInvoiceStats(address), { wrapper }),
    renderHook(() => useTxHistory(address), { wrapper }),
    renderHook(() => useNotifications(), { wrapper }),
  ];
  return () => rendered.forEach((r) => r.unmount());
}

/**
 * Lets React Query settle: it resolves `enabled` and dispatches its fetches on
 * tasks queued after mount. Two macrotask turns are enough for a fetch to have
 * started, which the "wallet is connected" case proves by observing real calls
 * after this very same flush.
 */
async function flushQueries() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("Regression: address-keyed queries follow the wallet `connected` flag (#636)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    recentEventsEnabled.length = 0;
    invoicesListEnabled.length = 0;
    useWalletStore.getState().disconnect();

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    vi.mocked(getPoolStats).mockResolvedValue({} as never);
    vi.mocked(getLPPosition).mockResolvedValue({} as never);
    vi.mocked(getAllInvoices).mockResolvedValue([]);
    getProfileMock.mockResolvedValue(null);
    isVerifiedMock.mockResolvedValue(false);
    horizonTransactionsCall.mockResolvedValue({ records: [] });
  });

  afterEach(() => {
    queryClient.clear();
    useWalletStore.getState().disconnect();
  });

  it("rehydrating a persisted-but-stale store leaves it disconnected with every address-keyed query off", async () => {
    // The legacy persisted shape: `address`/`network`/`token` were written to
    // storage, `connected` was not.
    localStorage.setItem(
      "wallet-storage",
      JSON.stringify({
        state: {
          address: STALE_ADDRESS,
          network: "testnet",
          token: "stale-token",
          role: "lp",
        },
        version: 0,
      }),
    );

    await act(async () => {
      await useWalletStore.persist.rehydrate();
    });

    // The store half of the fix: no wallet-session field survives the reload.
    const rehydrated = useWalletStore.getState();
    expect(rehydrated.address).toBeNull();
    expect(rehydrated.connected).toBe(false);
    expect(rehydrated.network).toBeNull();
    expect(rehydrated.token).toBeNull();
    // Preferences do survive, which is why the desync was reachable at all.
    expect(rehydrated.role).toBe("lp");

    const unmountAll = renderAddressKeyedHooks(STALE_ADDRESS);
    await flushQueries();

    for (const fetcher of addressKeyedFetchers()) {
      expect(fetcher).not.toHaveBeenCalled();
    }
    expect(recentEventsEnabled).not.toContain(true);
    expect(invoicesListEnabled).not.toContain(true);

    unmountAll();
  });

  it("does not run an address-keyed query while `connected` is false even though `address` is set", async () => {
    // The exact desync state the old store produced: an address with no live
    // connection behind it.
    act(() => {
      useWalletStore.setState({
        address: STALE_ADDRESS,
        connected: false,
        network: "testnet",
      });
    });

    const unmountAll = renderAddressKeyedHooks(STALE_ADDRESS);
    await flushQueries();

    for (const fetcher of addressKeyedFetchers()) {
      expect(fetcher).not.toHaveBeenCalled();
    }
    expect(recentEventsEnabled).not.toContain(true);
    expect(invoicesListEnabled).not.toContain(true);

    unmountAll();
  });

  it("keeps fetching pool stats, which are not keyed on the wallet", async () => {
    act(() => {
      useWalletStore.setState({ address: STALE_ADDRESS, connected: false });
    });

    const { unmount } = renderHook(() => usePool(), { wrapper });
    await flushQueries();

    // Proves the gate is scoped to the wallet-keyed query rather than switching
    // the whole hook off.
    expect(getPoolStats).toHaveBeenCalled();
    expect(getLPPosition).not.toHaveBeenCalled();

    unmount();
  });

  it("runs the address-keyed queries once the wallet is genuinely connected", async () => {
    act(() => {
      useWalletStore.getState().connect(LIVE_ADDRESS, "testnet");
    });

    const unmountAll = renderAddressKeyedHooks(LIVE_ADDRESS);
    await flushQueries();

    // Same hooks, same flush as the disabled cases above: the gate opens.
    expect(getLPPosition).toHaveBeenCalledWith(LIVE_ADDRESS);
    expect(getAllInvoices).toHaveBeenCalledWith({ issuer: LIVE_ADDRESS });
    expect(getProfileMock).toHaveBeenCalledWith(LIVE_ADDRESS, LIVE_ADDRESS);
    expect(isVerifiedMock).toHaveBeenCalledWith(LIVE_ADDRESS, LIVE_ADDRESS);
    expect(horizonTransactionsCall).toHaveBeenCalled();
    expect(recentEventsEnabled.at(-1)).toBe(true);
    expect(invoicesListEnabled.at(-1)).toBe(true);

    unmountAll();
  });

  it("stops fetching again when the wallet disconnects", async () => {
    act(() => {
      useWalletStore.getState().connect(LIVE_ADDRESS, "testnet");
    });

    const unmountAll = renderAddressKeyedHooks(LIVE_ADDRESS);
    await flushQueries();
    expect(getLPPosition).toHaveBeenCalledTimes(1);

    for (const fetcher of addressKeyedFetchers()) {
      fetcher.mockClear();
    }
    act(() => {
      useWalletStore.getState().disconnect();
    });
    await flushQueries();

    for (const fetcher of addressKeyedFetchers()) {
      expect(fetcher).not.toHaveBeenCalled();
    }
    expect(recentEventsEnabled.at(-1)).toBe(false);
    expect(invoicesListEnabled.at(-1)).toBe(false);

    unmountAll();
  });
});
