import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Navbar } from "./Navbar";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
}));

// Mock useWallet hook
vi.mock("@/hooks/useWallet", () => ({
  useWallet: vi.fn(() => ({
    connected: false,
    balances: { usdc: null, xlm: null },
    balancesLoading: false,
    role: "issuer",
    setRole: vi.fn(),
    isVerified: false,
  })),
}));

// Mock WalletConnect to avoid external dependency issues in tests
vi.mock("@/components/shared/WalletConnect", () => ({
  WalletConnect: () => <div data-testid="wallet-connect">Connect Wallet</div>,
}));

// Mock Link to render a simple anchor tag
vi.mock("next/link", () => ({
  default: ({ children, href, onClick }: any) => (
    <a href={href} onClick={onClick} data-testid={`link-${href}`}>
      {children}
    </a>
  ),
}));

describe("Navbar", () => {
  it("renders correctly", () => {
    render(<Navbar />);
    expect(screen.getByText(/TRUST/i)).toBeInTheDocument();
    expect(screen.getByTestId("wallet-connect")).toBeInTheDocument();
  });

  it("toggles mobile menu on click", () => {
    // Force mobile viewport or test mobile button
    // The button has aria-expanded
    render(<Navbar />);
    const menuButton = screen.getByLabelText(/Open navigation menu/i);
    expect(menuButton).toBeInTheDocument();

    // Click to open
    fireEvent.click(menuButton);
    expect(screen.getByLabelText(/Close navigation menu/i)).toBeInTheDocument();
    
    // Check if nav items are shown in mobile menu (e.g. Dashboard)
    // The link should exist in the DOM inside the mobile menu
    const links = screen.getAllByTestId("link-/");
    expect(links.length).toBeGreaterThan(1); // 1 for logo, 1 for desktop, 1 for mobile

    // Click to close
    fireEvent.click(menuButton);
    expect(screen.getByLabelText(/Open navigation menu/i)).toBeInTheDocument();
  });
});
