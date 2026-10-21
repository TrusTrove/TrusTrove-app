import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/renderWithProviders";

// The bug (#1116) was that /help rendered a bare container: no Navbar and no
// `id="main-content"`, which is the target of the global skip link in
// app/layout.tsx. These tests therefore exercise the REAL PageLayout/Navbar
// pair — mocking them would assert the fix away.

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a>,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/help",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/shared/WalletConnect", () => ({
  WalletConnect: () => <button>Connect</button>,
}));
vi.mock("@/components/shared/SkeletonLoader", () => ({
  SkeletonShimmer: () => <span />,
}));
vi.mock("@/hooks/useBalances", () => ({
  useBalances: () => ({ balances: { usdc: "1", xlm: "2" }, loading: false }),
}));
vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ isVerified: true }),
}));
vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({ notifications: [], markAllAsRead: vi.fn() }),
}));
vi.mock("@/store/wallet", () => ({
  useWalletStore: (selector: any) => {
    const state = {
      address: null,
      connected: false,
      role: "issuer",
      setRole: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

import HelpPage from "@/app/help/page";

function renderHelp() {
  return renderWithProviders(<HelpPage />);
}

describe("/help app shell", () => {
  it("renders the navigation landmark the route was missing", () => {
    renderHelp();

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Help" })).toBeInTheDocument();
  });

  it("provides a focusable skip-link target that holds the help content", () => {
    renderHelp();

    // app/layout.tsx's skip link is `<a href="#main-content">`; the fragment
    // only moves keyboard focus if the target is focusable itself.
    const main = document.getElementById("main-content");
    expect(main).not.toBeNull();
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(main?.tagName).toBe("MAIN");

    main?.focus();
    expect(document.activeElement).toBe(main);
    expect(main).toContainElement(
      screen.getByRole("heading", { name: "Help & FAQ" }),
    );
    expect(main?.textContent).not.toMatch(/NaN|undefined/);
  });

  it("keeps the FAQ accordion working inside the shell", () => {
    renderHelp();

    const question = screen.getByRole("button", {
      name: "What is TrusTrove?",
    });
    expect(question).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(question);
    expect(question).toHaveAttribute("aria-expanded", "true");
    expect(question).toHaveAccessibleName("What is TrusTrove?");

    fireEvent.click(question);
    expect(question).toHaveAttribute("aria-expanded", "false");
  });
});
