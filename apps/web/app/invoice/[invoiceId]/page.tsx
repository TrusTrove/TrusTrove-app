import type { Metadata } from "next";
import { Invoice } from "@/types";
import { formatAmount } from "@/lib/assets";
import { parseInvoiceResponse } from "@/lib/parsers";
import InvoiceDetailClient from "./InvoiceDetailClient";

const getIndexerApiUrl = () => {
  return process.env.NEXT_PUBLIC_INDEXER_API_URL || "http://localhost:8080";
};

async function fetchInvoiceById(invoiceId: string): Promise<Invoice | null> {
  try {
    const res = await fetch(`${getIndexerApiUrl()}/invoices/${invoiceId}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const raw = await res.json();
    return parseInvoiceResponse(raw);
  } catch {
    return null;
  }
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

export default function InvoiceDetailPage({
  params,
}: {
  params: { invoiceId: string };
}) {
  return <InvoiceDetailClient invoiceId={params.invoiceId} />;
}
