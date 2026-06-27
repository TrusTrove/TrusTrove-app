CREATE INDEX IF NOT EXISTS idx_invoices_issuer ON invoices(issuer);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_status_due_date ON invoices(status, due_date);
