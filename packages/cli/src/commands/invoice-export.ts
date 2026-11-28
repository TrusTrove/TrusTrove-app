import { writeFile } from "node:fs/promises";
import { Command } from "commander";
import { assertStellarAccountAddress } from "../address.js";
import { resolveApiUrl } from "../api.js";
import {
  authError,
  redactUrl,
  redactUrls,
  reportError,
  rpcError,
} from "../errors.js";
import { parseInvoiceStatus } from "./list-invoices.js";

/** Page size used while walking the indexer. 100 is the API's maximum. */
export const INVOICE_EXPORT_PAGE_SIZE = 100;
/** Safety cap so a bad `totalPages` response cannot loop forever. */
export const INVOICE_EXPORT_MAX_PAGES = 100;

/**
 * The invoice representation returned by `GET /invoices`. Amounts are strings
 * end-to-end: the API serializes big integers as decimal strings, and the
 * export must not round-trip them through `Number`.
 */
export interface IndexerInvoice {
  id: string;
  issuer: string;
  buyer: string;
  face_value: string;
  discount_bps: number;
  funded_amount: string;
  due_date: number;
  status: string;
  created_at: number;
  funded_at?: number | null;
  shipped_at?: number | null;
  buyer_confirmed_at?: number | null;
  repaid_at?: number | null;
}

export interface InvoiceExportOptions {
  /** Invoice status to filter by, case-insensitive. */
  status?: string;
  /** Issuer Stellar address to filter by. */
  issuer?: string;
  /** Buyer Stellar address to filter by (applied to every fetched page). */
  buyer?: string;
  /** Indexer API base URL. */
  apiUrl?: string;
  /** File to write; stdout when omitted. */
  output?: string;
  /** Emit structured errors as JSON on stderr. */
  json?: boolean;
}

export interface InvoiceExportDependencies {
  /** Overridable for tests; defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Overridable for tests; defaults to `node:fs/promises` `writeFile`. */
  writeFile?: typeof writeFile;
}

export interface InvoiceExportResult {
  /** Every exported row, after pagination and filters. */
  invoices: IndexerInvoice[];
  /** The complete CSV document, header row and trailing newline included. */
  csv: string;
  /** Number of pages requested from the indexer. */
  pages: number;
  /** Base URL the rows were read from, trailing slash removed. */
  apiUrl: string;
}

export const INVOICE_EXPORT_HEADERS = [
  "id",
  "issuer",
  "buyer",
  "face_value",
  "funded_amount",
  "discount_bps",
  "status",
  "due_date",
  "created_at",
  "funded_at",
  "shipped_at",
  "repaid_at",
] as const;

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Escapes one CSV cell.
 *
 * Spreadsheet applications execute cells that begin with `=`, `+`, `-`, `@`,
 * a tab, or a carriage return. Such a value is prefixed with an apostrophe so
 * it is treated as text, which is the standard mitigation for CSV formula
 * injection. Cells containing quotes, commas, or line breaks are quoted and
 * their quotes doubled per RFC 4180.
 */
