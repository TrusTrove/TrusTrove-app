import { describe, it, expect } from "vitest";
import { getErrorMessage, getUserFriendlyMessage } from "./errors";

describe("getErrorMessage", () => {
  it("returns the string directly when given a string", () => {
    expect(getErrorMessage("something broke")).toBe("something broke");
  });

  it("returns the message property from an Error instance", () => {
    const error = new Error("network timeout");
    expect(getErrorMessage(error)).toBe("network timeout");
  });

  it("returns the message from an object with a string message field", () => {
    const error = { message: "simulation failed" };
    expect(getErrorMessage(error)).toBe("simulation failed");
  });

  it("returns the default fallback for null", () => {
    expect(getErrorMessage(null)).toBe("An unexpected error occurred");
  });

  it("returns the default fallback for undefined", () => {
    expect(getErrorMessage(undefined)).toBe("An unexpected error occurred");
  });

  it("returns the default fallback for a number", () => {
    expect(getErrorMessage(42)).toBe("An unexpected error occurred");
  });

  it("returns a custom fallback when provided", () => {
    expect(getErrorMessage(null, "custom fallback")).toBe("custom fallback");
  });

  it("prefers the error message over the fallback", () => {
    expect(getErrorMessage("actual error", "fallback")).toBe("actual error");
  });

  it("returns the default fallback for an object without a message field", () => {
    expect(getErrorMessage({ code: 500 })).toBe("An unexpected error occurred");
  });
});

describe("getUserFriendlyMessage", () => {
  it("maps 'Wallet not connected' to a user-friendly message", () => {
    expect(getUserFriendlyMessage("Wallet not connected")).toBe(
      "Please connect your wallet to perform this action",
    );
  });

  it("maps a Wallet not connected Error to a user-friendly message", () => {
    const error = new Error("Wallet not connected");
    expect(getUserFriendlyMessage(error)).toBe(
      "Please connect your wallet to perform this action",
    );
  });

  it("passes through unknown error strings unchanged", () => {
    expect(getUserFriendlyMessage("some other error")).toBe("some other error");
  });

  it("passes through Error objects with unknown messages unchanged", () => {
    const error = new Error("insufficient funds");
    expect(getUserFriendlyMessage(error)).toBe("insufficient funds");
  });

  it("returns the default fallback for null", () => {
    expect(getUserFriendlyMessage(null)).toBe("An unexpected error occurred");
  });

  it("returns the default fallback for undefined", () => {
    expect(getUserFriendlyMessage(undefined)).toBe(
      "An unexpected error occurred",
    );
  });
});
