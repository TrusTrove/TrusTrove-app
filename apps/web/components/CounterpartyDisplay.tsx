"use client";

import React from "react";
import { resolveAddressAlias } from "../lib/address-book";

interface CounterpartyDisplayProps {
  walletAddress: string | null | undefined;
  counterpartyAddress: string;
  viewMode?: "signing" | "detail" | "standard";
}

export function CounterpartyDisplay({
  walletAddress,
  counterpartyAddress,
  viewMode = "standard",
}: CounterpartyDisplayProps) {
  const alias = resolveAddressAlias(walletAddress, counterpartyAddress);
  const hasAlias = alias !== counterpartyAddress;

  return (
    <div className="inline-flex flex-col">
      {hasAlias && <span className="font-medium text-gray-900">{alias}</span>}
      <span
        className={`${hasAlias ? "text-xs text-gray-500 font-mono" : "text-sm text-gray-900 font-mono"}`}
      >
        {counterpartyAddress}
      </span>
    </div>
  );
}
