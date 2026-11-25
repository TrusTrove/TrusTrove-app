import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ProfilePage from "@/app/profile/page";

// #990: the profile page's loading block used to be a plain div, so a
// screen-reader user heard nothing while the registry query ran.
vi.mock("@/store/wallet", () => ({
  useWalletStore: (selector: any) => {
    const state = { connected: true, address: "GTESTADDRESS" };
    return selector ? selector(state) : state;
  },
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: null,
    isProfileLoading: true,
    isVerified: false,
    isVerifiedLoading: false,
    register: vi.fn(),
    isRegistering: false,
    registerError: null,
  }),
}));

vi.mock("@/components/shared/PageLayout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
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

// TxHistory owns its react-query data flow; this test is about the loading
// announcement, so it does not need a QueryClientProvider.
vi.mock("@/components/shared/TxHistory", () => ({
  TxHistory: () => null,
}));

describe("ProfilePage loading announcement", () => {
  it("exposes the credential loading message as a polite status", () => {
    render(<ProfilePage />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading profile credentials...");
  });

  it("hides the decorative ping dot from the accessibility tree", () => {
    const { container } = render(<ProfilePage />);

    const dot = container.querySelector(".animate-ping");
    expect(dot).toHaveAttribute("aria-hidden", "true");
  });
});
