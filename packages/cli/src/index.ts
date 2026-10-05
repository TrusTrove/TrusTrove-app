#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";
import {
  checkPoolBalanceCommand,
  type CheckPoolBalanceOptions,
} from "./commands/check-pool-balance.js";
import { registerListInvoicesCommand } from "./commands/list-invoices.js";

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

const program = new Command();

program
  .name("trusttrove")
  .description(
    "CLI for interacting with TrusTrove Soroban contracts on Stellar",
  )
  .version(readVersion(), "-v, --version", "output the current version");

program
  .command("check-pool-balance")
  .description("Fetch and print pool balance stats for the configured pool")
  .option("--public-key <key>", "public key for the read-only simulation")
  .option("--pool-contract-id <id>", "override the pool contract ID")
  .action(async (options: CheckPoolBalanceOptions) => {
    await checkPoolBalanceCommand(options);
  });

registerListInvoicesCommand(program);

await program.parseAsync(process.argv);
