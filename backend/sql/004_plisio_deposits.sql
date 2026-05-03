-- Add Plisio-related columns to deposits table
ALTER TABLE deposits ADD COLUMN plisio_invoice_id TEXT;
ALTER TABLE deposits ADD COLUMN plisio_wallet TEXT;
ALTER TABLE deposits ADD COLUMN crypto_currency TEXT;
ALTER TABLE deposits ADD COLUMN crypto_amount REAL;
ALTER TABLE deposits ADD COLUMN txid TEXT;
ALTER TABLE deposits ADD COLUMN confirmations INTEGER DEFAULT 0;
