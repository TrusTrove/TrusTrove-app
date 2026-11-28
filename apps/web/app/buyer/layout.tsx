import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buyer Workspace | TrusTrove",
  description:
    "Track the invoices addressed to your wallet, confirm delivery, and repay financed trade obligations on TrusTrove.",
};

export default function BuyerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
