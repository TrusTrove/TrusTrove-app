-- Supports ORDER BY created_at DESC in GetInvoicesPage (db/queries.go).
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices (created_at);
