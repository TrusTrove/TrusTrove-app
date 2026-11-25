import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

import {
  fetchWebhookDeliveries,
  registerWebhookDeliveriesCommand,
  type WebhookDeliveryAttempt,
} from "../src/commands/webhook-deliveries.js";

const SUBSCRIPTION_ID = "00000000-0000-0000-0000-000000000001";
const TOKEN = "test-token";

const attempt = (
  overrides: Partial<WebhookDeliveryAttempt> = {},
): WebhookDeliveryAttempt => ({
  id: 7,
  subscription_id: SUBSCRIPTION_ID,
  event_type: "invoice.funded",
  event_id: "0021255638529081344-0000000001",
  status: "pending",
  attempts: 2,
  max_attempts: 5,
  next_attempt_at: "2026-11-24T12:00:00Z",
  last_status: 500,
  last_error: "non-2xx response: 500",
  created_at: "2026-11-24T11:00:00Z",
  updated_at: "2026-11-24T11:59:00Z",
  ...overrides,
});

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => "",
  } as Response;
}

function textResponse(body: string, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({}),
    text: async () => body,
  } as Response;
}

async function runCli(args: string[]) {
  const program = new Command();
  registerWebhookDeliveriesCommand(program);
  await program.parseAsync([
    "node",
    "trusttrove",
    "webhook-deliveries",
    ...args,
  ]);
}

describe("webhook-deliveries command", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let originalExitCode: typeof process.exitCode;
  let originalToken: string | undefined;
  let originalApiUrl: string | undefined;

  const stdout = () =>
    logSpy.mock.calls.map((call) => String(call[0])).join("\n");
  const stderr = () =>
    errorSpy.mock.calls.map((call) => String(call[0])).join("\n");

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    originalExitCode = process.exitCode;
    process.exitCode = undefined;
    originalToken = process.env.TRUSTTROVE_API_TOKEN;
    originalApiUrl = process.env.TRUSTTROVE_API_URL;
    delete process.env.TRUSTTROVE_API_TOKEN;
    delete process.env.TRUSTTROVE_API_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    process.exitCode = originalExitCode;

    if (originalToken === undefined) delete process.env.TRUSTTROVE_API_TOKEN;
    else process.env.TRUSTTROVE_API_TOKEN = originalToken;
    if (originalApiUrl === undefined) delete process.env.TRUSTTROVE_API_URL;
    else process.env.TRUSTTROVE_API_URL = originalApiUrl;
  });

  it("lists attempts with status, retry time, and a redacted error", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [
          attempt({
            last_error:
              "POST https://hooks.example.com/abc?secret=topsecret failed",
          }),
        ],
      }),
    );

    await runCli([
      "--subscription-id",
      SUBSCRIPTION_ID,
      "--token",
      TOKEN,
      "--api-url",
      "https://api.example.com/",
      "--limit",
      "5",
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.example.com/webhooks/${SUBSCRIPTION_ID}/deliveries?limit=5`,
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );

    const output = stdout();
    expect(output).toContain("invoice.funded");
    expect(output).toContain("pending");
    expect(output).toContain("2/5");
    expect(output).toContain("500");
    expect(output).toContain("2026-11-24T12:00:00Z");
    expect(output).toContain("NEXT RETRY");
    // The destination query string (a potential secret) is not printed.
    expect(output).toContain("https://hooks.example.com/abc?***");
    expect(output).not.toContain("topsecret");
    expect(process.exitCode).toBeUndefined();
  });

  it("handles an empty delivery list", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));

    await runCli([
      "--subscription-id",
      SUBSCRIPTION_ID,
      "--token",
      TOKEN,
    ]);

    expect(stdout()).toContain("No deliveries found.");
    expect(process.exitCode).toBeUndefined();
  });

  it("reads the token and API URL from the environment", async () => {
    process.env.TRUSTTROVE_API_TOKEN = TOKEN;
    process.env.TRUSTTROVE_API_URL = "https://env.example.com";
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));

    await runCli(["--subscription-id", SUBSCRIPTION_ID]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://env.example.com/webhooks/${SUBSCRIPTION_ID}/deliveries?limit=20`,
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  it("reports a rejected token as an auth error", async () => {
    fetchMock.mockResolvedValue(textResponse("unauthorized", 401));

    await runCli([
      "--subscription-id",
      SUBSCRIPTION_ID,
      "--token",
      TOKEN,
    ]);

    expect(stderr()).toContain("rejected the token (HTTP 401)");
    expect(process.exitCode).toBe(3);
  });

  it("rejects a malformed subscription ID without calling the API", async () => {
    await runCli(["--subscription-id", "not-a-uuid", "--token", TOKEN]);

    expect(stderr()).toContain("Invalid subscription ID");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("reports a missing token before calling the API", async () => {
    await runCli(["--subscription-id", SUBSCRIPTION_ID]);

    expect(stderr()).toContain("TRUSTTROVE_API_TOKEN");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("reports a subscription the token cannot see as not found", async () => {
    fetchMock.mockResolvedValue(textResponse("webhook not found", 404));

    await runCli([
      "--subscription-id",
      SUBSCRIPTION_ID,
      "--token",
      TOKEN,
    ]);

    expect(stderr()).toContain("was not found for this token");
    expect(process.exitCode).toBe(1);
  });

  it("rejects an out-of-range --limit", async () => {
    await runCli([
      "--subscription-id",
      SUBSCRIPTION_ID,
      "--token",
      TOKEN,
      "--limit",
      "101",
    ]);

    expect(stderr()).toContain("Invalid --limit");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prints JSON on success with --json", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [attempt()] }));

    await runCli([
      "--subscription-id",
      SUBSCRIPTION_ID,
      "--token",
      TOKEN,
      "--json",
    ]);

    const payload = JSON.parse(stdout()) as { data: WebhookDeliveryAttempt[] };
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].status).toBe("pending");
  });

  it("emits a structured error with --json", async () => {
    fetchMock.mockResolvedValue(textResponse("nope", 403));

    await runCli([
      "--subscription-id",
      SUBSCRIPTION_ID,
      "--token",
      TOKEN,
      "--json",
    ]);

    const payload = JSON.parse(stderr()) as {
      error: { code: string; exitCode: number };
    };
    expect(payload.error).toMatchObject({
      code: "AUTH_ERROR",
      exitCode: 3,
    });
  });
});

describe("fetchWebhookDeliveries", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("redacts a provider key from a network failure message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")),
    );

    await expect(
      fetchWebhookDeliveries({
        subscriptionId: SUBSCRIPTION_ID,
        token: TOKEN,
        apiUrl: "https://user:key@api.example.com",
      }),
    ).rejects.toThrow("Failed to reach the indexer API at https://***@api.example.com");
  });

  it("rejects a response without a data array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ deliveries: [] })),
    );

    await expect(
      fetchWebhookDeliveries({
        subscriptionId: SUBSCRIPTION_ID,
        token: TOKEN,
      }),
    ).rejects.toThrow("missing data array");
  });
});
