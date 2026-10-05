// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import nextConfig from "./next.config.mjs";

const REPORT_ONLY = "content-security-policy-report-only";
const ENFORCED = "content-security-policy";

function run() {
  return middleware(new NextRequest("http://localhost:3000/marketplace"));
}

function nonceOf(policy: string | null): string | undefined {
  return policy?.match(/'nonce-([^']+)'/)?.[1];
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("middleware", () => {
  it("sends a report-only CSP carrying a nonce by default", () => {
    const res = run();
    const policy = res.headers.get(REPORT_ONLY);
    expect(res.headers.get(ENFORCED)).toBeNull();
    expect(nonceOf(policy)).toBeTruthy();
  });

  it("forwards the same nonce and policy to the page render", () => {
    const res = run();
    const policy = res.headers.get(REPORT_ONLY);
    // NextResponse.next({ request: { headers } }) exposes request overrides
    // as x-middleware-request-<name>.
    expect(res.headers.get("x-middleware-request-x-nonce")).toBe(
      nonceOf(policy),
    );
    expect(res.headers.get(`x-middleware-request-${REPORT_ONLY}`)).toBe(policy);
  });

  it("uses a fresh nonce for every request", () => {
    const nonces = new Set(
      Array.from({ length: 5 }, () => nonceOf(run().headers.get(REPORT_ONLY))),
    );
    expect(nonces.size).toBe(5);
  });

  it("enforces the CSP when CSP_ENFORCE=true", () => {
    vi.stubEnv("CSP_ENFORCE", "true");
    const res = run();
    expect(res.headers.get(REPORT_ONLY)).toBeNull();
    expect(res.headers.get(ENFORCED)).toContain("frame-ancestors 'none'");
    expect(res.headers.get(`x-middleware-request-${ENFORCED}`)).toBe(
      res.headers.get(ENFORCED),
    );
  });
});

describe("next.config headers()", () => {
  it("applies the hardening headers to all routes", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");
    const rules = await nextConfig.headers!();
    const all = rules.find((rule) => rule.source === "/(.*)");
    const keys = all?.headers.map((h) => h.key) ?? [];
    expect(keys).toEqual(
      expect.arrayContaining([
        "X-Content-Type-Options",
        "Referrer-Policy",
        "X-Frame-Options",
        "Permissions-Policy",
      ]),
    );
  });
});
