import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoiceForm } from './InvoiceForm';

// Global mock for fetch to spy on endpoint requests
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('InvoiceForm Component Boundary Tests', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('should successfully submit the form data on the happy path', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'inv_123', status: 'success' }),
    });

    render(<InvoiceForm />);

    // Simulate filling out form fields
    fireEvent.change(screen.getByLabelText(/client name/i), { target: { value: 'Acme Corp' } });
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '1500' } });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /create invoice/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/invoices', expect.any(Object));
      expect(screen.getByText(/invoice created successfully/i)).toBeInTheDocument();
    });
  });

  it('should cleanly surface error messages when the invoice creation API encounters an HTTP 500 failure', async () => {
    // Force the internal API layer to simulate a network crash payload
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Internal Server Error: Database write failure' }),
    });

    render(<InvoiceForm />);

    // Fill out form fields to enable valid submission states
    fireEvent.change(screen.getByLabelText(/client name/i), { target: { value: 'Acme Corp' } });
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '1500' } });

    // Click submit button
    fireEvent.click(screen.getByRole('button', { name: /create invoice/i }));

    // Core acceptance criteria: Verify that the fallback validation error text handles the api reject gracefully
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      
      // Asserts that an error notice component or text container is populated within the DOM viewport
      const errorBoundaryNotice = screen.getByRole('alert') || screen.getByText(/failed to create invoice/i);
      expect(errorBoundaryNotice).toBeInTheDocument();
    });
  });
});
