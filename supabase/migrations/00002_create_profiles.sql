-- Migration: Create profiles table
-- Description: User profiles with phone authentication

 /*
  NOTE:
  Schema already applied via supabase/migrations/00000_combined.sql.
  This migration is intentionally kept as a NO-OP to avoid duplicate object errors.
 */

 /*
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 VARCHAR(20) NOT NULL,
  name VARCHAR(100),
  role user_role NOT NULL DEFAULT 'user_free',
  status profile_status NOT NULL DEFAULT 'active',
  violation_count INTEGER NOT NULL DEFAULT 0,
  ban_reason TEXT,
  terms_accepted_at TIMESTAMPTZ,
  terms_version VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT profiles_phone_e164_unique UNIQUE (phone_e164),
  CONSTRAINT profiles_phone_e164_format CHECK (phone_e164 ~ '^\+[1-9]\d{1,14}$')
);

-- Index for phone lookups
CREATE INDEX idx_profiles_phone_e164 ON profiles (phone_e164);

-- Index for role-based queries
CREATE INDEX idx_profiles_role ON profiles (role);

-- Index for status filtering
CREATE INDEX idx_profiles_status ON profiles (status);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE profiles IS 'User profiles for KPATA AI platform';
COMMENT ON COLUMN profiles.phone_e164 IS 'Phone number in E.164 format (e.g., +2250700000000)';
COMMENT ON COLUMN profiles.violation_count IS 'Number of policy violations by user';
COMMENT ON COLUMN profiles.terms_version IS 'Version of terms accepted by user';
 */
