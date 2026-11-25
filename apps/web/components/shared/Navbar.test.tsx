import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { Navbar, isNavItemActive } from "./Navbar";
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
const mockUsePathname = vi.fn(() => "/dashboard");
const mockUseProfile = vi.fn(() => ({ isVerified: false }));

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ usePathname: () => mockUsePathname() }));
vi.mock("./WalletConnect", () => ({
  WalletConnect: () => <button>Connect</button>,
}));
vi.mock("./SkeletonLoader", () => ({ SkeletonShimmer: () => <span /> }));
vi.mock("@/hooks/useBalances", () => ({
  useBalances: () => ({ balances: { usdc: "1", xlm: "2" }, loading: false }),
}));
vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => mockUseProfile(),
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

describe("Navbar active link and verified profile a11y", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/dashboard");
    mockUseProfile.mockReturnValue({ isVerified: false });
  });

  it("matches exact and nested routes without matching lookalikes or marking home active everywhere", () => {
    expect(isNavItemActive("/", "/")).toBe(true);
    expect(isNavItemActive("/dashboard", "/")).toBe(false);
    expect(isNavItemActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavItemActive("/dashboard/invoices/123", "/dashboard")).toBe(true);
    expect(isNavItemActive("/dashboardx", "/dashboard")).toBe(false);
    expect(isNavItemActive(null, "/dashboard")).toBe(false);
  });

  it("sets aria-current='page' on active desktop and mobile links and omits it on others", () => {
    renderNavbar();
    fireEvent.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );

    const dashboardLinks = screen.getAllByRole("link", {
      name: "SME Dashboard",
    });
    expect(dashboardLinks).toHaveLength(2);
    for (const link of dashboardLinks) {
      expect(link).toHaveAttribute("aria-current", "page");
    }

    const lpLinks = screen.getAllByRole("link", { name: "LP Portal" });
    expect(lpLinks).toHaveLength(2);
    for (const link of lpLinks) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("marks parent link active on nested routes and not on lookalike paths", () => {
    mockUsePathname.mockReturnValue("/dashboard/123");
    const { rerender } = renderNavbar();
    expect(
      screen.getByRole("link", { name: "SME Dashboard" }),
    ).toHaveAttribute("aria-current", "page");

    mockUsePathname.mockReturnValue("/dashboardx");
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <Navbar />
      </NextIntlClientProvider>,
    );
    expect(
      screen.getByRole("link", { name: "SME Dashboard" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("does not mark any nav item active on the home route", () => {
    mockUsePathname.mockReturnValue("/");
    renderNavbar();
    for (const label of [
      "SME Dashboard",
      "LP Portal",
      "Marketplace",
      "Analytics",
      "Profile",
    ]) {
      expect(screen.getByRole("link", { name: label })).not.toHaveAttribute(
        "aria-current",
      );
    }
  });

  it("renders sr-only verified text and aria-hidden dot when profile is verified", () => {
    mockUseProfile.mockReturnValue({ isVerified: true });
    const { container } = renderNavbar();
    fireEvent.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );

    const srTexts = screen.getAllByText("Verified Profile");
    expect(srTexts).toHaveLength(2);
    for (const el of srTexts) {
      expect(el).toHaveClass("sr-only");
    }

    const dots = container.querySelectorAll('span[title="Verified Profile"]');
    expect(dots).toHaveLength(2);
    for (const dot of dots) {
      expect(dot).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("omits sr-only verified text when profile is not verified", () => {
    mockUseProfile.mockReturnValue({ isVerified: false });
    renderNavbar();
    expect(screen.queryByText("Verified Profile")).not.toBeInTheDocument();
  });
});

describe("Navbar mobile theme toggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "dark";
  });

  it("renders only the desktop theme toggle when the mobile menu is closed", () => {
    renderNavbar();
    expect(
      screen.getAllByRole("button", { name: "Switch to light theme" }),
    ).toHaveLength(1);
  });

  it("renders a 44x44 theme toggle in the open mobile menu and switches theme on click", () => {
    renderNavbar();
    fireEvent.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );

    const toggles = screen.getAllByRole("button", {
      name: "Switch to light theme",
    });
    expect(toggles).toHaveLength(2);

    const mobileToggle = toggles[1];
    expect(mobileToggle).toHaveClass("min-h-[44px]", "min-w-[44px]");

    fireEvent.click(mobileToggle);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(
      screen.getAllByRole("button", { name: "Switch to dark theme" }),
    ).toHaveLength(2);
  });
});
