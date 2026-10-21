import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help & FAQ | TrusTrove",
  description:
    "Answers to common TrusTrove questions: profile verification, Freighter wallets, invoice tokenization, discount rates, funding, delivery confirmation, LP yield, and default handling.",
};

export default function HelpLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
