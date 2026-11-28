"use client";

import React from "react";
import { PageLayout } from "@/components/shared/PageLayout";
import { ReceivablesAging } from "@/components/invoice/ReceivablesAging";
import { useInvoices } from "@/hooks/useInvoices";
import { useWalletStore } from "@/store/wallet";

export default function ReceivablesAgingPage() {
  const address = useWalletStore((s) => s.address);
  const { invoices } = useInvoices({ issuer: address || undefined });
  return (
    <PageLayout>
      <ReceivablesAging invoices={invoices} />
    </PageLayout>
  );
}
