import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authError,
  classifyError,
  CliError,
  EXIT_AUTH,
  EXIT_INTERNAL,
  EXIT_RPC,
  EXIT_USAGE,
  redactUrl,
  redactUrls,
  reportError,
  rpcError,
  usageError,
} from "../src/errors.js";

describe("redactUrl", () => {
  it("keeps host and path but removes credentials and query values", () => {
    expect(
      redactUrl("https://user:pass@rpc.example.com/v1/abc?api_key=secret#frag"),
    ).toBe("https://***@rpc.example.com/v1/abc?***#***");
  });

  it("leaves a plain URL unchanged", () => {
    expect(redactUrl("https://soroban-testnet.stellar.org")).toBe(
      "https://soroban-testnet.stellar.org",
    );
  });

  it("does not echo an unparseable value", () => {
    expect(redactUrl("not a url")).toBe("<invalid-url>");
  });
});

describe("redactUrls", () => {
  it("redacts every URL in an error message", () => {
    const message =
      "fetch failed for https://rpc.example.com/key-123?token=abc and https://other.example/x";
    expect(redactUrls(message)).toBe(
      "fetch failed for https://rpc.example.com/key-123?*** and https://other.example/x",
    );
  });

  it("preserves trailing punctuation outside the URL", () => {
    expect(redactUrls("see https://rpc.example.com/a?key=1.")).toBe(
      "see https://rpc.example.com/a?***.",
    );
  });
});

describe("classifyError", () => {
  it("keeps explicit CLI codes", () => {
    expect(classifyError(usageError("bad flag")).code).toBe("USAGE_ERROR");
    expect(classifyError(rpcError("down")).code).toBe("RPC_ERROR");
    expect(classifyError(authError("nope")).code).toBe("AUTH_ERROR");
  });

  it("maps authorization and RPC messages from the SDK", () => {
    expect(classifyError(new Error("Simulation failed: unauthorized")).code).toBe(
      "AUTH_ERROR",
    );
    expect(classifyError(new Error("Simulation failed: host unreachable")).code).toBe(
      "RPC_ERROR",
    );
    expect(classifyError(new Error("ECONNREFUSED 127.0.0.1:8000")).code).toBe(
      "RPC_ERROR",
    );
  });

  it("falls back to an internal error", () => {
    expect(classifyError(new Error("unexpected")).code).toBe("INTERNAL_ERROR");
    expect(classifyError("plain string").code).toBe("INTERNAL_ERROR");
  });
});

describe("reportError", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let originalExitCode: typeof process.exitCode;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = originalExitCode;
  });

  const stderr = () =>
    errorSpy.mock.calls.map((call) => String(call[0])).join("\n");

  it("uses documented exit codes", () => {
    expect(reportError(usageError("bad"))).toBe(EXIT_USAGE);
    expect(reportError(rpcError("down"))).toBe(EXIT_RPC);
    expect(reportError(authError("nope"))).toBe(EXIT_AUTH);
    expect(reportError(new Error("other"))).toBe(EXIT_INTERNAL);
    expect(EXIT_USAGE).toBe(1);
    expect(EXIT_RPC).toBe(2);
    expect(EXIT_AUTH).toBe(3);
    expect(EXIT_INTERNAL).toBe(4);
  });

  it("emits a single-line JSON error and redacts URLs", () => {
    reportError(
      new CliError(
        "RPC_ERROR",
        "failed at https://rpc.example.com/v1?api_key=secret",
        EXIT_RPC,
      ),
      { json: true },
    );

    const payload = JSON.parse(stderr()) as {
      error: { code: string; message: string; exitCode: number };
    };
    expect(payload.error).toEqual({
      code: "RPC_ERROR",
      message: "failed at https://rpc.example.com/v1?***",
      exitCode: EXIT_RPC,
    });
    expect(process.exitCode).toBe(EXIT_RPC);
  });

  it("redacts URLs in human output too", () => {
    reportError(new Error("fetch failed for https://rpc.example.com?key=abc"));

    expect(stderr()).toContain("https://rpc.example.com?***");
    expect(stderr()).not.toContain("key=abc");
  });
});
