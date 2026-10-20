import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "@/app/profile/page";
import {
  NOTIFICATION_CATEGORIES,
  prefsStorageKey,
} from "@/lib/notification-preferences";

// `vi.hoisted` because the mock factory below runs while the module graph is
// still being imported, before any top-level `const` in this file is assigned.
const { wallet } = vi.hoisted(() => ({
  wallet: { connected: true, address: "GAAAAAAAA" as string | null },
}));

vi.mock("@/store/wallet", () => ({
  useWalletStore: (selector: any) => (selector ? selector(wallet) : wallet),
}));

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

// TxHistory owns its react-query data flow and is covered by its own tests.
vi.mock("@/components/shared/TxHistory", () => ({
  TxHistory: () => null,
}));

const ADDRESS_A = "GAAAAAAAA";
const ADDRESS_B = "GBBBBBBB";

function toggleFor(category: string) {
  return screen.getByRole("checkbox", { name: `${category} notifications` });
}

function storedPrefsOf(address: string) {
  return JSON.parse(localStorage.getItem(prefsStorageKey(address)) ?? "null");
}

describe("Profile notification preferences stay scoped to the connected wallet", () => {
  beforeEach(() => {
    localStorage.clear();
    wallet.connected = true;
    wallet.address = ADDRESS_A;
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("re-reads the stored preferences when the connected address changes", async () => {
    localStorage.setItem(
      prefsStorageKey(ADDRESS_A),
      JSON.stringify({ "Invoice Funded": false }),
    );

    const { rerender } = render(<ProfilePage />);
    expect(toggleFor("Invoice Funded")).not.toBeChecked();

    // Account switch: the same rendered page now shows wallet B, which never
    // opted out.
    wallet.address = ADDRESS_B;
    rerender(<ProfilePage />);

    expect(toggleFor("Invoice Funded")).toBeChecked();
    for (const category of NOTIFICATION_CATEGORIES) {
      expect(toggleFor(category)).toBeChecked();
    }
  });

  it("keeps the previous wallet's preferences off the new wallet's screen", async () => {
    localStorage.setItem(
      prefsStorageKey(ADDRESS_A),
      JSON.stringify({ "Invoice Created": false, "Invoice Listed": false }),
    );

    const { rerender } = render(<ProfilePage />);
    wallet.address = ADDRESS_B;
    rerender(<ProfilePage />);

    const user = await userEvent.setup();
    // Toggling one of B's categories must not carry A's two opt-outs across.
    await user.click(toggleFor("Invoice Repaid"));

    const savedForB = storedPrefsOf(ADDRESS_B);
    expect(savedForB["Invoice Repaid"]).toBe(false);
    expect(savedForB["Invoice Created"]).toBe(true);
    expect(savedForB["Invoice Listed"]).toBe(true);
  });

  it("writes a toggle only to the key of the address that is active", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ProfilePage />);

    await user.click(toggleFor("Invoice Shipped"));
    expect(storedPrefsOf(ADDRESS_A)["Invoice Shipped"]).toBe(false);
    expect(storedPrefsOf(ADDRESS_B)).toBeNull();

    const savedForA = localStorage.getItem(prefsStorageKey(ADDRESS_A));

    wallet.address = ADDRESS_B;
    rerender(<ProfilePage />);

    await user.click(toggleFor("Invoice Defaulted"));
    expect(storedPrefsOf(ADDRESS_B)["Invoice Defaulted"]).toBe(false);
    expect(storedPrefsOf(ADDRESS_B)["Invoice Shipped"]).toBe(true);
    // A's saved state is byte-for-byte what the first click wrote: the second
    // wallet never received a copy of it, and it never overwrote it.
    expect(localStorage.getItem(prefsStorageKey(ADDRESS_A))).toBe(savedForA);
  });

  it("shows the preferences saved for each wallet on every switch", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ProfilePage />);
    await user.click(toggleFor("Invoice Created"));

    wallet.address = ADDRESS_B;
    rerender(<ProfilePage />);
    expect(toggleFor("Invoice Created")).toBeChecked();

    wallet.address = ADDRESS_A;
    rerender(<ProfilePage />);
    expect(toggleFor("Invoice Created")).not.toBeChecked();
  });
});
