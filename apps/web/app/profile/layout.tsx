import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile | TrusTrove",
  description:
    "Manage your TrusTrove profile, verification status, and wallet settings.",
};

export default function ProfileLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
