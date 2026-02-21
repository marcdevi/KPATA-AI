-- Create mannequins table for custom mannequin photos
CREATE TABLE IF NOT EXISTS mannequins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Images stored in R2
  face_image_bucket VARCHAR(100),
  face_image_key VARCHAR(500),
  face_image_url TEXT,
  
  body_image_bucket VARCHAR(100),
  body_image_key VARCHAR(500),
  body_image_url TEXT,
  
  -- Metadata
  is_celebrity_confirmed BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, disabled
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT mannequins_profile_id_unique UNIQUE (profile_id)
);

-- Index for lookups
CREATE INDEX idx_mannequins_profile_id ON mannequins(profile_id);
CREATE INDEX idx_mannequins_status ON mannequins(status);

-- RLS Policies
ALTER TABLE mannequins ENABLE ROW LEVEL SECURITY;

-- Users can only see their own mannequins
CREATE POLICY mannequins_select_own ON mannequins
  FOR SELECT
  USING (profile_id = auth.uid());

-- Users can insert their own mannequins
CREATE POLICY mannequins_insert_own ON mannequins
  FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- Users can update their own mannequins
CREATE POLICY mannequins_update_own ON mannequins
  FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Users can delete their own mannequins
CREATE POLICY mannequins_delete_own ON mannequins
  FOR DELETE
  USING (profile_id = auth.uid());

-- Service role can do everything
CREATE POLICY mannequins_service_all ON mannequins
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Update mannequin_mode enum to include custom option
ALTER TYPE mannequin_mode ADD VALUE IF NOT EXISTS 'custom';

-- Add updated_at trigger
CREATE TRIGGER set_mannequins_updated_at
  BEFORE UPDATE ON mannequins
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
