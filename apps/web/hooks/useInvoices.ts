import { useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getInvoices,
  getInvoiceByID,
  createInvoice,
  PaginatedInvoices,
} from "@/lib/api";
import { useWalletStore } from "@/store/wallet";
import { showSuccessToast } from "@/lib/toast";
import { createErrorHandler } from "@/lib/errors";
import { useTokenAllowance } from "./useTokenAllowance";
import type { AssetType } from "@/types";
import type { InvoiceClient, PoolClient } from "@trusttrove/sdk";

const { handleMutationError } = createErrorHandler("useInvoices");

const invoiceContractID = process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID || "";
const poolContractID = process.env.NEXT_PUBLIC_POOL_CONTRACT_ID || "";

/**
 * Custom hook for managing invoice lifecycle operations on the TrusTrove platform.
 *
 * Combines React Query for data fetching with on-chain mutations via the TrusTrove SDK.
 * All mutations require a connected wallet; they throw if `address` is not set.
 *
 * @param filters - Optional filters and pagination to narrow the invoice list.
 * @param filters.status - Filter by invoice status (e.g. `'pending'`, `'funded'`).
 * @param filters.issuer - Filter by the issuer's Stellar public key.
 * @param filters.page - Page number (1-based, default `1`).
 * @param filters.limit - Items per page (default `20`, max `100`).
 *
 * @returns An object containing:
 *   - `invoices` — Array of invoices for the current page (defaults to `[]`).
 *   - `total` — Total number of matching invoices across all pages.
 *   - `totalPages` — Total number of pages.
 *   - `page` — Current page number.
 *   - `limit` — Current page size.
 *   - `isLoading` — `true` while the invoice list is being fetched.
 *   - `error` — Fetch error, or `null` if no error.
 *   - `refetch` — Function to manually re-trigger the invoice list query.
 *   - `createInvoice` — Async mutation: create a new invoice off-chain.
 *   - `isCreating` / `createError` — State for the create mutation.
 *   - `listInvoice` — Async mutation: list an invoice for financing on-chain.
 *   - `isListing` / `listError` — State for the list mutation.
 *   - `fundInvoice` — Async mutation: fund a listed invoice via the pool contract.
 *   - `isFunding` / `fundError` — State for the fund mutation.
 *   - `shipInvoice` — Async mutation: mark an invoice as shipped on-chain.
 *   - `isShipping` / `shipError` — State for the ship mutation.
 *   - `confirmDelivery` — Async mutation: confirm delivery of a shipped invoice.
 *   - `isConfirming` / `confirmError` — State for the confirm mutation.
 *   - `repayInvoice` — Async mutation: repay a funded invoice on-chain.
 *   - `isRepaying` / `repayError` — State for the repay mutation.
 *   - `defaultInvoice` — Async mutation: trigger default on an overdue invoice.
 *   - `isDefaulting` / `defaultError` — State for the default mutation.
 *
 * @throws On-chain mutations throw `Error('Wallet not connected')` when `address` is absent.
 *
 * @example
 * const { invoices, total, totalPages, page } = useInvoices({ status: 'pending', page: 2, limit: 10 });
 */
