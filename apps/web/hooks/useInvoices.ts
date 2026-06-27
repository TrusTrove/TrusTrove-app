import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInvoices, getInvoiceByID, createInvoice, PaginatedInvoices } from '@/lib/api';
import { InvoiceClient, PoolClient } from '@trusttrove/sdk';
import { useWalletStore } from '@/store/wallet';
import { showSuccessToast, showErrorToast } from '@/lib/toast';

const invoiceContractID = process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID || '';
const poolContractID = process.env.NEXT_PUBLIC_POOL_CONTRACT_ID || '';

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
export function useInvoices(filters?: { status?: string; issuer?: string; page?: number; limit?: number }) {
  const queryClient = useQueryClient();
  const { address } = useWalletStore();

  const invoicesQuery = useQuery<PaginatedInvoices>({
    queryKey: ['invoices', filters],
    queryFn: () => getInvoices(filters),
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async ({ buyer, faceValue, dueDate, asset }: { buyer: string; faceValue: string; dueDate: number; asset?: string }) => {
      return createInvoice(buyer, faceValue, dueDate, asset as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      showSuccessToast('Invoice Created');
    },
    onError: (error) => {
      showErrorToast('Invoice Creation Failed', error instanceof Error ? error : undefined);
    },
  });

  const listInvoiceMutation = useMutation({
    mutationFn: async ({ invoiceId, discountBps }: { invoiceId: string; discountBps: number }) => {
      if (!address) throw new Error('Wallet not connected');
      const invoiceClient = new InvoiceClient(invoiceContractID);
      return invoiceClient.listForFinancing(invoiceId, discountBps, address);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      showSuccessToast('Invoice Listed for Financing');
    },
    onError: (error) => {
      showErrorToast('Listing Failed', error instanceof Error ? error : undefined);
    },
  });

  const fundInvoiceMutation = useMutation({
    mutationFn: async ({ invoiceId }: { invoiceId: string }) => {
      if (!address) throw new Error('Wallet not connected');
      const poolClient = new PoolClient(poolContractID);
      return poolClient.fundInvoice(invoiceId, address);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['poolStats'] });
      queryClient.invalidateQueries({ queryKey: ['lpPosition', address] });
      showSuccessToast('Invoice Funded');
    },
    onError: (error) => {
      showErrorToast('Funding Failed', error instanceof Error ? error : undefined);
    },
  });

  const shipInvoiceMutation = useMutation({
    mutationFn: async ({ invoiceId }: { invoiceId: string }) => {
      if (!address) throw new Error('Wallet not connected');
      const invoiceClient = new InvoiceClient(invoiceContractID);
      return invoiceClient.markShipped(invoiceId, address);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      showSuccessToast('Invoice Shipped');
    },
    onError: (error) => {
      showErrorToast('Shipping Failed', error instanceof Error ? error : undefined);
    },
  });

const confirmDeliveryMutation = useMutation({
      mutationFn: async ({ invoiceId }: { invoiceId: string }) => {
        if (!address) throw new Error('Wallet not connected');
        const invoiceClient = new InvoiceClient(invoiceContractID);
        const invoice = await getInvoiceByID(invoiceId);
        return invoiceClient.confirmDelivery(invoiceId, invoice.buyer, address);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        showSuccessToast('Delivery Confirmed');
      },
      onError: (error) => {
        showErrorToast('Confirmation Failed', error instanceof Error ? error : undefined);
      },
    });

  const repayInvoiceMutation = useMutation({
    mutationFn: async ({ invoiceId }: { invoiceId: string }) => {
      if (!address) throw new Error('Wallet not connected');
      const invoiceClient = new InvoiceClient(invoiceContractID);
      return invoiceClient.repay(invoiceId, address);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['poolStats'] });
      queryClient.invalidateQueries({ queryKey: ['lpPosition', address] });
      showSuccessToast('Invoice Repaid');
    },
    onError: (error) => {
      showErrorToast('Repayment Failed', error instanceof Error ? error : undefined);
    },
  });

  const defaultInvoiceMutation = useMutation({
    mutationFn: async ({ invoiceId }: { invoiceId: string }) => {
      if (!address) throw new Error('Wallet not connected');
      const invoiceClient = new InvoiceClient(invoiceContractID);
      return invoiceClient.triggerDefault(invoiceId, address);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['poolStats'] });
      queryClient.invalidateQueries({ queryKey: ['lpPosition', address] });
      showSuccessToast('Invoice Defaulted');
    },
    onError: (error) => {
      showErrorToast('Default Action Failed', error instanceof Error ? error : undefined);
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
    queryKey: ['invoice', id],
    queryFn: () => getInvoiceByID(id),
    enabled: !!id,
  });

  return {
    invoice: invoiceQuery.data,
    isLoading: invoiceQuery.isLoading,
    error: invoiceQuery.error,
    refetch: invoiceQuery.refetch,
  };
}
