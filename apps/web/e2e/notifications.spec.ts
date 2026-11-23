import { expect, type Locator, type Page } from "@playwright/test";
import { test } from "./fixtures/freighter";

// End-to-end coverage for the notification pipeline (#783-#786):
//   /events + /invoices -> useNotifications -> per-wallet localStorage cache
//   -> NotificationBell unread dot / dropdown -> markAllAsRead on open
//   -> profile preference toggles (trusttrove_prefs_<address>) muting types.
//
// The unit tests cover the pieces in isolation; these cases exercise the whole
// path in a real browser, including cross-page and cross-reload behaviour that
// jsdom cannot reproduce.

const WALLET_A = "GBMOCKWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
const WALLET_B = "GBOTHERWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

const RELEVANT_INVOICE = "inv_relevant";
const UNRELATED_INVOICE = "inv_unrelated";

interface MockInvoice {
  id: string;
  issuer: string;
  buyer: string;
  face_value: string;
  asset: string;
  discount_bps: number;
  funded_amount: string;
  due_date: number;
  status: string;
  created_at: number;
}

interface MockEvent {
  id: number;
  event_id: string;
  contract_id: string;
  ledger: number;
  ledger_closed_at: number;
  event_type: string;
  data: { invoice_id: string };
}

function makeInvoice(id: string, issuer: string, buyer: string): MockInvoice {
  return {
    id,
    issuer,
    buyer,
    face_value: "1000",
    asset: "USDC",
    discount_bps: 500,
    funded_amount: "0",
    due_date: 1893456000,
    status: "created",
    created_at: 1000,
  };
}

function makeEvent(
  id: number,
  eventType: string,
  invoiceId: string,
  timestamp: number,
): MockEvent {
  return {
    id,
    event_id: `event-${id}`,
    contract_id: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    ledger: id,
    ledger_closed_at: timestamp,
    event_type: eventType,
    data: { invoice_id: invoiceId },
  };
}

/**
 * Installs a working Freighter mock whose `requestAccess` actually returns the
 * given address, so `useWallet.connectWallet()` can complete the full network
 * validation and store the wallet as connected.
 */
async function installFreighter(page: Page, address: string) {
  await page.addInitScript((addr) => {
    (window as any).freighter = {
      isConnected: () => Promise.resolve(true),
      isAllowed: () => Promise.resolve(true),
      setAllowed: () => Promise.resolve(),
      requestAccess: () => Promise.resolve(addr),
      signTransaction: (xdr: string) => Promise.resolve(xdr),
      signAuthEntry: () => Promise.resolve("signed-auth-mock"),
      getPublicKey: () => Promise.resolve(addr),
      getNetworkDetails: () => Promise.resolve({ network: "TESTNET" }),
    };
  }, address);
}

async function mockNotificationApis(
  page: Page,
  invoices: MockInvoice[],
  events: MockEvent[],
) {
  await page.route("**/invoices**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: invoices,
        total: invoices.length,
        page: 1,
        limit: 500,
        totalPages: 1,
      }),
    });
  });

  await page.route("**/events**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(events),
    });
  });
}

async function connectWallet(page: Page) {
  // Scoped to the Navbar: pages like /profile render their own connect button.
  const navbar = page.getByRole("navigation");
  const connectBtn = navbar.getByRole("button", { name: /connect wallet/i });
  await expect(connectBtn).toBeVisible({ timeout: 15000 });
  await connectBtn.click();
  await expect(
    navbar.getByRole("button", { name: /disconnect wallet/i }),
  ).toBeVisible({ timeout: 15000 });
}

function bell(page: Page): Locator {
  return page.getByRole("button", { name: "Notifications" });
}

function dropdown(page: Page): Locator {
  // The dropdown is the absolutely-positioned sibling rendered inside the
  // bell button's wrapping `relative` container.
  return bell(page).locator("xpath=..").locator("div.absolute");
}

function unreadDot(page: Page): Locator {
  return bell(page).locator("span.rounded-full");
}

