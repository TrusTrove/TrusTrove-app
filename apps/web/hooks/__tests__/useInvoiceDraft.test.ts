import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useInvoiceDraft } from '../useInvoiceDraft';

describe('useInvoiceDraft', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should detect no draft initially when wallet is not connected', () => {
    const { result } = renderHook(() => useInvoiceDraft(undefined));
    expect(result.current.hasDraft).toBe(false);
  });

  it('should save and restore draft per wallet correctly', () => {
    const walletA = '0xWalletA';
    const { result: hookA } = renderHook(() => useInvoiceDraft(walletA));

    act(() => {
      hookA.current.saveDraft({ amount: '100', memo: 'Test Invoice' });
    });

    const { result: hookA_reload } = renderHook(() => useInvoiceDraft(walletA));
    expect(hookA_reload.current.hasDraft).toBe(true);

    let restoredData;
    act(() => {
      restoredData = hookA_reload.current.restoreDraft();
    });

    expect(restoredData).toEqual({ amount: '100', memo: 'Test Invoice' });
    expect(hookA_reload.current.hasDraft).toBe(false);

    act(() => {
      hookA_reload.current.clearDraft();
    });
    expect(hookA_reload.current.hasDraft).toBe(false);
  });

  it('should not leak drafts between different wallets (permission boundary)', () => {
    const walletA = '0xWalletA';
    const walletB = '0xWalletB';

    const { result: hookA } = renderHook(() => useInvoiceDraft(walletA));
    act(() => {
      hookA.current.saveDraft({ amount: '500' });
    });

    const { result: hookB } = renderHook(() => useInvoiceDraft(walletB));
    expect(hookB.current.hasDraft).toBe(false);
  });
});
