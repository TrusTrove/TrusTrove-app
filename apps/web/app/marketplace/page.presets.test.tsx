import React from "react";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Marketplace from "@/app/marketplace/page";
import { renderWithProviders } from "@/test-utils/renderWithProviders";

const { wallet } = vi.hoisted(() => ({
  wallet: {
    connected: true,
    address: "GAAAAAAAA" as string | null,
    role: null,
  },
}));

vi.mock("@/store/wallet", () => ({
  useWalletStore: (selector: any) => (selector ? selector(wallet) : wallet),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: vi.fn(() => ({
    isVerified: false,
    profile: null,
    isProfileLoading: false,
    isVerifiedLoading: false,
  })),
}));

vi.mock("@/hooks/useInvoices", () => ({
  useInvoiceList: vi.fn(() => ({
    invoices: [],
    isLoading: false,
    total: 0,
    totalPages: 0,
  })),
}));

vi.mock("@/hooks/usePool", () => ({
  usePool: vi.fn(() => ({
    stats: { availableLiquidity: 0n },
    isStatsLoading: false,
  })),
}));

vi.mock("@/components/shared/PageLayout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/shared/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/invoice/InvoiceTable", () => ({
  InvoiceTable: () => null,
}));

vi.mock("@/components/invoice/InvoiceCard", () => ({
  InvoiceCard: () => null,
}));

const ADDRESS_A = "GAAAAAAAA";
const ADDRESS_B = "GBBBBBBB";
const ANONYMOUS_KEY = "trusttrove:marketplace:presets";

function presetsKey(address: string | null) {
  return address ? `${ANONYMOUS_KEY}_${address}` : ANONYMOUS_KEY;
}

function storedPresetNames(address: string | null) {
  const raw = localStorage.getItem(presetsKey(address));
  if (raw === null) return null;
  return (JSON.parse(raw) as { name: string }[]).map((preset) => preset.name);
}

/** The dropdown trigger doubles as the summary of what is saved. */
function presetsButton() {
  return screen.getByRole("button", { name: /saved searches|preset/i });
}

async function savePresetNamed(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(presetsButton());
  const input = screen.getByLabelText("New preset name");
  await user.type(input, `${name}{enter}`);
}

describe("Marketplace saved searches are scoped per wallet", () => {
  beforeEach(() => {
    localStorage.clear();
    wallet.connected = true;
    wallet.address = ADDRESS_A;
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("shows a wallet's own presets and nothing else", async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(<Marketplace />);

    await savePresetNamed(user, "A only");
    expect(presetsButton()).toHaveTextContent("1 preset saved");
    expect(storedPresetNames(ADDRESS_A)).toEqual(["A only"]);

    wallet.address = ADDRESS_B;
    rerender(<Marketplace />);

    // Wallet B has never saved a search, so none of A's presets are listed.
    expect(presetsButton()).toHaveTextContent("No saved searches");
    await user.click(presetsButton());
    expect(
      within(screen.getByRole("listbox")).queryByText("A only"),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("listbox")).getByText("No saved searches yet"),
    ).toBeInTheDocument();
  });

  it("never writes the previous wallet's presets under the new wallet's key", async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(<Marketplace />);

    await savePresetNamed(user, "A only");

    wallet.address = ADDRESS_B;
    rerender(<Marketplace />);

    // The render that happens between the account switch and the re-read of
    // B's presets must not persist A's in-memory list to B's key.
    expect(storedPresetNames(ADDRESS_B) ?? []).not.toContain("A only");
  });

  it("does not copy anonymous presets onto a freshly connected wallet", async () => {
    const user = userEvent.setup();
    wallet.address = null;
    const { rerender } = renderWithProviders(<Marketplace />);

    await savePresetNamed(user, "anonymous");
    expect(storedPresetNames(null)).toEqual(["anonymous"]);

    wallet.address = ADDRESS_A;
    rerender(<Marketplace />);

    expect(storedPresetNames(ADDRESS_A)).not.toContain("anonymous");
    expect(presetsButton()).toHaveTextContent("No saved searches");
    // The anonymous store is left as the user saved it.
    expect(storedPresetNames(null)).toEqual(["anonymous"]);
  });

  it("lists the presets saved for a wallet again when it reconnects", async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(<Marketplace />);

    await savePresetNamed(user, "A only");

    wallet.address = ADDRESS_B;
    rerender(<Marketplace />);
    expect(presetsButton()).toHaveTextContent("No saved searches");

    wallet.address = ADDRESS_A;
    rerender(<Marketplace />);
    expect(presetsButton()).toHaveTextContent("1 preset saved");

    await user.click(presetsButton());
    // The panel and its inner <ul> both carry role="listbox", so query the
    // option directly rather than scoping to one container.
    expect(screen.getByRole("option", { name: /A only/ })).toBeInTheDocument();
  });

  it("keeps filtering with the presets of the active wallet", async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(<Marketplace />);
    await savePresetNamed(user, "A only");

    wallet.address = ADDRESS_B;
    rerender(<Marketplace />);
    await user.click(presetsButton());
    await user.type(screen.getByLabelText("New preset name"), "B only{enter}");

    expect(storedPresetNames(ADDRESS_B)).toEqual(["B only"]);
    expect(storedPresetNames(ADDRESS_A)).toEqual(["A only"]);
  });
});
