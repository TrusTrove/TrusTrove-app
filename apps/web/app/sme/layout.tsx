import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SME Portal | TrusTrove",
  description:
    "Tokenize unpaid trade invoices as Stellar assets and receive immediate USDC funding with TrusTrove.",
};

export default function SmeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
