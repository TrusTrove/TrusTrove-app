import { Command } from "commander";
import {
  InvoiceClient,
  toUsdc,
  type Invoice,
  type InvoiceStatus,
} from "@trusttrove/sdk";

/**
 * Every on-chain invoice status, in lifecycle order. `--status` accepts these
 * case-insensitively; the value is forwarded to the invoice contract's
 * `get_by_status` symbol as-is.
 */
export const INVOICE_STATUSES: InvoiceStatus[] = [
  "Created",
  "Listed",
  "Funded",
  "Active",
  "Confirmed",
  "Repaid",
  "Defaulted",
];

/** Env var that can stand in for `--public-key`. */
export const PUBLIC_KEY_ENV_VAR = "TRUSTTROVE_PUBLIC_KEY";

/** Env var that can stand in for `--contract-id` (see .env.example). */
export const CONTRACT_ID_ENV_VAR = "INVOICE_CONTRACT_ID";

const TABLE_HEADERS = [
  "ID",
  "ISSUER",
  "BUYER",
  "FACE VALUE",
  "STATUS",
  "DUE DATE",
];

/** Thrown for invalid flags/configuration; the command exits with status 1. */
export class ListInvoicesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ListInvoicesError";
  }
}

export interface ListInvoicesOptions {
  /** Invoice status to filter by. Mutually exclusive with `issuer`. */
  status?: string;
  /** Issuer address to filter by. Mutually exclusive with `status`. */
  issuer?: string;
  /** Stellar public key used for the read-only simulation call. */
  publicKey?: string;
  /** Address of the invoice contract to read from. */
  contractId?: string;
}

export interface ListInvoicesResult {
  /** Invoices returned by the contract, in contract order. */
  invoices: Invoice[];
  /** The rendered table (header row included), ready for stdout. */
  table: string;
}

export interface ListInvoicesDependencies {
  /** Overridable for tests; defaults to the SDK's `InvoiceClient`. */
  createClient?: (contractId: string) => InvoiceClient;
}

/**
 * Resolves a user-supplied `--status` value to its canonical `InvoiceStatus`.
 *
 * @throws {ListInvoicesError} When the value is not one of {@link INVOICE_STATUSES}.
 */
export function parseInvoiceStatus(value: string): InvoiceStatus {
  const normalized = value.trim().toLowerCase();
  const match = INVOICE_STATUSES.find(
    (status) => status.toLowerCase() === normalized,
  );
  if (!match) {
    throw new ListInvoicesError(
      `Unknown status "${value}". Expected one of: ${INVOICE_STATUSES.join(", ")}.`,
    );
  }
  return match;
}

function resolvePublicKey(options: ListInvoicesOptions): string {
  const publicKey = (
    options.publicKey ??
    process.env[PUBLIC_KEY_ENV_VAR] ??
    ""
  ).trim();
  if (!publicKey) {
    throw new ListInvoicesError(
      `A Stellar public key is required for the read-only simulation call. ` +
        `Pass --public-key <key> or set ${PUBLIC_KEY_ENV_VAR}.`,
    );
  }
  return publicKey;
}

function resolveContractId(options: ListInvoicesOptions): string {
  const contractId = (
    options.contractId ??
    process.env[CONTRACT_ID_ENV_VAR] ??
    ""
  ).trim();
  if (!contractId) {
    throw new ListInvoicesError(
      `The invoice contract ID is required. Pass --contract-id <id> or set ` +
        `${CONTRACT_ID_ENV_VAR} (see .env.example).`,
    );
  }
  return contractId;
}

function resolveFilter(
  options: ListInvoicesOptions,
): { status: InvoiceStatus } | { issuer: string } {
  const status = options.status?.trim();
  const issuer = options.issuer?.trim();

  if (status && issuer) {
    throw new ListInvoicesError(
      "Choose one filter: pass either --status <status> or --issuer <address>, not both.",
    );
  }
  if (!status && !issuer) {
    throw new ListInvoicesError(
      `A filter is required. Pass --status <status> or --issuer <address>.`,
    );
  }
  return status ? { status: parseInvoiceStatus(status) } : { issuer: issuer! };
}

function formatDueDate(dueDate: number | null | undefined): string {
  if (!dueDate) return "—";
  return new Date(dueDate * 1000).toISOString().slice(0, 10);
}

/**
 * Renders a fixed-width table with a header row and a dashed rule beneath it.
 * Columns are padded to the widest cell, so output stays greppable and
 * diff-friendly.
 */
export function formatTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, index) =>
    rows.reduce(
      (width, row) => Math.max(width, (row[index] ?? "").length),
      header.length,
    ),
  );

  const renderRow = (cells: string[]) =>
    cells
      .map((cell, index) => (cell ?? "").padEnd(widths[index]))
      .join("  ")
      .trimEnd();

  return [
    renderRow(headers),
    widths.map((width) => "-".repeat(width)).join("  "),
    ...rows.map(renderRow),
  ].join("\n");
}

/**
 * Renders invoices as the `list-invoices` table, or the header-only table when
 * the filter matched nothing.
 */
export function formatInvoiceTable(invoices: Invoice[]): string {
  const rows = invoices.map((invoice) => [
    invoice.id,
    invoice.issuer,
    invoice.buyer,
    `${toUsdc(invoice.faceValue)} ${invoice.asset}`,
    invoice.status,
    formatDueDate(invoice.dueDate),
  ]);
  return formatTable(TABLE_HEADERS, rows);
}

/**
 * Reads invoices from the invoice contract with the SDK's read-only
 * simulation calls ({@link InvoiceClient.getByStatus} or
 * {@link InvoiceClient.getByIssuer}) and returns both the raw invoices and
 * their table rendering.
 *
 * @throws {ListInvoicesError} When a required flag/env var is missing or the
 *   flags are contradictory.
 */
export async function listInvoices(
  options: ListInvoicesOptions,
  dependencies: ListInvoicesDependencies = {},
): Promise<ListInvoicesResult> {
  const publicKey = resolvePublicKey(options);
  const contractId = resolveContractId(options);
  const filter = resolveFilter(options);

  const createClient =
    dependencies.createClient ?? ((id: string) => new InvoiceClient(id));
  const client = createClient(contractId);

  const invoices =
    "status" in filter
      ? await client.getByStatus(filter.status, publicKey)
      : await client.getByIssuer(filter.issuer, publicKey);

  return { invoices, table: formatInvoiceTable(invoices) };
}

/**
 * Registers `trusttrove list-invoices` on the CLI's command router.
 *
 * Output goes to stdout as a formatted table; configuration and simulation
 * failures are reported on stderr with a non-zero exit code.
 */
export function registerListInvoicesCommand(program: Command): Command {
  return program
    .command("list-invoices")
    .description("List invoices from the invoice contract by status or issuer")
    .option(
      "--status <status>",
      `filter by invoice status (${INVOICE_STATUSES.join(", ")})`,
    )
    .option("--issuer <address>", "filter by issuer Stellar address")
    .option(
      "--public-key <key>",
      `Stellar public key for the read-only simulation call (or set ${PUBLIC_KEY_ENV_VAR})`,
    )
    .option(
      "--contract-id <id>",
      `invoice contract ID (or set ${CONTRACT_ID_ENV_VAR})`,
    )
    .action(async (options: ListInvoicesOptions) => {
      try {
        const { invoices, table } = await listInvoices(options);
        console.log(table);
        if (invoices.length === 0) {
          console.log("\nNo invoices found.");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${message}`);
        process.exitCode = 1;
      }
    });
}
