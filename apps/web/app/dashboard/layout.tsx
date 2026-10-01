import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | TrusTrove",
  description:
    "Manage your trade finance invoices, track activity, and monitor your portfolio on TrusTrove.",
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