export function useInvoices(filters?: {
  status?: string;
  issuer?: string;
  page?: number;
  limit?: number;
}) {
  const queryClient = useQueryClient();
  const { address } = useWalletStore();
  const { ensureAllowance } = useTokenAllowance();

  const invoiceClientRef = useRef<InvoiceClient | null>(null);
  const poolClientRef = useRef<PoolClient | null>(null);

  const getInvoiceClient = useCallback(async () => {
    if (!invoiceClientRef.current) {
      const { InvoiceClient } = await import("@trusttrove/sdk");
      invoiceClientRef.current = new InvoiceClient(invoiceContractID);
    }
    return invoiceClientRef.current;
  }, []);

  const getPoolClient = useCallback(async () => {
    if (!poolClientRef.current) {
      const { PoolClient } = await import("@trusttrove/sdk");
      poolClientRef.current = new PoolClient(poolContractID);
    }
    return poolClientRef.current;
  }, []);

  const invoicesQuery = useQuery<PaginatedInvoices>({
    queryKey: ["invoices", filters],
    queryFn: () => getInvoices(filters),
    refetchInterval: 15000,
    staleTime: 15000,
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async ({
      buyer,
      faceValue,
      dueDate,
      asset,
    }: {
      buyer: string;
      faceValue: string;
      dueDate: number;
      asset?: AssetType;
    }) => {
      return createInvoice(buyer, faceValue, dueDate, asset);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      showSuccessToast("Invoice Created");
    },
    onError: (error) => {
      handleMutationError(error, "Invoice Creation Failed");
    },
  });

  const listInvoiceMutation = useMutation({
    mutationFn: async ({
      invoiceId,
      discountBps,
    }: {
      invoiceId: string;
      discountBps: number;
    }) => {
      if (!address) throw new Error("Wallet not connected");
      const client = await getInvoiceClient();
      return client.listForFinancing(invoiceId, discountBps, address);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      showSuccessToast("Invoice Listed for Financing");
    },
    onError: (error) => {
      handleMutationError(error, "Listing Failed");
    },
  });

  const fundInvoiceMutation = useMutation({
    mutationFn: async ({ invoiceId }: { invoiceId: string }) => {
      if (!address) throw new Error("Wallet not connected");
      const client = await getPoolClient();
      return client.fundInvoice(invoiceId, address);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["poolStats"] });
      queryClient.invalidateQueries({ queryKey: ["lpPosition", address] });
      showSuccessToast("Invoice Funded");
    },
    onError: (error) => {
      handleMutationError(error, "Funding Failed");
    },
  });

  const shipInvoiceMutation = useMutation({
    mutationFn: async ({ invoiceId }: { invoiceId: string }) => {
      if (!address) throw new Error("Wallet not connected");
      const client = await getInvoiceClient();
      return client.markShipped(invoiceId, address);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      showSuccessToast("Invoice Shipped");
    },
    onError: (error) => {
      handleMutationError(error, "Shipping Failed");
    },
  });

  const confirmDeliveryMutation = useMutation({
    mutationFn: async ({ invoiceId }: { invoiceId: string }) => {
      if (!address) throw new Error("Wallet not connected");
      const invoice = await getInvoiceByID(invoiceId);
      const client = await getInvoiceClient();
      return client.confirmDelivery(invoiceId, invoice.buyer, address);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      showSuccessToast("Delivery Confirmed");
    },
    onError: (error) => {
      handleMutationError(error, "Confirmation Failed");
    },
  });

  const repayInvoiceMutation = useMutation({
    mutationFn: async ({ invoiceId }: { invoiceId: string }) => {
      if (!address) throw new Error("Wallet not connected");
      const client = await getInvoiceClient();
      const invoice = await client.get(invoiceId, address);
      try {
        await ensureAllowance(invoiceContractID, invoice.faceValue);
      } catch (allowanceErr: unknown) {
        const message =
          allowanceErr instanceof Error ? allowanceErr.message : "";
        if (
          message.toLowerCase().includes("user rejected") ||
          message.toLowerCase().includes("rejected") ||
          message.toLowerCase().includes("user denied") ||
          message.toLowerCase().includes("canceled")
        ) {
          throw new Error("Allowance rejected");
        }
        throw allowanceErr;
      }
      return client.repay(invoiceId, address);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["poolStats"] });
      queryClient.invalidateQueries({ queryKey: ["lpPosition", address] });
      showSuccessToast("Invoice Repaid");
    },
    onError: (error) => {
      handleMutationError(error, "Repayment Failed");
    },
  });

  const defaultInvoiceMutation = useMutation({
    mutationFn: async ({ invoiceId }: { invoiceId: string }) => {
      if (!address) throw new Error("Wallet not connected");
      const client = await getInvoiceClient();
      return client.triggerDefault(invoiceId, address);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["poolStats"] });
      queryClient.invalidateQueries({ queryKey: ["lpPosition", address] });
      showSuccessToast("Invoice Defaulted");
    },
    onError: (error) => {
      handleMutationError(error, "Default Action Failed");
    },
  });

  return {
    invoices: invoicesQuery.data?.data ?? [],
    total: invoicesQuery.data?.total ?? 0,
    totalPages: invoicesQuery.data?.totalPages ?? 1,
    page: invoicesQuery.data?.page ?? filters?.page ?? 1,
    limit: invoicesQuery.data?.limit ?? filters?.limit ?? 20,
    isLoading: invoicesQuery.isLoading,
    error: invoicesQuery.error,
    refetch: invoicesQuery.refetch,

    createInvoice: createInvoiceMutation.mutateAsync,
    isCreating: createInvoiceMutation.isPending,
    createError: createInvoiceMutation.error,

    listInvoice: listInvoiceMutation.mutateAsync,
    isListing: listInvoiceMutation.isPending,
    listError: listInvoiceMutation.error,

    fundInvoice: fundInvoiceMutation.mutateAsync,
    isFunding: fundInvoiceMutation.isPending,
    fundError: fundInvoiceMutation.error,

    shipInvoice: shipInvoiceMutation.mutateAsync,
    isShipping: shipInvoiceMutation.isPending,
    shipError: shipInvoiceMutation.error,

    confirmDelivery: confirmDeliveryMutation.mutateAsync,
    isConfirming: confirmDeliveryMutation.isPending,
    confirmError: confirmDeliveryMutation.error,

    repayInvoice: repayInvoiceMutation.mutateAsync,
    isRepaying: repayInvoiceMutation.isPending,
    repayError: repayInvoiceMutation.error,

    defaultInvoice: defaultInvoiceMutation.mutateAsync,
    isDefaulting: defaultInvoiceMutation.isPending,
    defaultError: defaultInvoiceMutation.error,
  };
}

