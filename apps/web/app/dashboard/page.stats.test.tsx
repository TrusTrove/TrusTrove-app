import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/store/wallet", () => {
  const state = {
    connected: true,
    address: "GISSUER",
    role: "issuer" as const,
    network: "testnet",
    token: null,
  };
  const useWalletStore: any = (selector?: (s: typeof state) => unknown) =>
    selector ? selector(state) : state;
  useWalletStore.getState = () => state;
  useWalletStore.setState = () => state;
  return { useWalletStore };
});

vi.mock("@/hooks/useProfile", () => ({
  useProfile: vi.fn(() => ({
    isVerified: true,
    profile: null,
    isProfileLoading: false,
    isVerifiedLoading: false,
  })),
}));

vi.mock("@/hooks/useEvents", () => ({
  useRecentEvents: vi.fn(() => ({
    events: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
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

vi.mock("@/components/invoice/InvoiceCard", () => ({
  InvoiceCard: () => null,
}));

// Stand-in table that exposes the current page slice and fake pagination
// controls so the test can drive invoicePage/invoiceLimit state changes.
vi.mock("@/components/invoice/InvoiceTable", () => ({
  InvoiceTable: ({
    invoices,
    pagination,
  }: {
    invoices: Array<{ id: string }>;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      onPageChange: (page: number) => void;
      onLimitChange: (limit: number) => void;
    };
  }) => (
    <div>
      <div data-testid="table-ids">{invoices.map((i) => i.id).join(",")}</div>
      <div data-testid="table-page">
        {pagination ? `${pagination.page}/${pagination.totalPages}` : "none"}
      </div>
      <button type="button" onClick={() => pagination?.onPageChange(13)}>
        go-to-page-13
      </button>
      <button type="button" onClick={() => pagination?.onLimitChange(10)}>
        set-limit-10
      </button>
    </div>
  ),
}));

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");
  const MOTION_ONLY_PROPS = [
    "initial",
    "animate",
    "exit",
    "transition",
    "variants",
    "whileHover",
    "whileTap",
    "layout",
    "layoutId",
    "viewport",
  ];
  const motion = new Proxy(
    {},
    {
      get(_target, tag) {
        const Component = (props: Record<string, unknown>) => {
          const rest: Record<string, unknown> = { ...props };
          for (const key of MOTION_ONLY_PROPS) delete rest[key];
          return ReactModule.createElement(String(tag), rest);
        };
        return Component;
      },
    },
  );
  return {
    motion,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
  };
});

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => {
    const DynamicStub = () => null;
    return DynamicStub;
  },
}));

/**
 * The issuer's complete invoice set (250 rows), served as raw wire-shape JSON
 * through a mocked `fetch`. Distribution chosen so that any statistic computed
 * from a single table page (20 rows of "Listed" invoices with no funding)
 * differs from the full-set statistic:
 *   - rows 0–79    Listed   (80)
 *   - rows 80–99   Created  (20)
 *   - rows 100–149 Funded   (50, funded 1_000_000 stroops each)
 *   - rows 150–209 Repaid   (60, funded 1_000_000 stroops each)
 *   - rows 210–249 Listed   (40)
 * Full-set stats: Created 250, Listed 120, Funded & Active 50, Repaid 60,
 * Total Financed 110_000_000 stroops = "11.00 USDC".
 */
const FULL_SET = Array.from({ length: 250 }, (_, i) => {
  let status = "Created";
  let funded = 0;
  if (i < 80) status = "Listed";
  else if (i < 100) status = "Created";
  else if (i < 150) {
    status = "Funded";
    funded = 1_000_000;
  } else if (i < 210) {
    status = "Repaid";
    funded = 1_000_000;
  } else status = "Listed";

  return {
    id: `inv-${String(i).padStart(3, "0")}`,
    issuer: "GISSUER",
    buyer: "GBUYER",
    face_value: "10000000",
    funded_amount: String(funded),
    discount_bps: 500,
    due_date: 2_000_000_000,
    status,
    created_at: 1_700_000_000 + i,
  };
});

function respond(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = new URL(String(input));

  if (url.pathname.endsWith("/events")) return respond([]);

  if (url.pathname.endsWith("/invoices")) {
    const page = Number(url.searchParams.get("page") ?? "1");
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const start = (page - 1) * limit;
    return respond({
      data: FULL_SET.slice(start, start + limit),
      total: FULL_SET.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(FULL_SET.length / limit)),
    });
  }

  return respond({});
});

import SMEDashboard from "./page";

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SMEDashboard />
    </QueryClientProvider>,
  );
}

function statsSnapshot() {
  return {
    created: screen.getByText("250").textContent,
    listed: screen.getByText("120").textContent,
    fundedActive: screen.getByText("50").textContent,
    repaid: screen.getByText("60").textContent,
    financed: screen.getByText("11.00 USDC").textContent,
  };
}

describe("SME dashboard summary stats (issue #874)", () => {
  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockClear();
  });

  it("shows stats from the issuer's complete invoice set while the table stays paginated", async () => {
    renderDashboard();

    // Stats aggregate all 250 invoices — not the 20 rows on page 1.
    expect(
      await screen.findByText("250", {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument(); // Currently Listed
    expect(screen.getByText("50")).toBeInTheDocument(); // Funded & Active
    expect(screen.getByText("60")).toBeInTheDocument(); // Total Repaid
    expect(screen.getByText("11.00 USDC")).toBeInTheDocument(); // Total Financed

    // The table itself is still showing page 1 of 13.
    const ids = (await screen.findByTestId("table-ids")).textContent ?? "";
    expect(ids).toContain("inv-000");
    expect(ids).not.toContain("inv-249");
    expect(screen.getByTestId("table-page").textContent).toBe("1/13");

    // The stats aggregation walked every server page (API caps limit at 100).
    await waitFor(() => {
      const statsPages = fetchMock.mock.calls
        .map((call) => new URL(String(call[0])))
        .filter(
          (url) =>
            url.pathname.endsWith("/invoices") &&
            url.searchParams.get("limit") === "100",
        )
        .map((url) => url.searchParams.get("page"));
      expect(statsPages).toEqual(["1", "2", "3"]);
    });
    const firstStatsRequest = new URL(String(fetchMock.mock.calls[0][0]));
    expect(firstStatsRequest.searchParams.get("issuer")).toBe("GISSUER");
  });

  it("keeps stats stable when the user changes invoicePage and invoiceLimit", async () => {
    renderDashboard();

    expect(
      await screen.findByText("250", {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    const before = statsSnapshot();

    // Page forward to the last page of invoices (rows 240–249).
    fireEvent.click(screen.getByText("go-to-page-13"));
    await waitFor(() => {
      expect(screen.getByTestId("table-ids").textContent).toContain("inv-249");
    });
    expect(screen.getByTestId("table-page").textContent).toBe("13/13");
    expect(statsSnapshot()).toEqual(before);

    // Change the page size — the table resets to page 1 with 10 rows.
    fireEvent.click(screen.getByText("set-limit-10"));
    await waitFor(() => {
      expect(screen.getByTestId("table-page").textContent).toBe("1/25");
    });
    expect(statsSnapshot()).toEqual(before);
  });
});
