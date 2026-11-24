import { useState, useEffect, useCallback } from 'react';

export interface InvoiceDraftData {
  recipient?: string;
  amount?: string;
  memo?: string;
  description?: string;
  dueDate?: string;
}

export function useInvoiceDraft(walletAddress: string | undefined) {
  const storageKey = walletAddress ? `invoice_draft_${walletAddress}` : null;

  const [draft, setDraft] = useState<InvoiceDraftData | null>(null);
  const [hasDraft, setHasDraft] = useState<boolean>(false);
  const [restored, setRestored] = useState<boolean>(false);

  useEffect(() => {
    if (!storageKey) {
      setHasDraft(false);
      setRestored(false);
      setDraft(null);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setHasDraft(true);
          setRestored(false);
        } else {
          setHasDraft(false);
        }
      } else {
        setHasDraft(false);
        setRestored(false);
      }
    } catch {
      setHasDraft(false);
    }
  }, [storageKey]);

  const saveDraft = useCallback((data: InvoiceDraftData) => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save invoice draft', e);
    }
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
      setHasDraft(false);
      setRestored(false);
    } catch (e) {
      console.error('Failed to clear invoice draft', e);
    }
  }, [storageKey]);

  const restoreDraft = useCallback((): InvoiceDraftData | null => {
    if (!storageKey) return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setRestored(true);
        setHasDraft(false);
        return parsed;
      }
    } catch (e) {
      console.error('Failed to restore invoice draft', e);
    }
    return null;
  }, [storageKey]);

  return {
    hasDraft,
    restored,
    saveDraft,
    clearDraft,
    restoreDraft,
  };
}
