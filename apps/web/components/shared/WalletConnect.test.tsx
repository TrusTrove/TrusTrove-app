import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WalletConnect } from "./WalletConnect";
import { useWallet } from "@/hooks/useWallet";

vi.mock("@/hooks/useWallet", () => {
  const state = "disconnected";
  return {
    useWallet: vi.fn(() => ({
      connected: state === "connected",
      loading: state === "connecting",
      address:
        state === "connected"
          ? "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB"
          : null,
      error: state === "error" ? "Connection failed" : null,
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
    })),
  };
});

describe("WalletConnect", () => {
  it("renders disconnected state", () => {
    vi.mocked(useWallet).mockReturnValue({
      connected: false,
      loading: false,
      address: null,
      error: null,
    } as any);
    render(<WalletConnect />);
    expect(screen.getByText(/Connect Wallet/i)).toBeInTheDocument();
  });

  it("renders connecting state", () => {
    vi.mocked(useWallet).mockReturnValue({
      connected: false,
      loading: true,
      address: null,
      error: null,
    } as any);
    render(<WalletConnect />);
    expect(screen.getByText(/Connecting.../i)).toBeInTheDocument();
  });

  it("renders connected state", () => {
    vi.mocked(useWallet).mockReturnValue({
      connected: true,
      loading: false,
      address: "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGBYZ",
      error: null,
    } as any);
    render(<WalletConnect />);
    expect(screen.getByText(/GACR43\.\.\.GBYZ/i)).toBeInTheDocument();
  });

  it("renders error state", () => {
    vi.mocked(useWallet).mockReturnValue({
      connected: false,
      loading: false,
      address: null,
      error: "Connection failed",
    } as any);
    render(<WalletConnect />);
    expect(screen.getByText(/Connection failed/i)).toBeInTheDocument();
  });
});
