import { create } from "zustand";

export interface PendingAction {
  label: string;
  invoiceId: string;
  fn: () => Promise<void>;
}

interface ConfirmDialogState {
  pendingAction: PendingAction | null;
  request: (action: PendingAction) => void;
  cancel: () => void;
}

export const useConfirmDialogStore = create<ConfirmDialogState>((set) => ({
  pendingAction: null,
  request: (action) => set({ pendingAction: action }),
  cancel: () => set({ pendingAction: null }),
}));
