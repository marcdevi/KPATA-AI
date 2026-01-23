-- Migration: Create payments table
-- Description: Payment transactions from Mobile Money providers

 /*
  NOTE:
  Schema already applied via supabase/migrations/00000_combined.sql.
  This migration is intentionally kept as a NO-OP to avoid duplicate object errors.
 */

 /*
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Provider info
  provider payment_provider NOT NULL,
  provider_ref VARCHAR(255) NOT NULL,
  
  -- Pack info
  pack_code VARCHAR(50) NOT NULL,
  
  -- Amount
  amount_xof INTEGER NOT NULL,
  credits_granted INTEGER NOT NULL,
  
  -- Status
  status payment_status NOT NULL DEFAULT 'pending',
  
  -- Phone used for payment
  phone_e164 VARCHAR(20),
  
  -- Raw webhook data
  raw_event JSONB,
  
  -- Timestamps
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: same provider + provider_ref = same payment
  CONSTRAINT payments_provider_ref_unique UNIQUE (provider, provider_ref)
);

-- Add foreign key from credit_ledger to payments
ALTER TABLE credit_ledger 
  ADD CONSTRAINT credit_ledger_payment_id_fkey 
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_payments_profile_id ON payments (profile_id);
CREATE INDEX idx_payments_status ON payments (status);
CREATE INDEX idx_payments_provider ON payments (provider);
CREATE INDEX idx_payments_created_at ON payments (created_at DESC);
CREATE INDEX idx_payments_profile_created ON payments (profile_id, created_at DESC);

-- Updated_at trigger
CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE payments IS 'Mobile Money payment transactions';
COMMENT ON COLUMN payments.provider_ref IS 'Unique reference from the payment provider';
COMMENT ON COLUMN payments.amount_xof IS 'Amount in West African CFA Francs';
COMMENT ON COLUMN payments.raw_event IS 'Raw webhook payload from provider';
 */
