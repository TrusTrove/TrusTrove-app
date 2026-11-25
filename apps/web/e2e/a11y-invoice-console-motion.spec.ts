import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures/freighter";

const MOCK_WALLET = "GBMOCKWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

const MOCK_INVOICE = {
  id: "inv-mobile-001",
  issuer: MOCK_WALLET,
  buyer: "GBBUYERADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  face_value: "10000000000",
  asset: "USDC",
  discount_bps: 200,
  funded_amount: "0",
  due_date: 1893456000,
  status: "Listed",
  created_at: 1735603200,
  funded_at: null,
  shipped_at: null,
  issuer_confirmed: false,
  buyer_confirmed: false,
  repaid_at: null,
  listed_at: 1735603200,
  issuer_confirmed_at: null,
  buyer_confirmed_at: null,
  defaulted_at: null,
  transaction_hashes: [],
  tx_hashes: [],
};

async function mockInvoiceApis(page: Page) {
  await page.route("**/invoices**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        data: [MOCK_INVOICE],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    });
  });
  await page.route("**/events**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify([]),
    });
  });
  await page.route("**/profile**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        address: MOCK_WALLET,
        verified: true,
        role: "issuer",
      }),
    });
  });
  await page.route("**/pool**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ availableLiquidity: "10000000000" }),
    });
  });
  await page.route("**/horizon-testnet.stellar.org/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        id: MOCK_WALLET,
        account_id: MOCK_WALLET,
        sequence: "123456789",
        subentry_count: 0,
        balances: [],
      }),
    });
  });
  await page.route("**/soroban-testnet.stellar.org/**", async (route) => {
    const body = route.request().postDataJSON() as {
      id?: number;
      method?: string;
      params?: { transaction?: string };
    };
    const id = body?.id ?? 1;
    const method = body?.method ?? "";
    const result =
      method === "getTransaction"
        ? {
            status: "SUCCESS",
            txHash: "mock-onchain-tx-hash",
            ledger: 12345,
            createdAt: new Date().toISOString(),
          }
        : method === "prepareTransaction"
          ? {
              transaction: body?.params?.transaction ?? "",
              minResourceFee: "100",
            }
          : method === "simulateTransaction"
            ? {
                transactionData: "",
                minResourceFee: "100",
                results: [{ auth: [], xdr: "" }],
                cost: { cpuInsns: "0", memBytes: "0" },
              }
            : method === "sendTransaction"
              ? { status: "PENDING", hash: "mock-onchain-tx-hash" }
              : {};

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ jsonrpc: "2.0", id, result }),
    });
  });
}

async function connectWallet(page: Page) {
  await page
    .getByRole("main")
    .getByRole("button", { name: /Connect Wallet/i })
    .click();
  await expect(
    page.getByRole("main").getByRole("heading", {
      name: "SME Financing Dashboard",
    }),
  ).toBeVisible({ timeout: 15000 });
}

for (const route of ["/dashboard", "/marketplace"]) {
  test(`mobile invoice selection focuses and announces console on ${route}`, async ({
    page,
  }) => {
    await mockInvoiceApis(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(route);
    if (route === "/dashboard") await connectWallet(page);

    const invoiceCard = page
      .locator(".md\\:hidden")
      .getByText("Invoice obligation");
    await expect(invoiceCard).toBeVisible({ timeout: 15000 });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await invoiceCard.click();

    const consoleHeading = page.getByRole("heading", {
      name: route === "/dashboard" ? "Management console" : "Management Center",
    });
    await expect(consoleHeading).toBeFocused();
    await expect(
      page.getByRole("status").filter({
        hasText: "Invoice INV#inv-mobile-001 selected, actions available below",
      }),
    ).toBeAttached();
    // The page smooth-scrolls to the console, so retry until it settles
    // instead of reading the heading's position once mid-scroll.
    await expect(consoleHeading).toBeInViewport({ ratio: 1 });
  });
}

test("reduced motion disables feed transforms and skeleton shimmer", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let releaseEvents!: () => void;
  const eventsGate = new Promise<void>((resolve) => {
    releaseEvents = resolve;
  });
  await page.route("**/events**", async (route) => {
    await eventsGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify([
        {
          id: 1,
          event_id: "event-1",
          contract_id: "contract-1",
          ledger: 1,
          event_type: "InvoiceCreated",
          ledger_closed_at: Math.floor(Date.now() / 1000),
          data: { invoice_id: "abcdef123456" },
        },
      ]),
    });
  });
  const eventsRequest = page.waitForRequest((request) =>
    request.url().includes("/events"),
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const feed = page.getByRole("region", { name: "Live Financing Feed" });
  const shimmer = feed.locator('[class*="shimmer"]').first();
  await eventsRequest;
  await expect(shimmer).toBeVisible({ timeout: 15000 });
  await expect
    .poll(() =>
      shimmer.evaluate((element) => getComputedStyle(element).animationName),
    )
    .toBe("none");

  releaseEvents();

  const feedEntry = feed.getByRole("listitem");
  await expect(feedEntry).toBeVisible({ timeout: 15000 });
  await expect
    .poll(() =>
      feedEntry.evaluate((element) => getComputedStyle(element).transform),
    )
    .toBe("none");
});
