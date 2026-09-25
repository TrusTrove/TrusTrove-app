import type { Metadata } from "next";
import AnalyticsClient from "./AnalyticsClient";

export const metadata: Metadata = {
  title: "TrusTrove | Protocol Analytics",
  description:
    "Protocol-wide TVL, funding volume, and pool utilization trends for TrusTrove on Stellar.",
};

export default function AnalyticsPage() {
  return <AnalyticsClient />;
}
