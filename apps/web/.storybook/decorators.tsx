import React from "react";
import type { Decorator } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useConfirmDialogStore, type PendingAction } from "@/store/confirmDialog";
import { useWalletStore } from "@/store/wallet";
import type { EventLog, Invoice, TxHistoryItem } from "@/types";

import { STORY_ADDRESS, mockProfile, mockTxHistory } from "./mockData";
import {
  __setFreighterSimulation,
  type FreighterSimulation,
} from "./mocks/freighter-api";

/**
 * Storybook plumbing that lets components which talk to Soroban / Horizon /
 * Freighter render offline.
 *
 * The components in this app read their data through `@tanstack/react-query`
 * hooks and two Zustand stores. Both are easy to satisfy without a network:
 *
 * - **react-query**: seed the cache with `setQueryData` for the exact key each
 *   hook asks for. A seeded query with an infinite `staleTime` never fetches,
 *   so the story renders the loaded state deterministically. Pass a key in
 *   `pending` instead to leave it permanently loading, which is how the
 *   skeleton states are captured.
 * - **Zustand**: set the store state directly before the story renders.
 * - **Freighter**: `withFreighterSimulation` drives the aliased stub in
 *   `./mocks/freighter-api`.
 *
 * `wallet` defaults to a *connected testnet issuer*, which is the state most
 * action-bearing components need; pass `wallet: null` to render the
 * disconnected variants.
 */

export type QuerySeed = readonly [readonly unknown[], unknown];

export interface StoryWalletState {
  address?: string | null;
  connected?: boolean;
  network?: string | null;
  role?: "issuer" | "buyer" | "lp";
}

export interface StoryProviderOptions {
  /** react-query cache entries, one per hook query key the story needs. */
  query?: QuerySeed[];
  /** Query keys to leave in a permanent loading state (no network). */
  pending?: readonly unknown[][];
  /** Wallet store state; `null` renders the disconnected wallet. */
  wallet?: StoryWalletState | null;
  /** Confirm-dialog store state (controls `ConfirmationDialog`). */
  pendingAction?: PendingAction | null;
}

function createSeededQueryClient(
  seed: QuerySeed[],
  pendingKeys: readonly unknown[][],
): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // Seeded data is treated as permanently fresh, so the query never
        // issues a request and never refetches on remount.
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { retry: false },
    },
  });

  for (const [key, data] of seed) {
    client.setQueryData(key, data);
  }

  // Kick off a query whose promise never settles: the component sees
  // `isLoading`, and because a fetch is already in flight no request is made.
  for (const queryKey of pendingKeys) {
    void client.prefetchQuery({
      queryKey,
      queryFn: () => new Promise<never>(() => {}),
    });
  }

  return client;
}

export function withStoryProviders(
  options: StoryProviderOptions = {},
): Decorator {
  return (Story) => {
    const wallet =
      options.wallet === null
        ? null
        : {
            address: STORY_ADDRESS,
            connected: true,
            network: "testnet",
            role: "issuer" as const,
            ...options.wallet,
          };

    // Applied before the story renders, so the components' first render
    // already sees the intended store state (no disconnected flash).
    useWalletStore.setState({
      address: wallet?.address ?? null,
      connected: wallet?.connected ?? false,
      network: wallet?.network ?? null,
      role: wallet?.role ?? "issuer",
    });

    if (options.pendingAction !== undefined) {
      useConfirmDialogStore.setState({
        pendingAction: options.pendingAction,
      });
    }

    const [client] = React.useState(() =>
      createSeededQueryClient(options.query ?? [], options.pending ?? []),
    );

    return (
      <QueryClientProvider client={client}>
        <Story />
      </QueryClientProvider>
    );
  };
}

/** Shorthand for the common case of "connected wallet, no cached queries". */
export const withConnectedWallet = withStoryProviders();

/**
 * Drive the aliased Freighter stub. Defaults to "installed and available",
 * which is what wallet components need in order to render their interactive
 * state; pass `{ connected: false }` for the extension-missing branch.
 */
export function withFreighterSimulation(
  simulation: Partial<FreighterSimulation> = {},
): Decorator {
  return (Story) => {
    __setFreighterSimulation({
      connected: true,
      userRejects: false,
      network: "testnet",
      ...simulation,
    });
    return <Story />;
  };
}

// ── Query-seed builders ────────────────────────────────────────────────
// One per hook query key, so a story can name exactly the data it needs.

/** `useProfile` — profile + on-chain verification flag. */
export function profileSeeds(
  address: string = STORY_ADDRESS,
  isVerified = true,
): QuerySeed[] {
  return [
    [["isVerified", address], isVerified],
    [["profile", address], isVerified ? mockProfile : null],
  ];
}

/** `useBalances` — XLM/USDC balances shown in the navbar. */
export function balanceSeeds(
  address: string = STORY_ADDRESS,
  balances: { usdc: string | null; xlm: string | null } = {
    usdc: "12500.00",
    xlm: "250.00",
  },
): QuerySeed[] {
  return [[["balances", address, true], balances]];
}

/** `useRecentEvents` — powers `InvoiceFeed` and `TopStatusBar`. */
export function eventSeeds(events: EventLog[], limit: number): QuerySeed[] {
  return [[["recentEvents", limit], events]];
}

/** `useTxHistory` — paginated contract activity for `TxHistory`. */
export function txSeeds(
  items: TxHistoryItem[] = mockTxHistory(3),
  address: string = STORY_ADDRESS,
): QuerySeed[] {
  return [[["txHistory", address, undefined], { items, nextCursor: null }]];
}

/** `useInvoicesList` — the paginated invoice ledger. */
export function invoiceListSeeds(payload: {
  data: Invoice[];
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}): QuerySeed[] {
  return [[["invoices", undefined], payload]];
}
