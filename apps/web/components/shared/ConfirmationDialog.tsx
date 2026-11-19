"use client";

import React from "react";
import { X, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useConfirmDialogStore } from "@/store/confirmDialog";
import { truncateAddress } from "@/lib/format";

export function ConfirmationDialog() {
  const { pendingAction, cancel } = useConfirmDialogStore();
  const overlayRef = useFocusTrap<HTMLDivElement>(!!pendingAction, cancel);

  if (!pendingAction) return null;

  const handleConfirm = () => {
    const action = pendingAction;
    cancel();
    action.fn();
  };

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={cancel}
    >
      <div
        className="w-full max-w-sm bg-card border border-border rounded-lg p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h4
            id="confirmation-dialog-title"
            className="text-sm font-bold font-mono text-card-foreground uppercase tracking-wider"
          >
            Confirm {pendingAction.label}
          </h4>
          <button
            onClick={cancel}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close confirmation dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 mb-5 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-foreground/70">Action:</span>
            <span className="text-card-foreground">{pendingAction.label}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground/70">Invoice ID:</span>
            <span
              className="text-card-foreground"
              title={pendingAction.invoiceId}
            >
              {truncateAddress(pendingAction.invoiceId)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground/70">Estimated Fee:</span>
            <span className="text-card-foreground">Network fee applies</span>
          </div>
        </div>

        <p className="text-[10px] text-amber-700 dark:text-amber-400 font-mono mb-4 leading-normal">
          This action is irreversible once submitted on-chain. Review carefully
          before confirming.
        </p>

        <div className="flex gap-2">
          <Button
            className="flex-1 border border-border bg-transparent hover:bg-muted text-foreground text-[10px] font-bold uppercase py-2"
            onClick={cancel}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-rose-700 hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-700 text-white text-[10px] font-bold uppercase py-2"
            onClick={handleConfirm}
          >
            CONFIRM
          </Button>
        </div>
      </div>
    </div>
  );
}
