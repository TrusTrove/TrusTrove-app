#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";

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
    "Scope:",
    "  This release only wires the CLI entrypoint and argument parsing.",
    "  Real commands (list-invoices, check-pool-balance) land in follow-up",
    "  issues built on @trusttrove/sdk.",
    "",
  ].join("\n"),
);

await program.parseAsync(process.argv);
