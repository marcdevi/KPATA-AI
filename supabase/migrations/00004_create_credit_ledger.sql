-- Migration: Create credit ledger (immutable)
-- Description: Immutable ledger for credit transactions

 /*
  NOTE:
  Schema already applied via supabase/migrations/00000_combined.sql.
  This migration is intentionally kept as a NO-OP to avoid duplicate object errors.
 */

 /*
CREATE TABLE credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Entry details
  entry_type ledger_entry_type NOT NULL,
  amount INTEGER NOT NULL,
  
  -- References
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  payment_id UUID, -- Will reference payments table after it's created
  
  -- Idempotency
  idempotency_key VARCHAR(255),
  
  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamp (immutable - no updated_at)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT credit_ledger_amount_not_zero CHECK (amount <> 0),
  CONSTRAINT credit_ledger_idempotency_unique UNIQUE (idempotency_key),
  -- Prevent double refund for same job
  CONSTRAINT credit_ledger_unique_refund_per_job UNIQUE (entry_type, job_id) 
    DEFERRABLE INITIALLY IMMEDIATE
);

-- Partial unique index: only one refund_job per job_id
-- This is more explicit than the constraint above
CREATE UNIQUE INDEX idx_credit_ledger_single_refund_per_job 
  ON credit_ledger (job_id) 
  WHERE entry_type = 'refund_job';

-- Indexes
CREATE INDEX idx_credit_ledger_profile_id ON credit_ledger (profile_id);
CREATE INDEX idx_credit_ledger_job_id ON credit_ledger (job_id);
CREATE INDEX idx_credit_ledger_entry_type ON credit_ledger (entry_type);
CREATE INDEX idx_credit_ledger_created_at ON credit_ledger (created_at DESC);
CREATE INDEX idx_credit_ledger_profile_created ON credit_ledger (profile_id, created_at DESC);

-- Prevent UPDATE and DELETE on credit_ledger (immutable)
CREATE OR REPLACE FUNCTION prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'credit_ledger is immutable. UPDATE and DELETE operations are not allowed.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER credit_ledger_prevent_update
  BEFORE UPDATE ON credit_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_modification();

CREATE TRIGGER credit_ledger_prevent_delete
  BEFORE DELETE ON credit_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_modification();

COMMENT ON TABLE credit_ledger IS 'Immutable ledger for all credit transactions';
COMMENT ON COLUMN credit_ledger.amount IS 'Positive for credits added, negative for credits spent';
COMMENT ON CONSTRAINT credit_ledger_unique_refund_per_job ON credit_ledger IS 'Prevents multiple refunds for the same job';
 */
