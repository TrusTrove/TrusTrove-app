import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ConfigBanner } from './ConfigBanner';

vi.mock('@/lib/config', () => ({
  validateConfig: () => ({
    missing: ['NEXT_PUBLIC_ESCROW_CONTRACT_ID'],
    invalid: ['NEXT_PUBLIC_STELLAR_NETWORK'],
    isConfigured: false,
  }),
}));

describe('ConfigBanner', () => {
  it('renders missing and invalid configuration items', () => {
    render(<ConfigBanner />);
    expect(screen.getByText(/Escrow Contract/i)).toBeDefined();
    expect(screen.getByText(/Stellar Network/i)).toBeDefined();
  });
});
