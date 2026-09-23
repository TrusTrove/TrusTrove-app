"use client";

import React, { useState } from 'react';

const faqItems = [
  {
    id: "what-is-trusttrove",
    question: "What is TrusTrove?",
    answer: "TrusTrove is a decentralized invoice factoring platform that connects small and medium enterprises (SMEs) with liquidity providers (LPs)."
  },
  {
    id: "verify-profile",
    question: "How do I verify my profile?",
    answer: "You can verify your profile by navigating to the Profile page and completing the required identity and business verification steps."
  },
  {
    id: "wallet-freighter",
    question: "How do I set up a Wallet and Freighter basics?",
    answer: "To interact with TrusTrove, you need a Stellar-compatible wallet like Freighter. Install the Freighter browser extension, secure your seed phrase, and connect it to TrusTrove to manage your identity, sign transactions, and hold your funds."
  },
  {
    id: "invoice-tokenization",
    question: "How does invoice tokenization work?",
    answer: "TrusTrove converts traditional invoices into digital tokens on the stellar blockchain. Each token represents a fractional ownership in the invoice, allowing multiple liquidity providers to fund a single invoice."
  },
  {
    id: "discount-rate-bps",
    question: "What is the discount rate and BPS?",
    answer: "The discount rate is the fee charged to the SME for early financing, typically expressed in basis points (BPS). For example, 100 BPS equals 1%. This rate determines the return for Liquidity Providers."
  },
  {
    id: "funding-flow",
    question: "How does the funding flow work?",
    answer: "Once an SME lists a tokenized invoice, LPs can fund it using stablecoins. Funds are held in a smart contract escrow until the invoice target is met. Then, funds are released to the SME minus the discount rate."
  },
  {
    id: "delivery-confirmation",
    question: "How does delivery confirmation work?",
    answer: "Before funds are fully settled, the buyer must confirm receipt of goods or services. This delivery confirmation triggers the final stages of the smart contract to ensure all parties have fulfilled their obligations."
  },
  {
    id: "lp-yield",
    question: "How do LPs earn yield?",
    answer: "Liquidity Providers earn yield from the discount rate applied to the invoices they fund. When the buyer repays the full invoice amount at maturity, the LP receives their principal plus their proportional share of the discount fee."
  },
  {
    id: "default-handling",
    question: "What happens in case of a default?",
    answer: "If the buyer fails to pay the invoice by the due date, the smart contract initiates default handling procedures. This may include locking collateral, applying late penalties, or routing the issue to a decentralized arbitration protocol."
  }
];

interface AccordionItemProps {
  item: { id: string; question: string; answer: string };
  isOpen: boolean;
  onClick: () => void;
}

function AccordionItem({ item, isOpen, onClick }: AccordionItemProps) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <button
        type="button"
        className="w-full text-left py-4 px-2 font-semibold text-lg flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick={onClick}
        aria-expanded={isOpen}
        aria-controls={`faq-content-${item.id}`}
        id={`faq-header-${item.id}`}
      >
        {item.question}
        <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
      </button>
      <div
        id={`faq-content-${item.id}`}
        role="region"
        aria-labelledby={`faq-header-${item.id}`}
        className={`px-2 pb-4 text-gray-700 dark:text-gray-300 ${isOpen ? 'block' : 'hidden'}`}
      >
        {item.answer}
      </div>
    </div>
  );
}

export default function HelpPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="container mx-auto py-10 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Help & FAQ</h1>
      
      <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-4">
        {faqItems.map((item) => (
          <AccordionItem
            key={item.id}
            item={item}
            isOpen={openId === item.id}
            onClick={() => setOpenId(openId === item.id ? null : item.id)}
          />
        ))}
      </div>
      
      <section className="mt-10 px-2">
        <h2 className="text-2xl font-semibold mb-3">Need more help?</h2>
        <p className="text-gray-700 dark:text-gray-300">
          If you have additional questions, please reach out to our support team at support@trusttrove.com.
        </p>
      </section>
    </div>
  );
}
