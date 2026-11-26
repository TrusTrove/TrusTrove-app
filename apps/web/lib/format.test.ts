import { describe, it, expect } from 'vitest';
import { truncateAddress } from './format';

describe('truncateAddress', () => {
  it('handles empty or undefined-like input', () => {
    expect(truncateAddress('')).toBe('');
  });

  it('returns original string unchanged when <= 10 characters', () => {
    expect(truncateAddress('GABCD')).toBe('GABCD');
    expect(truncateAddress('1234567890')).toBe('1234567890');
  });

  it('returns original string for length 1 and 10', () => {
    expect(truncateAddress('A')).toBe('A');
    expect(truncateAddress('0123456789')).toBe('0123456789');
  });

  it('truncates strings of length 11 and full Stellar addresses', () => {
    expect(truncateAddress('0123456789A')).toBe('012345...789A');
    const stellarAddr = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    expect(stellarAddr.length).toBe(56);
    expect(truncateAddress(stellarAddr)).toBe('GAAAAA...DWHF');
  });
});
