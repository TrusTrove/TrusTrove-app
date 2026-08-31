import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Navbar } from "./Navbar";

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
  };
});

describe("Navbar role select", () => {
  beforeEach(() => setRole.mockClear());

  it("accepts valid roles", () => {
    render(<Navbar />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "buyer" },
    });
    expect(setRole).toHaveBeenCalledWith("buyer");
  });

  it("ignores values outside the role union", () => {
    render(<Navbar />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "admin" },
    });
    expect(setRole).not.toHaveBeenCalled();
  });
});
