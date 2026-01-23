-- Migration: Create credit packs table and seed data
-- Description: Available credit packs for purchase

 /*
  NOTE:
  Schema already applied via supabase/migrations/00000_combined.sql.
  This migration is intentionally kept as a NO-OP to avoid duplicate object errors.
 */

 /*
CREATE TABLE credit_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Pricing
  credits INTEGER NOT NULL,
  price_xof INTEGER NOT NULL,
  
  -- Status
  active BOOLEAN NOT NULL DEFAULT true,
  
  -- Display order
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT credit_packs_code_unique UNIQUE (code),
  CONSTRAINT credit_packs_credits_positive CHECK (credits > 0),
  CONSTRAINT credit_packs_price_positive CHECK (price_xof > 0)
);

-- Index for active packs
CREATE INDEX idx_credit_packs_active ON credit_packs (active) WHERE active = true;

-- Updated_at trigger
CREATE TRIGGER credit_packs_updated_at
  BEFORE UPDATE ON credit_packs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed data
INSERT INTO credit_packs (code, name, description, credits, price_xof, display_order) VALUES
  ('PACK_5', 'Pack Starter', '5 photos professionnelles', 5, 1500, 1),
  ('PACK_10', 'Pack Standard', '10 photos professionnelles', 10, 2500, 2),
  ('PACK_30', 'Pack Pro', '30 photos professionnelles - Meilleur rapport qualité/prix', 30, 6000, 3);

COMMENT ON TABLE credit_packs IS 'Available credit packs for purchase';
COMMENT ON COLUMN credit_packs.code IS 'Unique code used in API (e.g., PACK_5)';
COMMENT ON COLUMN credit_packs.price_xof IS 'Price in West African CFA Francs';
 */
