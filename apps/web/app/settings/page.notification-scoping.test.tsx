import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "@/app/settings/page";
import { prefsStorageKey } from "@/lib/notification-preferences";

const { wallet } = vi.hoisted(() => ({
  wallet: { connected: true, address: "GAAAAAAAA" as string | null },
}));

vi.mock("@/store/wallet", () => ({
  useWalletStore: (selector: any) => (selector ? selector(wallet) : wallet),
}));

vi.mock("@/components/shared/PageLayout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));

vi.mock("@/components/shared/ThemeToggle", () => ({
  ThemeToggle: () => null,
}));

const ADDRESS_A = "GAAAAAAAA";
const ADDRESS_B = "GBBBBBBB";

function toggleFor(category: string) {
  return screen.getByRole("checkbox", { name: `${category} notifications` });
}

function storedPrefsOf(address: string) {
  return JSON.parse(localStorage.getItem(prefsStorageKey(address)) ?? "null");
}

describe("Settings notification preferences stay scoped to the connected wallet", () => {
  beforeEach(() => {
    localStorage.clear();
    wallet.connected = true;
    wallet.address = ADDRESS_A;
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("re-reads the stored preferences when the connected address changes", () => {
    localStorage.setItem(
      prefsStorageKey(ADDRESS_A),
      JSON.stringify({ "Invoice Repaid": false }),
    );

    const { rerender } = render(<SettingsPage />);
    expect(toggleFor("Invoice Repaid")).not.toBeChecked();

    wallet.address = ADDRESS_B;
    rerender(<SettingsPage />);

    expect(toggleFor("Invoice Repaid")).toBeChecked();
  });

  it("writes a toggle only to the key of the address that is active", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SettingsPage />);

    await user.click(toggleFor("Invoice Created"));
    expect(storedPrefsOf(ADDRESS_A)["Invoice Created"]).toBe(false);
    expect(storedPrefsOf(ADDRESS_B)).toBeNull();

    wallet.address = ADDRESS_B;
    rerender(<SettingsPage />);

    await user.click(toggleFor("Invoice Funded"));
    expect(storedPrefsOf(ADDRESS_B)["Invoice Funded"]).toBe(false);
    expect(storedPrefsOf(ADDRESS_B)["Invoice Created"]).toBe(true);
    expect(storedPrefsOf(ADDRESS_A)["Invoice Created"]).toBe(false);
    expect(storedPrefsOf(ADDRESS_A)["Invoice Funded"]).toBe(true);
  });
});
