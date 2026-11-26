import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateConfig } from './config';

describe('config validation', () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it('validates required variables and formatting', () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'testnet';
    process.env.NEXT_PUBLIC_HORIZON_URL = 'https://horizon-testnet.stellar.org';
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
    process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID = 'CABGWVIZFF62FG67ZGFEP67NEEY4WYTMFURDMFTKKNRDAFPKPOJDTN4C';
    process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID = 'CA4O3MR7LWHRSUDBNU6FY6UDFFYBN7TGBZXBDZB4OYYXFYXIFJ6RJF6B';
    process.env.NEXT_PUBLIC_POOL_CONTRACT_ID = 'CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS';
    process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID = 'CAJWGUKDTTC3SKN4RAAY72J4DVIIYSCFHX6GIMNTT22ABMISJK4GBCEH';
    process.env.NEXT_PUBLIC_USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
    process.env.NEXT_PUBLIC_USDC_ASSET_CODE = 'USDC';

    const res = validateConfig();
    expect(res.isConfigured).toBe(true);
  });
});
