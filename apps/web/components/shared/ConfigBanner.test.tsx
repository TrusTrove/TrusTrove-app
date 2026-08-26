import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigBanner } from "./ConfigBanner";
import { validateConfig } from "@/lib/config";

vi.mock("@/lib/config", () => ({
  validateConfig: vi.fn(),
}));

describe("ConfigBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when all required env vars are configured", () => {
    vi.mocked(validateConfig).mockReturnValue({
      missing: [],
      isConfigured: true,
    });

    const { container } = render(<ConfigBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders banner with missing env var labels", () => {
    vi.mocked(validateConfig).mockReturnValue({
      missing: [
        "NEXT_PUBLIC_INVOICE_CONTRACT_ID",
        "NEXT_PUBLIC_POOL_CONTRACT_ID",
      ],
      isConfigured: false,
    });

    render(<ConfigBanner />);

    expect(screen.getByText("Configuration Error")).toBeInTheDocument();
    expect(
      screen.getByText(/Missing required environment variables/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Invoice Contract, Pool Contract/),
    ).toBeInTheDocument();
    expect(screen.getByText(".env.local")).toBeInTheDocument();
  });

  it("falls back to raw key name for unknown env vars", () => {
    vi.mocked(validateConfig).mockReturnValue({
      missing: ["NEXT_PUBLIC_UNKNOWN_CONTRACT_ID"],
      isConfigured: false,
    });

    render(<ConfigBanner />);

    expect(
      screen.getByText(/NEXT_PUBLIC_UNKNOWN_CONTRACT_ID/),
    ).toBeInTheDocument();
  });

  it("lists all three required env vars when all are missing", () => {
    vi.mocked(validateConfig).mockReturnValue({
      missing: [
        "NEXT_PUBLIC_INVOICE_CONTRACT_ID",
        "NEXT_PUBLIC_POOL_CONTRACT_ID",
        "NEXT_PUBLIC_REGISTRY_CONTRACT_ID",
      ],
      isConfigured: false,
    });

    render(<ConfigBanner />);

    expect(
      screen.getByText(/Invoice Contract, Pool Contract, Registry Contract/),
    ).toBeInTheDocument();
  });
});
