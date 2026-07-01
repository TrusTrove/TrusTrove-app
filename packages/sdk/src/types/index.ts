export type InvoiceStatus =
  | 'Created'
  | 'Listed'
  | 'Funded'
  | 'Active'
  | 'Confirmed'
  | 'Repaid'
  | 'Defaulted';

export type AssetType = 'USDC' | 'XLM';

export interface Profile {
  address: string;
  role: 'issuer' | 'buyer';
  verified: boolean;
  registeredAt: number; // Unix timestamp (seconds)
}

export interface Invoice {
  id: string; // hex string of BytesN<32>
  issuer: string;
  buyer: string;
  faceValue: bigint; // u128 amount in stroops (10^7 = 1 unit)
  asset: AssetType; // Denominated asset (defaults to 'USDC' for backward compat)
  discountBps: number; // u32 basis points
  fundedAmount: bigint; // u128
  dueDate: number; // Unix timestamp
  status: InvoiceStatus;
  createdAt: number;
  fundedAt: number | null;
  shippedAt: number | null;
  issuerConfirmed: boolean;
  buyerConfirmed: boolean;
  repaidAt: number | null;
}

export interface PoolStats {
  totalDeposits: bigint;
  totalFunded: bigint;
  availableLiquidity: bigint;
  utilizationRateBps: number;
  totalYieldDistributed: bigint;
  activeInvoiceCount: number;
  totalShares: bigint;
}

export interface LPPosition {
  shares: bigint;
  usdcValue: bigint;
  yieldEarned: bigint;
  depositCount: number;
}