async function openBell(page: Page) {
  await bell(page).click();
  await expect(dropdown(page)).toBeVisible();
}

async function closeBell(page: Page) {
  await bell(page).click();
  await expect(dropdown(page)).toBeHidden();
}

/** The profile preference toggle for a notification category. */
function preferenceToggle(page: Page, category: string): Locator {
  return page
    .getByText(category, { exact: true })
    .locator("xpath=following-sibling::label");
}

test.describe("Notification bell, persistence and preferences", () => {
  test("shows the unread dot, lists only relevant notifications newest first, and clears the dot on open", async ({
    page,
  }) => {
    await installFreighter(page, WALLET_A);

    const invoices = [
      makeInvoice(RELEVANT_INVOICE, WALLET_A, "GBBUYERXXXXXXXX"),
      makeInvoice(UNRELATED_INVOICE, "GBOTHERISSUERXX", "GBOTHERBUYERXX"),
    ];
    // timestamps intentionally out of order: newest first must be enforced.
    const events = [
      makeEvent(1, "InvoiceCreated", RELEVANT_INVOICE, 1000),
      makeEvent(2, "InvoiceFunded", RELEVANT_INVOICE, 2000),
      makeEvent(3, "InvoiceCreated", UNRELATED_INVOICE, 3000),
    ];
    await mockNotificationApis(page, invoices, events);

    await page.goto("/");
    await connectWallet(page);

    // Unread dot is visible for the two unread, relevant notifications.
    await expect(unreadDot(page)).toBeVisible({ timeout: 15000 });

    await openBell(page);

    // Newest first: the funded event (t=2000) precedes the created one (t=1000).
    const messages = dropdown(page).locator("p");
    await expect(messages.first()).toContainText("fully funded");
    await expect(messages.nth(1)).toContainText("issued on-chain");

    // The unrelated invoice's event is filtered out, so "Invoice Created"
    // appears exactly once.
    await expect(
      dropdown(page).getByText("Invoice Created", { exact: true }),
    ).toHaveCount(1);
    await expect(dropdown(page).getByText("2 new")).toBeVisible();

    // Opening the dropdown marks everything read and removes the dot.
    await expect(unreadDot(page)).toHaveCount(0);
  });

  test("persists read state across a reload and marks only newly mocked events unread", async ({
    page,
  }) => {
    await installFreighter(page, WALLET_A);

    const invoices = [
      makeInvoice(RELEVANT_INVOICE, WALLET_A, "GBBUYERXXXXXXXX"),
    ];
    const events = [
      makeEvent(1, "InvoiceCreated", RELEVANT_INVOICE, 1000),
      makeEvent(2, "InvoiceFunded", RELEVANT_INVOICE, 2000),
    ];
    await mockNotificationApis(page, invoices, events);

    await page.goto("/");
    await connectWallet(page);
    await expect(unreadDot(page)).toBeVisible({ timeout: 15000 });

    // Mark everything read.
    await openBell(page);
    await expect(unreadDot(page)).toHaveCount(0);
    await closeBell(page);

    // Reload and reconnect: the same notifications must come back read.
    await page.reload();
    await connectWallet(page);
    await expect(unreadDot(page)).toHaveCount(0);
    await openBell(page);
    await expect(dropdown(page).getByText(/new/)).toHaveCount(0);
    await closeBell(page);

    // A brand new on-chain event is the only unread one.
    events.push(makeEvent(4, "InvoiceRepaid", RELEVANT_INVOICE, 4000));

    await page.reload();
    await connectWallet(page);
    await expect(unreadDot(page)).toBeVisible({ timeout: 15000 });

    await openBell(page);
    await expect(dropdown(page).getByText("1 new")).toBeVisible();
    await expect(
      dropdown(page).getByText("Invoice Repaid", { exact: true }),
    ).toBeVisible();
    // Previously read notifications are still listed.
    await expect(
      dropdown(page).getByText("Invoice Created", { exact: true }),
    ).toBeVisible();
  });

  test("muting a category in profile preferences hides it from the bell and re-enabling restores it", async ({
    page,
  }) => {
    await installFreighter(page, WALLET_A);

    const invoices = [
      makeInvoice(RELEVANT_INVOICE, WALLET_A, "GBBUYERXXXXXXXX"),
    ];
    const events = [
      makeEvent(1, "InvoiceCreated", RELEVANT_INVOICE, 1000),
      makeEvent(2, "InvoiceFunded", RELEVANT_INVOICE, 2000),
    ];
    await mockNotificationApis(page, invoices, events);

    await page.goto("/profile");
    await connectWallet(page);

    // Both categories reach the bell before muting.
    await openBell(page);
    await expect(
      dropdown(page).getByText("Invoice Funded", { exact: true }),
    ).toBeVisible();
    await closeBell(page);

    // Turn "Invoice Funded" off in the profile preferences.
    await preferenceToggle(page, "Invoice Funded").click();

    // The hook re-reads preferences on the next load, so reload + reconnect.
    await page.reload();
    await connectWallet(page);
    await openBell(page);
    await expect(
      dropdown(page).getByText("Invoice Funded", { exact: true }),
    ).toHaveCount(0);
    await expect(
      dropdown(page).getByText("Invoice Created", { exact: true }),
    ).toBeVisible();
    await closeBell(page);

    // Turn it back on and confirm the notification returns.
    await preferenceToggle(page, "Invoice Funded").click();

    await page.reload();
    await connectWallet(page);
    await openBell(page);
    await expect(
      dropdown(page).getByText("Invoice Funded", { exact: true }),
    ).toBeVisible();
  });

  test("shows the empty state when there are no relevant events", async ({
    page,
  }) => {
    await installFreighter(page, WALLET_A);

    // Only an unrelated invoice/event exist, so nothing matches WALLET_A.
    const invoices = [
      makeInvoice(UNRELATED_INVOICE, "GBOTHERISSUERXX", "GBOTHERBUYERXX"),
    ];
    const events = [makeEvent(1, "InvoiceCreated", UNRELATED_INVOICE, 1000)];
    await mockNotificationApis(page, invoices, events);

    await page.goto("/");
    await connectWallet(page);

    await expect(unreadDot(page)).toHaveCount(0);
    await openBell(page);
    await expect(
      dropdown(page).getByText("No notifications yet"),
    ).toBeVisible();
  });

  test("does not leak one wallet's notifications into another wallet", async ({
    page,
  }) => {
    await installFreighter(page, WALLET_A);

    const invoices = [
      makeInvoice(RELEVANT_INVOICE, WALLET_A, "GBBUYERXXXXXXXX"),
    ];
    const events = [makeEvent(1, "InvoiceFunded", RELEVANT_INVOICE, 2000)];
    await mockNotificationApis(page, invoices, events);

    await page.goto("/");
    await connectWallet(page);
    await expect(unreadDot(page)).toBeVisible({ timeout: 15000 });
    await openBell(page);
    await expect(
      dropdown(page).getByText("Invoice Funded", { exact: true }),
    ).toBeVisible();
    await closeBell(page);

    // Swap the wallet returned by Freighter for a different address.
    await page.evaluate((addr) => {
      (window as any).freighter.requestAccess = () => Promise.resolve(addr);
      (window as any).freighter.getPublicKey = () => Promise.resolve(addr);
    }, WALLET_B);

    await page
      .getByRole("navigation")
      .getByRole("button", { name: /disconnect wallet/i })
      .click();
    await connectWallet(page);

    // The new wallet is party to no invoices, so it must show nothing.
    await expect(unreadDot(page)).toHaveCount(0);
    await openBell(page);
    await expect(
      dropdown(page).getByText("No notifications yet"),
    ).toBeVisible();
    await expect(
      dropdown(page).getByText("Invoice Funded", { exact: true }),
    ).toHaveCount(0);
  });
});