export function escapeCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const guarded = FORMULA_PREFIX.test(text) ? `'${text}` : text;
  if (/[",\r\n]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

/**
 * Serializes invoices as CSV. Amount columns are written exactly as the API
 * returned them, so `face_value`/`funded_amount` keep their full decimal
 * precision instead of becoming lossy JavaScript numbers.
 */
export function toInvoiceCsv(invoices: readonly IndexerInvoice[]): string {
  const rows = invoices.map((invoice) =>
    [
      invoice.id,
      invoice.issuer,
      invoice.buyer,
      invoice.face_value,
      invoice.funded_amount,
      invoice.discount_bps,
      invoice.status,
      invoice.due_date,
      invoice.created_at,
      invoice.funded_at,
      invoice.shipped_at,
      invoice.repaid_at,
    ].map(escapeCsvCell),
  );

  return [
    INVOICE_EXPORT_HEADERS.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");
}

function resolveFilters(options: InvoiceExportOptions): {
  status?: string;
  issuer?: string;
  buyer?: string;
} {
  const filters: { status?: string; issuer?: string; buyer?: string } = {};
  if (options.status?.trim()) {
    filters.status = parseInvoiceStatus(options.status);
  }
  if (options.issuer?.trim()) {
    filters.issuer = assertStellarAccountAddress(options.issuer, "issuer");
  }
  if (options.buyer?.trim()) {
    filters.buyer = assertStellarAccountAddress(options.buyer, "buyer");
  }
  return filters;
}

function parsePage(
  payload: unknown,
  page: number,
): { data: IndexerInvoice[]; totalPages: number } {
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray((payload as { data?: unknown }).data)
  ) {
    throw rpcError(
      "Unexpected response from the indexer API: missing data array.",
    );
  }

  const body = payload as {
    data: IndexerInvoice[];
    totalPages?: unknown;
  };
  const reported =
    typeof body.totalPages === "number" && Number.isFinite(body.totalPages)
      ? Math.max(1, Math.trunc(body.totalPages))
      : page;
  return { data: body.data, totalPages: reported };
}

async function fetchPage(
  apiUrl: string,
  page: number,
  filters: { status?: string; issuer?: string },
  doFetch: typeof fetch,
): Promise<{ data: IndexerInvoice[]; totalPages: number }> {
  const url = new URL(`${apiUrl}/invoices`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(INVOICE_EXPORT_PAGE_SIZE));
  if (filters.status) url.searchParams.set("status", filters.status);
  if (filters.issuer) url.searchParams.set("issuer", filters.issuer);

  let response: Response;
  try {
    response = await doFetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    throw rpcError(
      `Failed to reach the indexer API at ${redactUrl(apiUrl)}: ${message}`,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw authError(
      `The indexer API rejected the request (HTTP ${response.status}). Invoice export reads a public endpoint and needs no token.`,
    );
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const detail = body.trim() ? `: ${redactUrls(body.trim())}` : "";
    throw rpcError(`The indexer API returned HTTP ${response.status}${detail}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw rpcError("The indexer API returned invalid JSON.");
  }
  return parsePage(payload, page);
}

/**
 * Fetches every page matching the filters and renders a CSV export.
 *
 * The indexer supports `status` and `issuer` server-side. It has no buyer
 * parameter, so a `buyer` filter is applied to the rows after all pages have
 * been walked; pagination is never truncated by that filter.
 *
 * A filter that matches nothing produces a header-only document rather than
 * an error, matching `list-invoices`' empty-result behavior.
 */
export async function exportInvoices(
  options: InvoiceExportOptions = {},
  dependencies: InvoiceExportDependencies = {},
): Promise<InvoiceExportResult> {
  const filters = resolveFilters(options);
  const apiUrl = resolveApiUrl(options.apiUrl);
  const doFetch = dependencies.fetch ?? fetch;

  const byId = new Map<string, IndexerInvoice>();
  let page = 1;
  let totalPages = 1;
  let pages = 0;

  while (page <= totalPages && page <= INVOICE_EXPORT_MAX_PAGES) {
    const result = await fetchPage(
      apiUrl,
      page,
      { status: filters.status, issuer: filters.issuer },
      doFetch,
    );
    pages += 1;
    totalPages = result.totalPages;
    for (const invoice of result.data) {
      if (filters.buyer && invoice.buyer !== filters.buyer) continue;
      byId.set(invoice.id, invoice);
    }
    if (result.data.length === 0) break;
    page += 1;
  }

  const invoices = Array.from(byId.values());
  return { invoices, csv: toInvoiceCsv(invoices), pages, apiUrl };
}

/**
 * Registers `trusttrove invoice export`.
 *
 * The CSV goes to stdout, so it can be piped or redirected; `--output` writes
 * it to a file instead. Errors are reported on stderr with a documented exit
 * code.
 */
export function registerInvoiceExportCommand(program: Command): Command {
  const invoice = program.command("invoice").description("Invoice commands");

  return invoice
    .command("export")
    .description("Export every matching invoice from the indexer as CSV")
    .option(
      "--status <status>",
      "filter by invoice status (Created, Listed, Funded, Active, Confirmed, Repaid, Defaulted)",
    )
    .option("--issuer <address>", "filter by issuer Stellar address")
    .option("--buyer <address>", "filter by buyer Stellar address")
    .option(
      "--api-url <url>",
      "indexer API base URL (or set TRUSTTROVE_API_URL; default http://localhost:8080)",
    )
    .option("--output <file>", "write the CSV to this file instead of stdout")
    .option("--json", "emit structured errors as JSON on stderr")
    .action(async (options: InvoiceExportOptions) => {
      try {
        const { invoices, csv } = await exportInvoices(options);
        if (options.output) {
          await writeFile(options.output, csv, "utf-8");
          console.log(
            `Exported ${invoices.length} invoice(s) to ${options.output}.`,
          );
          return;
        }
        console.log(csv);
      } catch (error) {
        reportError(error, { json: options.json });
      }
    });
}
