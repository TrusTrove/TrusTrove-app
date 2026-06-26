import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useInvoices, useInvoice } from './useInvoices';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInvoices, getInvoiceByID, createInvoice } from '@/lib/api';
import { InvoiceClient, PoolClient } from '@trusttrove/sdk';
import { useWalletStore } from '@/store/wallet';
import * as toast from '@/lib/toast';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  getInvoices: vi.fn(),
  getInvoiceByID: vi.fn(),
  createInvoice: vi.fn(),
}));

vi.mock('@trusttrove/sdk', () => ({
  InvoiceClient: vi.fn(function () {}),
  PoolClient: vi.fn(function () {}),
}));

vi.mock('@/lib/toast', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

describe('useInvoices', () => {
  let mockInvalidateQueries: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useWalletStore.getState().disconnect();

    mockInvalidateQueries = vi.fn();
    vi.mocked(useQueryClient).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    } as any);

    vi.mocked(useQuery).mockReturnValue({
      data: {
        data: [{ id: '1', faceValue: '100' }],
        total: 1,
        totalPages: 1,
        page: 1,
        limit: 20,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(useMutation).mockImplementation((options: any) => {
      return {
        mutateAsync: async (args: any) => {
          try {
            const res = await options.mutationFn(args);
            options.onSuccess?.(res);
            return res;
          } catch (e) {
            options.onError?.(e);
            throw e;
          }
        },
        isPending: false,
        error: null,
      } as any;
    });
  });

  it('returns paginated invoices', () => {
    const { result } = renderHook(() => useInvoices());
    expect(result.current.invoices).toHaveLength(1);
    expect(result.current.total).toBe(1);
    expect(result.current.isLoading).toBe(false);
  });

  it('createInvoice works and invalidates query', async () => {
    vi.mocked(createInvoice).mockResolvedValue({ invoice_id: 'new_1' } as any);

    const { result } = renderHook(() => useInvoices());

    await act(async () => {
      await result.current.createInvoice({
        buyer: 'G123',
        faceValue: '100',
        dueDate: 1234567890,
      });
    });

    expect(createInvoice).toHaveBeenCalledWith('G123', '100', 1234567890, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['invoices'] });
    expect(toast.showSuccessToast).toHaveBeenCalled();
  });

  it('listInvoice works and invalidates query', async () => {
    act(() => {
      useWalletStore.getState().connect('G123', 'testnet');
    });
    
    const mockList = vi.fn().mockResolvedValue('ok');
    vi.mocked(InvoiceClient).mockImplementation(function() { return {
      listForFinancing: mockList,
    } } as any);

    const { result } = renderHook(() => useInvoices());

    await act(async () => {
      await result.current.listInvoice({ invoiceId: 'inv1', discountBps: 200 });
    });

    expect(mockList).toHaveBeenCalledWith('inv1', 200, 'G123');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['invoices'] });
  });

  it('listInvoice fails if no wallet', async () => {
    const { result } = renderHook(() => useInvoices());

    await expect(
      act(async () => {
        await result.current.listInvoice({ invoiceId: 'inv1', discountBps: 200 });
      })
    ).rejects.toThrow('Wallet not connected');

    expect(toast.showErrorToast).toHaveBeenCalled();
  });

  it('fundInvoice works', async () => {
    act(() => {
      useWalletStore.getState().connect('G123', 'testnet');
    });
    
    const mockFund = vi.fn().mockResolvedValue('ok');
    vi.mocked(PoolClient).mockImplementation(function() { return {
      fundInvoice: mockFund,
    } } as any);

    const { result } = renderHook(() => useInvoices());

    await act(async () => {
      await result.current.fundInvoice({ invoiceId: 'inv1' });
    });

    expect(mockFund).toHaveBeenCalledWith('inv1', 'G123');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['invoices'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['poolStats'] });
  });

  it('shipInvoice works', async () => {
    act(() => {
      useWalletStore.getState().connect('G123', 'testnet');
    });
    
    const mockShip = vi.fn().mockResolvedValue('ok');
    vi.mocked(InvoiceClient).mockImplementation(function() { return {
      markShipped: mockShip,
    } } as any);

    const { result } = renderHook(() => useInvoices());

    await act(async () => {
      await result.current.shipInvoice({ invoiceId: 'inv1' });
    });

    expect(mockShip).toHaveBeenCalledWith('inv1', 'G123');
  });

  it('confirmDelivery works', async () => {
    act(() => {
      useWalletStore.getState().connect('G123', 'testnet');
    });
    
    vi.mocked(getInvoiceByID).mockResolvedValue({ buyer: 'G_BUYER' } as any);
    const mockConfirm = vi.fn().mockResolvedValue('ok');
    vi.mocked(InvoiceClient).mockImplementation(function() { return {
      confirmDelivery: mockConfirm,
    } } as any);

    const { result } = renderHook(() => useInvoices());

    await act(async () => {
      await result.current.confirmDelivery({ invoiceId: 'inv1' });
    });

    expect(mockConfirm).toHaveBeenCalledWith('inv1', 'G_BUYER', 'G123');
  });

  it('repayInvoice works', async () => {
    act(() => {
      useWalletStore.getState().connect('G123', 'testnet');
    });
    
    const mockRepay = vi.fn().mockResolvedValue('ok');
    vi.mocked(InvoiceClient).mockImplementation(function() { return {
      repay: mockRepay,
    } } as any);

    const { result } = renderHook(() => useInvoices());

    await act(async () => {
      await result.current.repayInvoice({ invoiceId: 'inv1' });
    });

    expect(mockRepay).toHaveBeenCalledWith('inv1', 'G123');
  });

  it('defaultInvoice works', async () => {
    act(() => {
      useWalletStore.getState().connect('G123', 'testnet');
    });
    
    const mockDefault = vi.fn().mockResolvedValue('ok');
    vi.mocked(InvoiceClient).mockImplementation(function() { return {
      triggerDefault: mockDefault,
    } } as any);

    const { result } = renderHook(() => useInvoices());

    await act(async () => {
      await result.current.defaultInvoice({ invoiceId: 'inv1' });
    });

    expect(mockDefault).toHaveBeenCalledWith('inv1', 'G123');
  });
});

describe('useInvoice', () => {
  it('fetches a single invoice', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: { id: 'inv1' },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useInvoice('inv1'));
    expect(result.current.invoice).toEqual({ id: 'inv1' });
  });
});
