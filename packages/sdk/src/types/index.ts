/**
 * Represents the lifecycle status of an invoice in the factoring system.
 */
export type InvoiceStatus =
  | "Created"
  | "Listed"
  | "Funded"
  | "Active"
  | "Confirmed"
  | "Repaid"
  | "Defaulted";

/**
 * Supported asset types for invoicing and payments.
 */
export type AssetType = "USDC" | "XLM";

/**
 * A user's profile information containing role and verification status.
 */
export interface Profile {
  /** The Stellar public key of the profile owner. */
  address: string;
  /** The role of the user, either as an issuer of invoices or a buyer. */
  role: "issuer" | "buyer";
  /** Whether the user has completed necessary KYC/KYB verification. */
  verified: boolean;
  /** Unix timestamp (seconds) when the profile was registered. */
  registeredAt: number;
}

/**
 * Details of a factoring invoice including financial terms and timeline.
 */
export interface Invoice {
  /** Hex string representation of the 32-byte unique invoice identifier. */
  id: string;
  /** The Stellar public key of the invoice creator (issuer). */
  issuer: string;
  /** The Stellar public key of the entity expected to pay the invoice (buyer). */
  buyer: string;
  /** Total value of the invoice in stroops (10^7 = 1 unit). */
  faceValue: bigint;
  /** Denominated asset (e.g., 'USDC' or 'XLM'). */
  asset: AssetType;
  /** Discount applied to the face value, in basis points (1 bps = 0.01%). */
  discountBps: number;
  /** Amount of funding already provided for this invoice. */
  fundedAmount: bigint;
  /** Unix timestamp (seconds) indicating when the payment is due. */
  dueDate: number;
  /** Current state of the invoice in the system. */
  status: InvoiceStatus;
  /** Unix timestamp (seconds) of invoice creation. */
  createdAt: number;
  /** Unix timestamp (seconds) when the invoice became fully funded. */
  fundedAt: number | null;
  /** Unix timestamp (seconds) when the goods/services were marked as shipped. */
  shippedAt: number | null;
  /** Indicates if the issuer has confirmed the shipment/fulfillment. */
  issuerConfirmed: boolean;
  /** Indicates if the buyer has confirmed receipt of goods/services. */
  buyerConfirmed: boolean;
  /** Unix timestamp (seconds) when the buyer confirmed receipt. */
  buyerConfirmedAt?: number | null;
  /** Unix timestamp (seconds) when the invoice was fully repaid. */
  repaidAt: number | null;
  /** Timestamp when the invoice was marked as defaulted, if applicable. */
  defaultedAt?: number | null;
  /** Nullable attestation fields from the indexer (set once Underwrite verifies the invoice). */
  attestationAgentId?: string | null;
  /** Risk score in basis points assigned by the underwriter. */
  riskScoreBps?: number | null;
  /** Hash of the supporting evidence document. */
  evidenceHash?: string | null;
  /** Unix timestamp (seconds) when the attestation was provided. */
  attestedAt?: number | null;
}

/**
 * Aggregated statistics and health metrics for the liquidity pool.
 */
export interface PoolStats {
  /** Total amount deposited into the pool by liquidity providers. */
  totalDeposits: bigint;
  /** Total amount of funds currently locked in funded invoices. */
  totalFunded: bigint;
  /** Current idle liquidity available for new invoice factoring. */
  availableLiquidity: bigint;
  /** Percentage of deposited liquidity actively deployed, in basis points. */
  utilizationRateBps: number;
  /** Total yield distributed to liquidity providers. */
  totalYieldDistributed: bigint;
  /** Number of invoices currently being funded or active. */
  activeInvoiceCount: number;
  /** Total number of LP pool shares issued. */
  totalShares: bigint;
}

/**
 * Represents a Liquidity Provider's share and balance in the pool.
 */
export interface LPPosition {
  /** The number of pool shares owned by the LP. */
  shares: bigint;
  /** Estimated USDC equivalent value of the LP's position. */
  usdcValue: bigint;
  /** Total yield earned by this LP over time. */
  yieldEarned: bigint;
  /** The total number of deposits made by this LP. */
  depositCount: number;
}

/**
 * Defines a registered underwriter agent authorized to attest invoices.
 */
export interface Agent {
  /** The agent's on-chain identifier (Symbol). */
  agentId: string;
  /** The Stellar public key registered for this agent. */
  pubkey: string;
  /** Whether the agent is currently active and authorized to attest. */
  active: boolean;
  /** Unix timestamp (seconds) when the agent was registered. */
  registeredAt: number;
}
