import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useAppError } from "./useAppError";

describe("useAppError", () => {
  it("initial state has no error", () => {
    const { result } = renderHook(() => useAppError());
    expect(result.current.error).toBeNull();
  });

  it("handleError sets a user-friendly message from an Error instance", () => {
    const { result } = renderHook(() => useAppError());

    act(() => {
      result.current.handleError(new Error("Wallet not connected"));
    });

    expect(result.current.error).toBe(
      "Please connect your wallet to perform this action",
    );
  });

  it("handleError preserves the message from an unknown Error instance", () => {
    const { result } = renderHook(() => useAppError());

    act(() => {
      result.current.handleError(new Error("Disk full"));
    });

    expect(result.current.error).toBe("Disk full");
  });

  it("handleError with an object having a message property extracts the message", () => {
    const { result } = renderHook(() => useAppError());

    act(() => {
      result.current.handleError({ message: "Rate limit exceeded" });
    });

    expect(result.current.error).toBe("Rate limit exceeded");
  });

  it("clearError resets the error to null", () => {
    const { result } = renderHook(() => useAppError());

    act(() => {
      result.current.handleError(new Error("fail"));
    });
    expect(result.current.error).toBe("fail");

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });

  it("setError allows setting an arbitrary error string directly", () => {
    const { result } = renderHook(() => useAppError());

    act(() => {
      result.current.setError("Custom error");
    });

    expect(result.current.error).toBe("Custom error");
  });

  it("handleError with a string error returns the string as-is", () => {
    const { result } = renderHook(() => useAppError());

    act(() => {
      result.current.handleError("raw string error");
    });

    expect(result.current.error).toBe("raw string error");
  });
});
