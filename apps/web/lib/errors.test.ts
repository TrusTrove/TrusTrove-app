import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AppError,
  classifyError,
  getErrorMessage,
  getUserFriendlyMessage,
  createErrorHandler,
} from "./errors";

vi.mock("./toast", () => ({
  showErrorToast: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AppError", () => {
  it("creates an error with all fields", () => {
    const original = new Error("original");
    const err = new AppError({
      type: "network",
      context: "useWallet",
      message: "Connection failed",
      originalError: original,
    });

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.name).toBe("AppError");
    expect(err.type).toBe("network");
    expect(err.context).toBe("useWallet");
    expect(err.message).toBe("Connection failed");
    expect(err.originalError).toBe(original);
    expect(err.timestamp).toBeTypeOf("number");
  });

  it("defaults originalError to undefined", () => {
    const err = new AppError({
      type: "validation",
      context: "test",
      message: "bad input",
    });
    expect(err.originalError).toBeUndefined();
  });
});

describe("classifyError", () => {
  it("returns AppError's own type", () => {
    const err = new AppError({
      type: "contract",
      context: "test",
      message: "fail",
    });
    expect(classifyError(err)).toBe("contract");
  });

  it("classifies TypeError as network", () => {
    expect(classifyError(new TypeError("fail"))).toBe("network");
  });

  it("classifies Error with 'network' in message as network", () => {
    expect(classifyError(new Error("network error"))).toBe("network");
  });

  it("classifies Error with 'fetch' in message as network", () => {
    expect(classifyError(new Error("fetch failed"))).toBe("network");
  });

  it("classifies Error with 'timeout' in message as network", () => {
    expect(classifyError(new Error("request timeout"))).toBe("network");
  });

  it("classifies Error with 'required' in message as validation", () => {
    expect(classifyError(new Error("Amount is required"))).toBe("validation");
  });

  it("classifies Error with 'not connected' in message as validation", () => {
    expect(classifyError(new Error("Wallet not connected"))).toBe("validation");
  });

  it("classifies plain Error as contract", () => {
    expect(classifyError(new Error("something broke"))).toBe("contract");
  });

  it("classifies null as contract", () => {
    expect(classifyError(null)).toBe("contract");
  });
});

describe("getErrorMessage", () => {
  it("returns string directly", () => {
    expect(getErrorMessage("oops")).toBe("oops");
  });

  it("returns Error.message", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns object.message when string", () => {
    expect(getErrorMessage({ message: "fail" })).toBe("fail");
  });

  it("returns fallback for null", () => {
    expect(getErrorMessage(null)).toBe("An unexpected error occurred");
  });

  it("returns custom fallback", () => {
    expect(getErrorMessage(null, "custom")).toBe("custom");
  });
});

describe("getUserFriendlyMessage", () => {
  it("maps Wallet not connected to friendly message", () => {
    expect(getUserFriendlyMessage("Wallet not connected")).toBe(
      "Please connect your wallet to perform this action",
    );
  });

  it("maps Error with Wallet not connected message", () => {
    expect(getUserFriendlyMessage(new Error("Wallet not connected"))).toBe(
      "Please connect your wallet to perform this action",
    );
  });

  it("passes through unknown strings", () => {
    expect(getUserFriendlyMessage("random error")).toBe("random error");
  });

  it("returns fallback for null", () => {
    expect(getUserFriendlyMessage(null)).toBe("An unexpected error occurred");
  });
});

describe("createErrorHandler", () => {
  it("captureError wraps into AppError and logs", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { captureError } = createErrorHandler("useTest");

    const appError = captureError(new Error("boom"));

    expect(appError).toBeInstanceOf(AppError);
    expect(appError.context).toBe("useTest");
    expect(appError.message).toBe("boom");
    expect(appError.type).toBe("contract");
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("handleError shows toast when action is provided", async () => {
    const { showErrorToast } = await import("./toast");
    const { handleError } = createErrorHandler("useTest");

    handleError(new Error("fail"), "Load failed");

    expect(showErrorToast).toHaveBeenCalledWith(
      "Load failed",
      expect.any(AppError),
    );
  });

  it("handleError does not show toast without action", async () => {
    const { showErrorToast } = await import("./toast");
    const { handleError } = createErrorHandler("useTest");

    handleError(new Error("fail"));

    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it("handleMutationError always shows toast", async () => {
    const { showErrorToast } = await import("./toast");
    const { handleMutationError } = createErrorHandler("useTest");

    handleMutationError(new Error("fail"), "Save failed");

    expect(showErrorToast).toHaveBeenCalledWith(
      "Save failed",
      expect.any(AppError),
    );
  });
});
