"use client";

import React from "react";
import { AddressBookManager } from "../../components/AddressBookManager";

export default function AddressBookPage() {
  const [wallet, setWallet] = React.useState<string | null>(null);

  React.useEffect(() => {
    const active = localStorage.getItem("trusttrove_active_wallet") || "GWALLET_DEFAULT_TEST";
    setWallet(active);
  }, []);

  return (
    <main className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Wallet Address Book</h1>
      <p className="text-sm text-gray-600 mb-6">
        Manage local aliases for repeat counterparties. The full Stellar address remains visible on signing and detail views.
      </p>
      <AddressBookManager walletAddress={wallet} />
    </main>
  );
}
