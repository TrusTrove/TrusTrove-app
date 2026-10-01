import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Docs | TrusTrove",
  description:
    "Documentation and guides for the TrusTrove decentralized trade finance operations terminal.",
};

export default function DocsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
