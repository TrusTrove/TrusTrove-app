import { readFileSync } from "node:fs";
import { Command } from "commander";
import { registerCheckPoolBalanceCommand } from "./commands/check-pool-balance.js";
import { registerListInvoicesCommand } from "./commands/list-invoices.js";
import { registerWebhookDeliveriesCommand } from "./commands/webhook-deliveries.js";
import { registerCompletionCommand } from "./completion.js";

function readVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
    ) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Builds the command tree. Kept separate from `index.ts` so completion
 * generation and tests can inspect the exact same definitions the binary runs.
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name("trusttrove")
    .description(
      "CLI for interacting with TrusTrove Soroban contracts on Stellar",
    )
    .version(readVersion(), "-v, --version", "output the current version");

  registerCheckPoolBalanceCommand(program);
  registerListInvoicesCommand(program);
  registerWebhookDeliveriesCommand(program);
  registerCompletionCommand(program);

  return program;
}
