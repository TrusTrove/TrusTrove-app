import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { Navbar } from "./Navbar";
import messages from "@/messages/en.json";
import { useOnboardingStore } from "@/store/onboarding";

function renderNavbar() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <Navbar />
    </NextIntlClientProvider>,
  );
}

const setRole = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("./WalletConnect", () => ({
  WalletConnect: () => <button>Connect</button>,
}));
vi.mock("./SkeletonLoader", () => ({ SkeletonShimmer: () => <span /> }));
vi.mock("@/hooks/useBalances", () => ({
  useBalances: () => ({ balances: { usdc: "1", xlm: "2" }, loading: false }),
}));
vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ isVerified: false }),
}));
vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({ notifications: [], markAllAsRead: vi.fn() }),
}));
vi.mock("@/store/wallet", () => ({
  useWalletStore: (selector: any) => {
    const state = { role: "issuer", setRole, connected: true };
    return selector ? selector(state) : state;
  },
}));
vi.mock("lucide-react", () => {
  const Icon = () => null;
  return {
    Wallet: Icon,
    Shield: Icon,
    Terminal: Icon,
    ExternalLink: Icon,
    Menu: Icon,
    X: Icon,
    Moon: Icon,
    Sun: Icon,
    Bell: Icon,
    Compass: Icon,
    LayoutDashboard: Icon,
    Factory: Icon,
    BarChart2: Icon,
    BarChart3: Icon,
    User: Icon,
    Settings: Icon,
  };
});

describe("Navbar role select", () => {
  beforeEach(() => setRole.mockClear());

  it("accepts valid roles", () => {
    renderNavbar();
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "buyer" },
    });
    expect(setRole).toHaveBeenCalledWith("buyer");
  });

  it("ignores values outside the role union", () => {
    renderNavbar();
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "admin" },
    });
    expect(setRole).not.toHaveBeenCalled();
  });
});

describe("Navbar i18n", () => {
  it("renders nav labels, role options and balances from the en dictionary", () => {
    renderNavbar();
    for (const label of [
      "SME Dashboard",
      "LP Portal",
      "Marketplace",
      "Analytics",
      "Profile",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("Role:")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "SME (Issuer)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Buyer" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "LP (Funder)" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 USDC")).toBeInTheDocument();
    expect(screen.getByText("2 XLM")).toBeInTheDocument();
  });

  it("toggles the translated mobile menu aria-label", () => {
    renderNavbar();
    const toggle = screen.getByRole("button", {
      name: "Open navigation menu",
    });
    fireEvent.click(toggle);
    expect(
      screen.getByRole("button", { name: "Close navigation menu" }),
    ).toHaveAttribute("aria-expanded", "true");
  });
});

describe("Navbar onboarding tour", () => {
  beforeEach(() => {
    localStorage.clear();
    useOnboardingStore.setState({ open: false });
  });

  it("exposes tour anchors on the role switcher, balances and nav links", () => {
    const { container } = renderNavbar();
    for (const target of [
      "role-switcher",
      "balances",
      "nav-dashboard",
      "nav-lp",
      "nav-marketplace",
      "nav-profile",
      "tour-launcher",
    ]) {
      expect(container.querySelector(`[data-tour="${target}"]`)).not.toBeNull();
    }
  });

  it("relaunches the tour from the Take the tour button", () => {
    // Already seen: the connected wallet must not auto-open it.
    localStorage.setItem("trusttrove:onboarding-tour-seen", "true");
    renderNavbar();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "Welcome to TrusTrove",
    );
  });
});
