import type { Metadata } from "next";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: "TrusTrove | Decentralized Trade Finance Operations Terminal",
  description:
    "Tokenize unpaid trade invoices as Stellar assets and receive immediate USDC funding. Yield opportunities for liquidity providers.",
};

export default function Home() {
  return <HomeClient />;
}
