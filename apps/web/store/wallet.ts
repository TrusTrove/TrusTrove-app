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
        role: state.role,
      }),
      // A browser reload does not prove that Freighter is still connected.
      // Restore preferences only, and discard legacy persisted session fields so
      // consumers never query with an address while the UI is disconnected.
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<WalletState> | undefined;

        return {
          ...currentState,
          address: null,
          connected: false,
          network: null,
          token: null,
          role: persisted?.role ?? currentState.role,
        };
      },
    },
  ),
);
