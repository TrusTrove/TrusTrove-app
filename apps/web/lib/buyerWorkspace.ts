import type { Invoice } from "@/types";

/**
 * A Stellar account address is a base32-encoded ed25519 public key: `G`,
 * followed by 55 characters from the base32 alphabet.
 */
const STELLAR_ACCOUNT_RE = /^G[A-Z2-7]{55}$/;

/**
 * Returns `true` when `address` looks like a Stellar account address.
 *
 * The buyer workspace only queries the indexer for a well-formed address, so
 * a missing or malformed wallet value cannot leak a stale invoice list or
 * trigger a pointless network request.
 */
export function isValidBuyerAddress(address?: string | null): boolean {
  return typeof address === "string" && STELLAR_ACCOUNT_RE.test(address.trim());
}

/**
 * Keeps only the invoices addressed to `buyer`.
 *
 * Matching is exact on the Stellar address, so a connected buyer can never see
 * another party's obligations. A missing or invalid address matches nothing.
 */
export function filterBuyerInvoices(
  invoices: readonly Invoice[],
  buyer?: string | null,
): Invoice[] {
  if (!isValidBuyerAddress(buyer)) return [];
  const address = buyer!.trim();
  return invoices.filter((invoice) => invoice.buyer === address);
}

/** One "next action" bucket in the buyer workspace. */
export interface BuyerInvoiceGroup {
  /** Stable key for React lists and tests. */
  key:
    | "overdue"
    | "repay"
    | "confirm-delivery"
    | "awaiting-shipment"
    | "awaiting-financing"
    | "closed";
  /** Heading shown above the group. */
  title: string;
  /** One-line explanation of what the buyer should do next. */
  description: string;
  /** Matching invoices, soonest due date first. */
  invoices: Invoice[];
}

const CLOSED_STATUSES = new Set(["Repaid", "Defaulted", "Cancelled"]);

function sortByDueDate(invoices: Invoice[]): Invoice[] {
  return [...invoices].sort(
    (a, b) => Number(a.dueDate) - Number(b.dueDate) || a.id.localeCompare(b.id),
  );
}

/**
 * Buckets a buyer's invoices by the next action they require.
 *
 * Only invoices addressed to `buyer` are considered (see
 * {@link filterBuyerInvoices}); empty groups are omitted. The order is the
 * order a buyer should work through them: overdue repayments, repayments,
 * delivery confirmations, awaiting shipment, not-yet-financed, then closed.
 *
 * @param invoices - The full invoice set fetched from the indexer.
 * @param buyer - The connected wallet address.
 * @param now - Unix timestamp in seconds, injectable for deterministic tests.
 * @returns Ordered {@link BuyerInvoiceGroup}s, each with a non-empty
 *   `invoices` array.
 */
export function groupBuyerInvoices(
  invoices: readonly Invoice[],
  buyer?: string | null,
  now: number = Math.floor(Date.now() / 1000),
): BuyerInvoiceGroup[] {
  const mine = filterBuyerInvoices(invoices, buyer);

  const overdue: Invoice[] = [];
  const repay: Invoice[] = [];
  const confirmDelivery: Invoice[] = [];
  const awaitingShipment: Invoice[] = [];
  const awaitingFinancing: Invoice[] = [];
  const closed: Invoice[] = [];

  for (const invoice of mine) {
    if (CLOSED_STATUSES.has(invoice.status)) {
      closed.push(invoice);
      continue;
    }
    switch (invoice.status) {
      case "Confirmed":
        if (Number(invoice.dueDate) < now) overdue.push(invoice);
        else repay.push(invoice);
        break;
      case "Active":
        confirmDelivery.push(invoice);
        break;
      case "Funded":
        awaitingShipment.push(invoice);
        break;
      case "Created":
      case "Listed":
        awaitingFinancing.push(invoice);
        break;
      default:
        closed.push(invoice);
        break;
    }
  }

  const groups: BuyerInvoiceGroup[] = [
    {
      key: "overdue",
      title: "Overdue — repay now",
      description:
        "The due date has passed. Repay these invoices to avoid a default.",
      invoices: overdue,
    },
    {
      key: "repay",
      title: "Repay invoice",
      description:
        "Delivery is confirmed. Repay the face value before the due date.",
      invoices: repay,
    },
    {
      key: "confirm-delivery",
      title: "Confirm delivery",
      description:
        "Goods have shipped. Confirm receipt to unlock repayment and release the escrow condition.",
      invoices: confirmDelivery,
    },
    {
      key: "awaiting-shipment",
      title: "Awaiting shipment",
      description:
        "Financing is in place. The issuer still has to mark these goods as shipped.",
      invoices: awaitingShipment,
    },
    {
      key: "awaiting-financing",
      title: "Awaiting financing",
      description:
        "Created or listed, but not funded yet — no action is needed from you.",
      invoices: awaitingFinancing,
    },
    {
      key: "closed",
      title: "Closed",
      description: "Repaid, defaulted, or cancelled obligations.",
      invoices: closed,
    },
  ];

  return groups
    .map((group) => ({ ...group, invoices: sortByDueDate(group.invoices) }))
    .filter((group) => group.invoices.length > 0);
}

/**
 * Counts the invoices in a buyer's actionable groups (everything except
 * "awaiting financing" and "closed"), for the workspace summary.
 */
export function countActionableInvoices(groups: BuyerInvoiceGroup[]): number {
  return groups
    .filter(
      (group) =>
        group.key !== "awaiting-financing" && group.key !== "closed",
    )
    .reduce((total, group) => total + group.invoices.length, 0);
}
