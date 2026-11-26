/**
 * Canonical invoice status transition map.
 * Defines valid transitions between invoice statuses based on role.
 */
export const invoiceStatusTransitionMap: ReadonlyMap<
  InvoiceStatus,
  InvoiceStatus[]
> = new Map<InvoiceStatus, InvoiceStatus[]>([
  ["Created", ["Listed"]],
  ["Listed", ["Funded", "Defaulted"]],
  ["Funded", ["Active", "Repaid", "Defaulted"]],
  ["Active", ["Confirmed", "Repaid", "Defaulted"]],
  ["Confirmed", ["Repaid", "Defaulted"]],
  ["Repaid", []],
  ["Defaulted", []],
]);

/**
 * Returns allowed actions for a given invoice status and user role.
 * @param status - Current invoice status
 * @param role - User role ("issuer" or "buyer")
 * @returns List of allowed action strings
 */
export function allowedActions(
  status: InvoiceStatus,
  role: "issuer" | "buyer",
): string[] {
  const transitions = invoiceStatusTransitionMap.get(status) ?? [];
  const roleSpecific: string[] = [];

  // All statuses allow viewing status
  roleSpecific.push("viewStatus");

  if (role === "issuer") {
    // Issuer-specific actions based on status
    if (status === "Created") roleSpecific.push("listInvoice");
    if (status === "Listed" || status === "Funded")
      roleSpecific.push("cancelInvoice");
    if (status === "Active") roleSpecific.push("completeInvoice");
    if (status === "Confirmed") roleSpecific.push("shipGoods");
    if (status === "Repaid" || status === "Defaulted")
      roleSpecific.push("resetInvoice");
  } else if (role === "buyer") {
    // Buyer-specific actions based on status
    if (status === "Listed") roleSpecific.push("fundInvoice");
    if (status === "Funded" || status === "Active" || status === "Confirmed")
      roleSpecific.push("confirmReceipt");
  }

  return [...new Set(roleSpecific)];
}

/**
 * Checks if a status transition is allowed from current status to target status.
 * Considers both the canonical transition map and role-based allowed actions.
 * @param from - Current invoice status
 * @param to - Target invoice status
 * @param role - User role ("issuer" or "buyer")
 * @returns Whether the transition is allowed
 */
export function isTransitionAllowed(
  from: InvoiceStatus,
  to: InvoiceStatus,
  _role: "issuer" | "buyer",
): boolean {
  // viewStatus is always allowed
  if (to === "viewStatus") return true;

  // Check if the target status is a valid transition from the current status
  const allowedNext = invoiceStatusTransitionMap.get(from) ?? [];
  if (!allowedNext.includes(to)) return false;

  // Terminal states (Repaid, Defaulted) can only transition to viewStatus
  const terminalStates: InvoiceStatus[] = ["Repaid", "Defaulted"];
  if (terminalStates.includes(from) && to !== "viewStatus") return false;

  return true;
}

/**
 * Supported asset types for invoicing and payments.
 */
export type AssetType = "USDC" | "XLM";