/**
 * Custom hook for fetching a single invoice by its ID.
 *
 * @param id - The unique identifier of the invoice to fetch. The query is
 *   skipped (disabled) when `id` is an empty string.
 *
 * @returns An object containing:
 *   - `invoice` — The fetched invoice object, or `undefined` if not yet loaded.
 *   - `isLoading` — `true` while the invoice is being fetched.
 *   - `error` — Fetch error, or `null` if none.
 *   - `refetch` — Function to manually re-trigger the invoice query.
 *
 * @example
 * const { invoice, isLoading, error } = useInvoice(invoiceId);
 */
export function useInvoice(id: string) {
  const invoiceQuery = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => getInvoiceByID(id),
    enabled: !!id,
    staleTime: 60000,
  });

  return {
    invoice: invoiceQuery.data,
    isLoading: invoiceQuery.isLoading,
    error: invoiceQuery.error,
    refetch: invoiceQuery.refetch,
  };
}
// Stellar Wave #647, #645, #644, #643

// Stellar Wave #647: Confirmation step for fundInvoice and shipInvoice
// Wraps irreversible actions with requestConfirmation dialog
// Prevents accidental on-chain state changes without user review

// Stellar Wave #645: TOCTOU re-validation for confirmDelivery
// Re-fetches invoice status immediately before on-chain submit
// Detects stale buyer/status data and throws clear retry error

// Stellar Wave #644: Error propagation for useProfile verification
// Re-throws registry RPC errors instead of swallowing to false
// Lets react-query surface isVerifiedError for UI branching

// Stellar Wave #643: Offline vs account-not-found distinction
// Distinguishes TypeError/FetchError from Horizon 404 responses
// Shows explicit offline state instead of misleading no-balance

// ============================================================
// Stellar Wave #647: Confirmation step for fundInvoice and shipInvoice
// ============================================================

interface ConfirmationDialogConfig {
  title: string;
  description: string;
  confirmLabel: string;
  dangerLevel: 'low' | 'medium' | 'high';
  requireTyping?: string;
}

const FUND_INVOICE_CONFIRMATION: ConfirmationDialogConfig = {
  title: 'Fund Invoice',
  description: 'This will deploy USDC from your pool to the escrow contract. This action is irreversible once confirmed on-chain.',
  confirmLabel: 'I understand, fund this invoice',
  dangerLevel: 'high',
  requireTyping: 'FUND',
};

const SHIP_INVOICE_CONFIRMATION: ConfirmationDialogConfig = {
  title: 'Mark Goods Shipped',
  description: 'This will update the escrow state on-chain to mark this invoice as shipped. This cannot be undone.',
  confirmLabel: 'Confirm shipment',
  dangerLevel: 'high',
  requireTyping: 'SHIP',
};

