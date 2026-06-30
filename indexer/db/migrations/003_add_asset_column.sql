-- Add asset column to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS asset VARCHAR(20) NOT NULL DEFAULT 'USDC';
