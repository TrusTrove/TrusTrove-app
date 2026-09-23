/**
 * Storybook-only stand-in for `@stellar/freighter-api`.
 *
 * `.storybook/main.ts` aliases the real package to this module for the
 * Storybook build, so no story depends on the Freighter browser extension
 * being installed. The surface mirrors the parts of the real API this app
 * uses:
 *
 * - `isConnected` / `requestAccess` / `getPublicKey` — `lib/freighter.ts`
 * - `getNetworkDetails` — `hooks/useWallet.ts`
 * - `setNetwork` — `components/shared/WalletConnect.tsx`
 * - `signTransaction` — `hooks/useAuth.ts` and `@trusttrove/sdk`
 *
 * The simulated extension state lives on a global so a story decorator can
 * flip it (see `withFreighterSimulation` in `../decorators`). It defaults to
 * "extension installed, connected to testnet"; the *wallet* connected state is
 * driven separately by the wallet Zustand store.
 */
export interface FreighterSimulation {
  /** Whether the simulated extension reports itself as connected/installed. */
  connected: boolean;
  /** Address returned by `requestAccess` / `getPublicKey`. */
  address: string;
  /** Network reported by `getNetworkDetails` and set by `setNetwork`. */
  network: string;
  /** When true, `requestAccess` resolves with a user-rejection error. */
  userRejects: boolean;
}

const DEFAULT_ADDRESS =
  "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";

type SimulationHolder = typeof globalThis & {
  __FREIGHTER_SIM__?: FreighterSimulation;
};

function simulation(): FreighterSimulation {
  const holder = globalThis as SimulationHolder;
  holder.__FREIGHTER_SIM__ ??= {
    connected: true,
    address: DEFAULT_ADDRESS,
    network: "testnet",
    userRejects: false,
  };
  return holder.__FREIGHTER_SIM__;
}

/** Update the simulated extension state from a story decorator. */
export function __setFreighterSimulation(
  patch: Partial<FreighterSimulation>,
): void {
  Object.assign(simulation(), patch);
}

export async function isConnected(): Promise<{ isConnected: boolean }> {
  return { isConnected: simulation().connected };
}

export async function requestAccess(): Promise<
  { address: string } | { error: string }
> {
  const sim = simulation();
  if (!sim.connected) {
    return { error: "Freighter wallet is not installed" };
  }
  if (sim.userRejects) {
    return { error: "User rejected this request" };
  }
  return { address: sim.address };
}

export async function getPublicKey(): Promise<{ address: string }> {
  return { address: simulation().address };
}

export async function getNetworkDetails(): Promise<{
  network: string;
  networkPassphrase: string;
  networkUrl: string;
  sorobanRpcUrl: string;
}> {
  const { network } = simulation();
  return {
    network,
    networkPassphrase:
      network.toLowerCase() === "testnet"
        ? "Test SDF Network ; September 2015"
        : "Public Global Stellar Network ; September 2015",
    networkUrl: `https://horizon-${network.toLowerCase()}.stellar.org`,
    sorobanRpcUrl: `https://soroban-${network.toLowerCase()}.stellar.org`,
  };
}

export async function setNetwork(
  network: string,
): Promise<{ network: string }> {
  simulation().network = network.toLowerCase();
  return { network: simulation().network };
}

export async function signTransaction(
  transactionXdr: string,
): Promise<{ signedTxXdr: string; signerAddress: string }> {
  return { signedTxXdr: transactionXdr, signerAddress: simulation().address };
}

export default {
  isConnected,
  requestAccess,
  getPublicKey,
  getNetworkDetails,
  setNetwork,
  signTransaction,
};
