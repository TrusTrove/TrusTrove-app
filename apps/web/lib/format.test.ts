import { describe, it, expect } from 'vitest';
import { truncateAddress } from './format';

describe('truncateAddress', () => {
  it('returns empty string for undefined or empty input', () => {
    expect(truncateAddress(undefined)).toBe('');
    expect(truncateAddress('')).toBe('');
  });

  it('returns original string when length is 10 or shorter', () => {
    expect(truncateAddress('GABCD')).toBe('GABCD');
    expect(truncateAddress('1234567890')).toBe('1234567890');
  });

  it('truncates strings longer than 10 characters', () => {
    expect(truncateAddress('12345678901')).toBe('123456...8901');
  });

  it('truncates a 56-character Stellar address correctly', () => {
    const addr = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
    expect(truncateAddress(addr)).toBe('GBBD47...FLA5');
  });
});
