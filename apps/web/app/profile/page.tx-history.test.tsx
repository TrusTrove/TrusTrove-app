import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "@/app/profile/page";
import { useTxHistory } from "@/hooks/useTxHistory";

const { wallet, history } = vi.hoisted(() => ({
  wallet: {
    connected: true,
    address: "GTESTADDRESS" as string | null,
  },
  history: {
    transactions: [],
    isLoading: false,
    error: null,
    hasNext: false,
    hasPrev: false,
    goNext: vi.fn(),
    goPrev: vi.fn(),
    page: 1,
    refetch: vi.fn(),
  },
}));

vi.mock("@/store/wallet", () => ({
  useWalletStore: (selector: any) => (selector ? selector(wallet) : wallet),
}));

vi.mock("@/hooks/useTxHistory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useTxHistory")>();
  return { ...actual, useTxHistory: vi.fn(() => history) };
});

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: null,
    isProfileLoading: false,
    isVerified: false,
    isVerifiedLoading: false,
    register: vi.fn(),
    isRegistering: false,
    registerError: null,
  }),
}));

vi.mock("@/components/shared/PageLayout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => (
    <main id="main-content" tabIndex={-1}>
      {children}
    </main>
  ),
}));

vi.mock("@/components/shared/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/shared/WalletConnect", () => ({
  WalletConnect: () => null,
}));

vi.mock("@/components/shared/TransactionPending", () => ({
  TransactionPending: () => null,
}));

describe("Profile transaction history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wallet.connected = true;
    wallet.address = "GTESTADDRESS";
    history.transactions = [];
    history.isLoading = false;
    history.error = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the labelled history section for a connected wallet", () => {
    render(<ProfilePage />);

    expect(
      screen.getByRole("heading", { name: "Transaction History", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Transaction History" }),
    ).toBeInTheDocument();
    expect(useTxHistory).toHaveBeenCalledWith("GTESTADDRESS");
    expect(
      screen.getByText("No TrusTrove transactions found for this wallet."),
    ).toBeInTheDocument();
  });

  it("keeps the section's loading state in place while history loads", () => {
    history.isLoading = true;

    render(<ProfilePage />);

    expect(
      screen.getByRole("region", { name: "Transaction History" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No TrusTrove transactions found for this wallet."),
    ).not.toBeInTheDocument();
  });

  it("does not render the history section without a connected wallet", () => {
    wallet.connected = false;
    wallet.address = null;

    render(<ProfilePage />);

    expect(
      screen.queryByRole("heading", { name: "Transaction History" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Transaction History" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Connect Your Wallet" }),
    ).toBeInTheDocument();
  });
});
