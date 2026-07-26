import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WalletConnect } from "./WalletConnect";
import { useWallet } from "@/hooks/useWallet";
import { isFreighterInstalled } from "@/lib/freighter";

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

vi.mock("@/lib/freighter", () => ({
  isFreighterInstalled: vi.fn().mockResolvedValue(true),
  FreighterError: class FreighterError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "FreighterError";
      this.code = code;
    }
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });
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
      errorCode: null,
    } as any);
    render(<WalletConnect />);
    expect(screen.getByText(/Connection failed/i)).toBeInTheDocument();
  });

  it("renders user-rejected message when errorCode is user_rejected", async () => {
    vi.mocked(useWallet).mockReturnValue({
      connected: false,
      loading: false,
      address: null,
      error: "The user rejected this request.",
      errorCode: "user_rejected",
    } as any);
    render(<WalletConnect />);
    expect(
      await screen.findByText(/You cancelled the connection request/i),
    ).toBeInTheDocument();
  });

  it("renders install CTA when errorCode is not_installed", async () => {
    vi.mocked(useWallet).mockReturnValue({
      connected: false,
      loading: false,
      address: null,
      error: "Freighter wallet is not installed",
      errorCode: "not_installed",
    } as any);
    render(<WalletConnect />);

    const installLink = await screen.findByText(/Install Freighter/i);
    expect(installLink).toBeInTheDocument();
    expect(installLink.closest("a")).toHaveAttribute(
      "href",
      "https://www.freighter.app/",
    );
  });

  it("renders generic error for errorCode unknown", () => {
    vi.mocked(useWallet).mockReturnValue({
      connected: false,
      loading: false,
      address: null,
      error: "Something went wrong",
      errorCode: "unknown",
    } as any);
    render(<WalletConnect />);
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
  });

  it("renders install prompt when Freighter is not installed", async () => {
    vi.mocked(useWallet).mockReturnValue({
      connected: false,
      loading: false,
      address: null,
      error: null,
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
    } as any);
    vi.mocked(isFreighterInstalled).mockResolvedValue(false);

    render(<WalletConnect />);

    expect(await screen.findByText(/Install Freighter/i)).toBeInTheDocument();
  });

  it("copies the wallet address when connected", async () => {
    const address = "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";
    vi.mocked(useWallet).mockReturnValue({
      connected: true,
      loading: false,
      address,
      error: null,
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
    } as any);
    vi.mocked(isFreighterInstalled).mockResolvedValue(true);

    render(<WalletConnect />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Copy wallet address/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText(/Copy wallet address/i));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(address);
  });
});
