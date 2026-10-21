import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings | TrusTrove",
  description:
    "Manage your TrusTrove preferences: theme and display density, reduced motion, notifications, and data and privacy controls.",
};

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
