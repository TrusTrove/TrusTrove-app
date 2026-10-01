import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplace | TrusTrove",
  description:
    "Browse and trade tokenized trade invoices on the Stellar network with TrusTrove.",
};

export default function MarketplaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
