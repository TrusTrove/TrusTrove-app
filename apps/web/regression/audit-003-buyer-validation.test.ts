import { describe, it, expect } from 'vitest';
import { isValidBuyerAddress } from '@/lib/validation';

describe('Audit 003: Buyer Validation', () => {
  it('validates Stellar ed25519 public keys correctly', () => {
    const validKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    expect(isValidBuyerAddress(validKey)).toBe(true);
    expect(isValidBuyerAddress('INVALID')).toBe(false);
  });
});
