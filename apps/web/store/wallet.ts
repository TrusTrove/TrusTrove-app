import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WalletState {
  address: string | null;
  connected: boolean;
  network: string | null;
  token: string | null;
  role: "issuer" | "buyer" | "lp";
  connect: (address: string, network: string) => void;
  disconnect: () => void;
  setAddress: (address: string | null) => void;
  setNetwork: (network: string | null) => void;
  setToken: (token: string | null) => void;
  setRole: (role: "issuer" | "buyer" | "lp") => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      connected: false,
      network: null,
      token: null,
      role: "issuer",
      connect: (address, network) => set({ address, connected: true, network }),
      disconnect: () =>
        set({
          address: null,
          connected: false,
          network: null,
          token: null,
          role: "issuer",
        }),
      setAddress: (address) => set({ address, connected: !!address }),
      setNetwork: (network) => set({ network }),
      setToken: (token) => set({ token }),
      setRole: (role) => set({ role }),
    }),
    {
      name: "wallet-storage",
      partialize: (state) => ({
        address: state.address,
        connected: state.connected,
        network: state.network,
        role: state.role,
      }),
      onRehydrateStorage: () => (state) => {
        // Guard against a stale persisted snapshot (e.g. one written before
        // `connected` was persisted): if we restarted disconnected but an
        // address exists, clear it so address-keyed queries don't fire while
        // the UI (and other consumers) report the wallet as disconnected.
        // NOTE: we mutate the state object handed to the callback rather than
        // calling useWalletStore.setState(), because at rehydration time (which
        // runs synchronously during store creation) the store const is not yet
        // initialised.
        if (state && !state.connected && state.address) {
          state.address = null;
          state.network = null;
        }
      },
    },
  ),
);
