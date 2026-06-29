import type { Metadata } from "next";
import { Invoice } from "@/types";
import { formatAmount } from "@/lib/assets";
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
    return {
      id: raw.id,
      issuer: raw.issuer,
      buyer: raw.buyer,
      faceValue: BigInt(raw.face_value || 0),
      asset: raw.asset || "USDC",
      discountBps: Number(raw.discount_bps || 0),
      fundedAmount: BigInt(raw.funded_amount || 0),
      dueDate: Number(raw.due_date || 0),
      status: raw.status,
      createdAt: Number(raw.created_at || 0),
      fundedAt: raw.funded_at ? Number(raw.funded_at) : null,
      shippedAt: raw.shipped_at ? Number(raw.shipped_at) : null,
      issuerConfirmed: !!raw.issuer_confirmed,
      buyerConfirmed: !!raw.buyer_confirmed,
      repaidAt: raw.repaid_at ? Number(raw.repaid_at) : null,
    };
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
