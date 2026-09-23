import {
  configureSDK,
  RegistryClient,
  PoolClient,
  InvoiceClient,
} from "@trusttrove/sdk";

// Testnet contract addresses deployed for TrusTrove — see
// docs/smart-contracts/overview.md. Override any of these via env vars, e.g.
//   HORIZON_URL=... SOROBAN_RPC_URL=... pnpm start
const HORIZON_URL =
  process.env.HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const SOROBAN_RPC_URL =
  process.env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";
const REGISTRY_CONTRACT_ID =
  process.env.REGISTRY_CONTRACT_ID ??
  "CABGWVIZFF62FG67ZGFEP67NEEY4WYTMFURDMFTKKNRDAFPKPOJDTN4C";
const POOL_CONTRACT_ID =
  process.env.POOL_CONTRACT_ID ??
  "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS";
const INVOICE_CONTRACT_ID =
  process.env.INVOICE_CONTRACT_ID ??
  "CA4O3MR7LWHRSUDBNU6FY6UDFFYBN7TGBZXBDZB4OYYXFYXIFJ6RJF6B";
const ESCROW_CONTRACT_ID =
  process.env.ESCROW_CONTRACT_ID ??
  "CAJWGUKDTTC3SKN4RAAY72J4DVIIYSCFHX6GIMNTT22ABMISJK4GBCEH";

// Read methods still need a public key to build and simulate the transaction.
// When the default key is used, the script funds it via Stellar testnet's
// Friendbot so it works out-of-the-box. Replace with your own keypair.
const SIGNER_PUBLIC_KEY =
  process.env.SIGNER_PUBLIC_KEY ??
  "GD4D4DIAFNEYB3NBC7T5WQEZQUXRWNQAWJXGWLNVVC6WUWNMIQLB5BGR";

const FRIENDBOT_URL =
  process.env.FRIENDBOT_URL ?? "https://friendbot.stellar.org";

configureSDK({
  horizonUrl: HORIZON_URL,
  sorobanRpcUrl: SOROBAN_RPC_URL,
  networkPassphrase: NETWORK_PASSPHRASE,
  contractIds: {
    registry: REGISTRY_CONTRACT_ID,
    invoice: INVOICE_CONTRACT_ID,
    pool: POOL_CONTRACT_ID,
    escrow: ESCROW_CONTRACT_ID,
    agentRegistry: process.env.AGENT_REGISTRY_CONTRACT_ID ?? "",
  },
});

// Soroban read calls are simulated against a real testnet account (sequence
// number lookup), so the sample account must exist on ledger. Friendbot
// creates/funds it on testnet; ignore "already exists" responses.
async function ensureAccountExists(publicKey: string): Promise<void> {
  const url = new URL(FRIENDBOT_URL);
  url.searchParams.set("addr", publicKey);
  try {
    await fetch(url);
    console.log(`Sample account ensured via Friendbot: ${publicKey}`);
  } catch {
    console.warn(
      `Could not reach Friendbot at ${FRIENDBOT_URL} — add testnet funds to ${publicKey} manually.`,
    );
  }
}

async function main(): Promise<void> {
  await ensureAccountExists(SIGNER_PUBLIC_KEY);
  const registry = new RegistryClient(REGISTRY_CONTRACT_ID);
  const pool = new PoolClient(POOL_CONTRACT_ID);
  const invoice = new InvoiceClient(INVOICE_CONTRACT_ID);

  // Check whether the sample address is a verified registry member.
  const verified = await registry.isVerified(
    SIGNER_PUBLIC_KEY,
    SIGNER_PUBLIC_KEY,
  );
  console.log(`isVerified(${SIGNER_PUBLIC_KEY}) =>`, verified);

  // Read current liquidity pool statistics.
  const stats = await pool.getStats(SIGNER_PUBLIC_KEY);
  console.log("Pool stats =>", stats);

  // List invoices currently listed on the marketplace.
  const listed = await invoice.getByStatus("Listed", SIGNER_PUBLIC_KEY);
  console.log(`Listed invoices (${listed.length}) =>`, listed);
}

main().catch((err) => {
  console.error("sdk-quickstart failed:", err);
  process.exit(1);
});
