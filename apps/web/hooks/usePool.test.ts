import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePool } from './usePool';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PoolClient } from '@trusttrove/sdk';
import { useWalletStore } from '@/store/wallet';
import * as toast from '@/lib/toast';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock('@trusttrove/sdk', () => ({
  PoolClient: vi.fn(function () {}),
}));

vi.mock('@/lib/toast', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

describe('usePool', () => {
  let mockInvalidateQueries: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useWalletStore.getState().disconnect();

    mockInvalidateQueries = vi.fn();
    vi.mocked(useQueryClient).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    } as any);

    vi.mocked(useQuery).mockReturnValue({
      data: null,
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

  it('deposit works', async () => {
    act(() => {
      useWalletStore.getState().connect('G123', 'testnet');
    });
    
    const mockDeposit = vi.fn().mockResolvedValue('ok');
    vi.mocked(PoolClient).mockImplementation(function() { return {
      deposit: mockDeposit,
    } } as any);

    const { result } = renderHook(() => usePool());

    await act(async () => {
      await result.current.deposit({ amount: 100n });
    });

    expect(mockDeposit).toHaveBeenCalledWith('G123', 100n, 'G123');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['poolStats'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['lpPosition', 'G123'] });
    expect(toast.showSuccessToast).toHaveBeenCalled();
  });

  it('deposit fails if no wallet', async () => {
    const { result } = renderHook(() => usePool());

    await expect(
      act(async () => {
        await result.current.deposit({ amount: 100n });
      })
    ).rejects.toThrow('Wallet not connected');

    expect(toast.showErrorToast).toHaveBeenCalled();
  });

  it('withdraw works', async () => {
    act(() => {
      useWalletStore.getState().connect('G123', 'testnet');
    });
    
    const mockWithdraw = vi.fn().mockResolvedValue('ok');
    vi.mocked(PoolClient).mockImplementation(function() { return {
      withdraw: mockWithdraw,
    } } as any);

    const { result } = renderHook(() => usePool());

    await act(async () => {
      await result.current.withdraw({ shares: 50n });
    });

    expect(mockWithdraw).toHaveBeenCalledWith('G123', 50n, 'G123');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['poolStats'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['lpPosition', 'G123'] });
    expect(toast.showSuccessToast).toHaveBeenCalled();
  });
});