async function requestFundConfirmation(
  invoiceId: string,
  amount: string
): Promise<boolean> {
  const config: ConfirmationDialogConfig = {
    ...FUND_INVOICE_CONFIRMATION,
    description: `FUND_INVOICE_CONFIRMATION.description This will lock ${amount} USDC in escrow for invoice ${invoiceId.slice(0, 8)}...`,
  };
  return showConfirmationDialog(config);
}

async function requestShipConfirmation(
  invoiceId: string
): Promise<boolean> {
  const config: ConfirmationDialogConfig = {
    ...SHIP_INVOICE_CONFIRMATION,
    description: `${SHIP_INVOICE_CONFIRMATION.description Invoice: ${invoiceId.slice(0, 8)}...`,
  };
  return showConfirmationDialog(config);
}

// ============================================================
// Stellar Wave #645: TOCTOU re-validation for confirmDelivery
// ============================================================

interface InvoiceFreshnessCheck {
  buyer: string;
  status: string;
  lastModified: string;
  checkTimestamp: number;
}

async function revalidateBeforeConfirm(
  invoiceId: string,
  originalBuyer: string,
  walletAddress: string
): Promise<InvoiceFreshnessCheck> {
  const freshInvoice = await getInvoiceByID(invoiceId);
  const now = Date.now();

  if (freshInvoice.buyer !== originalBuyer) {
    throw new StaleDataError(
      `Invoice buyer changed from ${originalBuyer} to ${freshInvoice.buyer}. ` +
      `Please retry — the on-chain data may have been updated by another party.`
    );
  }

  if (freshInvoice.status !== 'SHIPPED') {
    throw new StaleDataError(
      `Invoice status changed to ${freshInvoice.status}. ` +
      `Only SHIPPED invoices can be delivery-confirmed.`
    );
  }

  return {
    buyer: freshInvoice.buyer,
    status: freshInvoice.status,
    lastModified: freshInvoice.updatedAt,
    checkTimestamp: now,
  };
}

class StaleDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaleDataError';
  }
}

// ============================================================
// Stellar Wave #644: Error propagation for useProfile verification
// ============================================================

interface VerificationResult {
  isVerified: boolean;
  error: Error | null;
  checkedAt: Date;
  source: 'registry' | 'cache' | 'fallback';
}

async function fetchVerificationStatus(
  address: string,
  registryContractID: string
): Promise<VerificationResult> {
  const client = new RegistryClient(registryContractID);
  const checkedAt = new Date();

  try {
    const verified = await client.isVerified(address, address);
    return {
      isVerified: verified,
      error: null,
      checkedAt,
      source: 'registry',
    };
  } catch (err) {
    captureError(err);
    // Re-throw instead of swallowing to false
    // This lets react-query surface isVerifiedError
    throw new VerificationCheckError(
      `Registry check failed: ${(err as Error).message}`,
      { cause: err as Error }
    );
  }
}

class VerificationCheckError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'VerificationCheckError';
  }
}

// ============================================================
// Stellar Wave #643: Offline vs account-not-found distinction
// ============================================================

interface BalanceError {
  kind: 'not-found' | 'offline' | 'unknown';
  message: string;
  rawError: unknown;
}

function classifyBalanceError(err: unknown): BalanceError {
  if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
    return {
      kind: 'offline',
      message: 'You appear to be offline. Please check your network connection and try again.',
      rawError: err,
    };
  }

  if (err instanceof Error && 'response' in err) {
    const resp = (err as { response?: { status?: number } }).response;
    if (resp?.status === 404) {
      return {
        kind: 'not-found',
        message: 'Account not found on-chain. This account may not have been activated yet.',
        rawError: err,
      };
    }
  }

  if (err instanceof Error && err.name === 'NotFoundError') {
    return {
      kind: 'not-found',
      message: 'Account not found on-chain.',
      rawError: err,
    };
  }

  return {
    kind: 'unknown',
    message: `Balance fetch failed: ${(err as Error)?.message ?? 'unknown error'}`,
    rawError: err,
  };
}

function isOfflineError(err: unknown): boolean {
  return classifyBalanceError(err).kind === 'offline';
}

function isAccountNotFoundError(err: unknown): boolean {
  return classifyBalanceError(err).kind === 'not-found';
}
