import { describe, expect, it, vi } from "vitest";
import { Command } from "commander";

vi.mock("@trusttrove/sdk", () => ({
  InvoiceClient: class {},
  PoolClient: class {},
  toUsdc: (stroops: bigint) => (Number(stroops) / 10_000_000).toFixed(2),
  getConfig: () => ({ contractIds: { pool: "" } }),
  configureSDK: () => {},
}));

import { createProgram } from "../src/program.js";
import {
  COMPLETION_SHELLS,
  generateCompletion,
  parseCompletionShell,
} from "../src/completion.js";

describe("generateCompletion", () => {
  it("generates bash completion from the live command definitions", () => {
    const script = generateCompletion(createProgram(), "bash");

    expect(script).toContain("complete -F _trusttrove_completion trusttrove");
    for (const command of [
      "check-pool-balance",
      "list-invoices",
      "webhook-deliveries",
      "completion",
    ]) {
      expect(script).toContain(command);
    }
    expect(script).toContain("--network");
    expect(script).toContain("--rpc-url");
    expect(script).toContain("--json");
    expect(script).toContain("testnet mainnet");
    expect(script).toContain("Created Listed Funded");
  });

  it("generates zsh completion with per-command option values", () => {
    const script = generateCompletion(createProgram(), "zsh");

    expect(script.startsWith("#compdef trusttrove")).toBe(true);
    expect(script).toContain("'webhook-deliveries:");
    expect(script).toContain("'--network[");
    expect(script).toContain("(testnet mainnet)");
    expect(script).toContain('_trusttrove "$@"');
  });

  it("generates PowerShell completion", () => {
    const script = generateCompletion(createProgram(), "powershell");

    expect(script).toContain(
      "Register-ArgumentCompleter -Native -CommandName trusttrove",
    );
    expect(script).toContain("'check-pool-balance'");
    expect(script).toContain("TakesValue = $true");
    expect(script).toContain("'webhook-deliveries'");
  });

  it("picks up a newly registered command without a hand-maintained list", () => {
    const program = createProgram();
    program.command("new-cmd").description("a new command").option("--fresh");

    const script = generateCompletion(program, "bash");

    expect(script).toContain("new-cmd");
    expect(script).toContain("--fresh");
  });

  it("generates a valid script for an empty program", () => {
    const program = new Command().name("demo");

    const script = generateCompletion(program, "bash");

    expect(script).toContain("_demo_completion()");
    expect(script).toContain("complete -F _demo_completion demo");
    expect(script).not.toContain('case "${sub}" in\n    )');
  });

  it("accepts shells case-insensitively", () => {
    for (const shell of COMPLETION_SHELLS) {
      expect(parseCompletionShell(shell.toUpperCase())).toBe(shell);
    }
  });

  it("rejects an unknown shell", () => {
    expect(() => generateCompletion(createProgram(), "fish")).toThrow(
      /Unknown shell "fish"/,
    );
  });
});
