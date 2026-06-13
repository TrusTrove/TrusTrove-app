import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInvoices, getInvoiceByID, createInvoice } from '@/lib/api';
import { InvoiceClient, PoolClient } from '@trusttrove/sdk';
import { useWalletStore } from '@/store/wallet';

const invoiceContractID = process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID || '';
const poolContractID = process.env.NEXT_PUBLIC_POOL_CONTRACT_ID || '';

/**
 * Custom hook for managing invoice lifecycle operations on the TrusTrove platform.
 *
 * Combines React Query for data fetching with on-chain mutations via the TrusTrove SDK.
 * All mutations require a connected wallet; they throw if `address` is not set.
 *
 * @param filters - Optional filters to narrow the invoice list.
 * @param filters.status - Filter by invoice status (e.g. `'pending'`, `'funded'`).
 * @param filters.issuer - Filter by the issuer's Stellar public key.
 *
 * @returns An object containing:
 *   - `invoices` — Array of invoices matching the current filters (defaults to `[]`).
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
 * const { invoices, isLoading, createInvoice, isCreating } = useInvoices({ status: 'pending' });
 */
export function useInvoices(filters?: { status?: string; issuer?: string }) {
  const queryClient = useQueryClient();
  const { address } = useWalletStore();

  const invoicesQuery = useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => getInvoices(filters),
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async ({ buyer, faceValue, dueDate }: { buyer: string; faceValue: string; dueDate: number }) => {
      return createInvoice(buyer, faceValue, dueDate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
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
    },
  });

  const confirmDeliveryMutation = useMutation({
    mutationFn: async ({ invoiceId }: { invoiceId: string }) => {
      if (!address) throw new Error('Wallet not connected');
      const invoiceClient = new InvoiceClient(invoiceContractID);
      return invoiceClient.confirmDelivery(invoiceId, address, address);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
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
    },
  });

  return {
    invoices: invoicesQuery.data || [],
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
