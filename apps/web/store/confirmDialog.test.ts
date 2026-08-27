import { describe, it, expect, vi, beforeEach } from "vitest";
import { useConfirmDialogStore } from "@/store/confirmDialog";

beforeEach(() => {
  useConfirmDialogStore.setState({
    pendingAction: null,
  });
});

describe("confirmDialog store", () => {
  it("initial state has no pending action", () => {
    const state = useConfirmDialogStore.getState();
    expect(state.pendingAction).toBeNull();
  });

  it("request() sets a pending action", () => {
    const fn = vi.fn(async () => {});
    useConfirmDialogStore.getState().request({
      label: "Approve",
      invoiceId: "inv-1",
      fn,
    });

    const { pendingAction } = useConfirmDialogStore.getState();
    expect(pendingAction).not.toBeNull();
    expect(pendingAction?.label).toBe("Approve");
    expect(pendingAction?.invoiceId).toBe("inv-1");
    expect(pendingAction?.fn).toBe(fn);
  });

  it("request() overwrites an existing pending action", () => {
    const firstFn = vi.fn(async () => {});
    const secondFn = vi.fn(async () => {});
    useConfirmDialogStore.getState().request({
      label: "Approve",
      invoiceId: "inv-1",
      fn: firstFn,
    });
    useConfirmDialogStore.getState().request({
      label: "Reject",
      invoiceId: "inv-2",
      fn: secondFn,
    });

    const { pendingAction } = useConfirmDialogStore.getState();
    expect(pendingAction?.label).toBe("Reject");
    expect(pendingAction?.invoiceId).toBe("inv-2");
    expect(pendingAction?.fn).toBe(secondFn);
  });

  it("cancel() clears a pending action", () => {
    useConfirmDialogStore.getState().request({
      label: "Approve",
      invoiceId: "inv-1",
      fn: vi.fn(async () => {}),
    });

    useConfirmDialogStore.getState().cancel();

    expect(useConfirmDialogStore.getState().pendingAction).toBeNull();
  });

  it("cancel() is a no-op when no action is pending", () => {
    useConfirmDialogStore.getState().cancel();
    expect(useConfirmDialogStore.getState().pendingAction).toBeNull();
  });

  it("pending action fn executes when invoked", async () => {
    const fn = vi.fn(async () => {});
    useConfirmDialogStore.getState().request({
      label: "Approve",
      invoiceId: "inv-1",
      fn,
    });

    await useConfirmDialogStore.getState().pendingAction?.fn();

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
