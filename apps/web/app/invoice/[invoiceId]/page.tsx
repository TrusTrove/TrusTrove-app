import type { Metadata } from "next";
import { cache } from "react";
import { Invoice } from "@/types";
import { formatAmount } from "@/lib/assets";
import { parseInvoiceResponse } from "@/lib/parsers";
import InvoiceDetailClient from "./InvoiceDetailClient";

const getIndexerApiUrl = () => {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
};

// Request-scoped memo. `generateMetadata` and the page render resolve in the
// same request, so without this the invoice is fetched twice server-side; the
// page then handed nothing to the client, which fetched a third time (#1118).
// The payload stays raw JSON: it crosses the server/client boundary as a prop,
// and `parseInvoiceResponse` rebuilds the BigInt fields on the client.
const fetchInvoiceRaw = cache(
  async (invoiceId: string): Promise<unknown | null> => {
    try {
      const res = await fetch(`${getIndexerApiUrl()}/invoices/${invoiceId}`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },
);

async function fetchInvoiceById(invoiceId: string): Promise<Invoice | null> {
  const raw = await fetchInvoiceRaw(invoiceId);
  return raw === null ? null : parseInvoiceResponse(raw);
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { invoiceId: string };
}): Promise<Metadata> {
  const invoice = await fetchInvoiceById(params.invoiceId);
  const dueDate = invoice
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(invoice.dueDate * 1000))
    : undefined;
  const title = invoice
    ? `TrusTrove Invoice #${invoice.id} — ${formatAmount(invoice.faceValue)} USDC`
    : "TrusTrove Invoice";
  const description = invoice
    ? `Trade finance invoice on Stellar. Status: ${invoice.status}. Due: ${dueDate}.`
    : "Trade finance invoice on Stellar.";

  // Construct an absolute origin for social image URLs. Prefer an explicit public URL
  // if provided via `NEXT_PUBLIC_APP_URL`, otherwise fall back to localhost.
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const ogImage = `${origin.replace(/\/$/, "")}/og-image.png`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: "TrusTrove Invoice preview image",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: { invoiceId: string };
}) {
  // Reuses the request-scoped fetch above (no second round-trip). `null` means
  // the indexer had nothing for this id; the client then does its own fetch so
  // the existing not-found flow stays in one piece.
  const initialInvoice = await fetchInvoiceRaw(params.invoiceId);

  return (
    <InvoiceDetailClient
      invoiceId={params.invoiceId}
      initialInvoice={initialInvoice ?? undefined}
    />
  );
}
