import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LP Portal | TrusTrove",
  description:
    "Provide liquidity, simulate yields, and earn USDC returns on tokenized trade invoices with TrusTrove.",
};

export default function LpLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
