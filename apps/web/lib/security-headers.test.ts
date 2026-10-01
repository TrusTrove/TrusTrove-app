// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DEFAULT_API_BASE_URL,
  DEFAULT_HORIZON_URL,
  DEFAULT_SOROBAN_RPC_URL,
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  cspHeaderName,
  isCspEnforced,
  resolveConnectUrls,
  toOrigin,
} from "./security-headers.mjs";

/** Splits a policy string into `{ directive: sources[] }`. */
function parsePolicy(policy: string): Record<string, string[]> {
  return Object.fromEntries(
    policy
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...sources] = part.split(/\s+/);
        return [name, sources];
      }),
  );
}

function headerMap(isProduction: boolean): Record<string, string> {
  const rules = buildSecurityHeaders({ isProduction });
  expect(rules).toHaveLength(1);
  expect(rules[0].source).toBe("/(.*)");
  return Object.fromEntries(rules[0].headers.map((h) => [h.key, h.value]));
}

const prodPolicy = (connectUrls: string[] = [], enforce = false) =>
  parsePolicy(
    buildContentSecurityPolicy({
      nonce: "abc123",
      isDevelopment: false,
      enforce,
      connectUrls,
    }),
  );

describe("buildSecurityHeaders", () => {
  it("sets the hardening headers on every route", () => {
    const headers = headerMap(true);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });

  it("disables unused browser features but leaves clipboard alone", () => {
    const policy = headerMap(true)["Permissions-Policy"];
    for (const feature of ["camera", "microphone", "geolocation"]) {
      expect(policy).toContain(`${feature}=()`);
    }
    expect(policy).not.toContain("clipboard");
  });

  it("sends HSTS only in production", () => {
    expect(headerMap(true)["Strict-Transport-Security"]).toBe(
      "max-age=31536000",
    );
    expect(headerMap(false)).not.toHaveProperty("Strict-Transport-Security");
  });
});

describe("buildContentSecurityPolicy", () => {
  it("locks down framing, plugins, base URI and form targets", () => {
    const policy = prodPolicy();
    expect(policy["default-src"]).toEqual(["'self'"]);
    expect(policy["frame-ancestors"]).toEqual(["'none'"]);
    expect(policy["object-src"]).toEqual(["'none'"]);
    expect(policy["base-uri"]).toEqual(["'self'"]);
    expect(policy["form-action"]).toEqual(["'self'"]);
  });

  it("allows scripts by nonce, never by 'unsafe-inline'", () => {
    const scripts = prodPolicy()["script-src"];
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
  });

  it("adds 'unsafe-eval' for next dev only", () => {
    const dev = parsePolicy(
      buildContentSecurityPolicy({
        nonce: "abc123",
        isDevelopment: true,
        enforce: true,
        connectUrls: [],
      }),
    );
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev).not.toHaveProperty("upgrade-insecure-requests");
  });

  it("limits connect-src to 'self' plus the origins of the given URLs", () => {
    const policy = prodPolicy([
      "https://api.example.com/v1/",
      "https://horizon.stellar.org",
      "http://localhost:8080",
      "https://horizon.stellar.org/accounts?x=1",
    ]);
    expect(policy["connect-src"]).toEqual([
      "'self'",
      "https://api.example.com",
      "https://horizon.stellar.org",
      "http://localhost:8080",
    ]);
  });

  it("allows only 'self' when no URLs are given, skipping invalid ones", () => {
    expect(prodPolicy()["connect-src"]).toEqual(["'self'"]);
    expect(
      prodPolicy(["", "not a url", "javascript:alert(1)"])["connect-src"],
    ).toEqual(["'self'"]);
  });

  it("upgrades insecure requests only when enforced", () => {
    expect(prodPolicy([], true)).toHaveProperty("upgrade-insecure-requests");
    expect(prodPolicy([], false)).not.toHaveProperty(
      "upgrade-insecure-requests",
    );
  });
});

describe("resolveConnectUrls", () => {
  it("falls back to the app's own defaults when vars are unset", () => {
    expect(new Set(resolveConnectUrls({}))).toEqual(
      new Set([
        DEFAULT_API_BASE_URL,
        DEFAULT_HORIZON_URL,
        DEFAULT_SOROBAN_RPC_URL,
      ]),
    );
  });

  it("uses the configured URLs and keeps the SDK's testnet defaults", () => {
    const urls = resolveConnectUrls({
      NEXT_PUBLIC_API_BASE_URL: "https://api.trustrove.example",
      NEXT_PUBLIC_HORIZON_URL: "https://horizon.stellar.org",
      NEXT_PUBLIC_SOROBAN_RPC_URL: "https://mainnet.sorobanrpc.com",
    });
    expect(urls).toEqual(
      expect.arrayContaining([
        "https://api.trustrove.example",
        "https://horizon.stellar.org",
        "https://mainnet.sorobanrpc.com",
        DEFAULT_HORIZON_URL,
        DEFAULT_SOROBAN_RPC_URL,
      ]),
    );
    expect(urls).not.toContain(DEFAULT_API_BASE_URL);
  });
});

describe("toOrigin", () => {
  it("keeps scheme, host and non-default port only", () => {
    expect(toOrigin("https://example.com:8443/a/b?c#d")).toBe(
      "https://example.com:8443",
    );
    expect(toOrigin("https://example.com:443/")).toBe("https://example.com");
    expect(toOrigin(undefined)).toBeNull();
    expect(toOrigin("ftp://example.com")).toBeNull();
  });
});

describe("report-only switch", () => {
  it("is report-only unless CSP_ENFORCE=true", () => {
    expect(isCspEnforced({})).toBe(false);
    expect(isCspEnforced({ CSP_ENFORCE: "1" })).toBe(false);
    expect(isCspEnforced({ CSP_ENFORCE: "true" })).toBe(true);
    expect(cspHeaderName(false)).toBe("Content-Security-Policy-Report-Only");
    expect(cspHeaderName(true)).toBe("Content-Security-Policy");
  });
});
