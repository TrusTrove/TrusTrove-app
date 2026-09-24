#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";
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

program.addHelpText(
  "afterAll",
  [
    "",
    "Commands:",
    "  list-invoices   List invoices by status or issuer (read-only call)",
    "",
    "Examples:",
    "  $ trusttrove list-invoices --status Funded --public-key G...",
    "  $ trusttrove list-invoices --issuer G... --public-key G...",
    "",
    "  --public-key may be replaced by TRUSTTROVE_PUBLIC_KEY, and",
    "  --contract-id by INVOICE_CONTRACT_ID (see .env.example).",
    "",
    "Further commands (check-pool-balance) land in follow-up issues built",
    "on @trusttrove/sdk.",
    "",
  ].join("\n"),
);

registerListInvoicesCommand(program);

await program.parseAsync(process.argv);
