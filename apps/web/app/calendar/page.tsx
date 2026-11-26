"use client";

import React from "react";
import { PageLayout } from "@/components/shared/PageLayout";
import { BuyerRepaymentCalendar } from "@/components/invoice/BuyerRepaymentCalendar";
import { useInvoices } from "@/hooks/useInvoices";
import { useWalletStore } from "@/store/wallet";

export default function BuyerCalendarPage() {
  const address = useWalletStore((s) => s.address);
  const { invoices } = useInvoices();
  return (
    <PageLayout>
      <BuyerRepaymentCalendar invoices={invoices} timezone="UTC" />
    </PageLayout>
  );
}
