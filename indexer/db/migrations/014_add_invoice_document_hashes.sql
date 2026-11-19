CREATE TABLE IF NOT EXISTS invoice_document_hashes (
    invoice_id VARCHAR(64) PRIMARY KEY,
    document_hash CHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT invoice_document_hashes_hash_format
        CHECK (document_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_invoice_document_hashes_document_hash
    ON invoice_document_hashes(document_hash);

CREATE INDEX IF NOT EXISTS idx_invoices_buyer
    ON invoices(buyer);
