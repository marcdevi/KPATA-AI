-- Migration: Create jobs and assets tables
-- Description: Job processing and media assets

 /*
  NOTE:
  Schema already applied via supabase/migrations/00000_combined.sql.
  This migration is intentionally kept as a NO-OP to avoid duplicate object errors.
 */

 /*
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Idempotency & tracking
  correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(255) NOT NULL,
  
  -- Source information
  source_channel source_channel NOT NULL DEFAULT 'mobile_app',
  source_message_id VARCHAR(255),
  client_request_id VARCHAR(255),
  
  -- Job configuration
  category job_category NOT NULL DEFAULT 'clothing',
  background_style background_style NOT NULL DEFAULT 'studio_white',
  template_layout template_layout NOT NULL DEFAULT 'square_1x1',
  mannequin_mode mannequin_mode NOT NULL DEFAULT 'none',
  
  -- Processing status
  status job_status NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error_code VARCHAR(50),
  last_error_message TEXT,
  
  -- Performance tracking
  stage_durations JSONB DEFAULT '{}',
  provider_used VARCHAR(50),
  model_used VARCHAR(100),
  duration_ms_total INTEGER,
  
  -- Timestamps
  queued_at TIMESTAMPTZ,
  processing_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT jobs_idempotency_key_unique UNIQUE (idempotency_key)
);

-- Indexes for jobs
CREATE INDEX idx_jobs_profile_id ON jobs (profile_id);
CREATE INDEX idx_jobs_status ON jobs (status);
CREATE INDEX idx_jobs_created_at ON jobs (created_at DESC);
CREATE INDEX idx_jobs_profile_status ON jobs (profile_id, status);
CREATE INDEX idx_jobs_profile_created ON jobs (profile_id, created_at DESC);
CREATE INDEX idx_jobs_correlation_id ON jobs (correlation_id);
CREATE INDEX idx_jobs_source_channel ON jobs (source_channel);

-- Updated_at trigger for jobs
CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Assets table
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  
  -- Storage info
  bucket VARCHAR(100) NOT NULL,
  key VARCHAR(500) NOT NULL,
  
  -- Asset metadata
  type asset_type NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL,
  
  -- Optional metadata
  width INTEGER,
  height INTEGER,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT assets_bucket_key_unique UNIQUE (bucket, key)
);

-- Indexes for assets
CREATE INDEX idx_assets_owner_profile_id ON assets (owner_profile_id);
CREATE INDEX idx_assets_job_id ON assets (job_id);
CREATE INDEX idx_assets_type ON assets (type);
CREATE INDEX idx_assets_created_at ON assets (created_at DESC);
CREATE INDEX idx_assets_owner_created ON assets (owner_profile_id, created_at DESC);

COMMENT ON TABLE jobs IS 'Image processing jobs';
COMMENT ON COLUMN jobs.idempotency_key IS 'Client-provided key to prevent duplicate job creation';
COMMENT ON COLUMN jobs.stage_durations IS 'JSON object with timing for each processing stage';
COMMENT ON TABLE assets IS 'Media assets stored in R2/S3';
COMMENT ON COLUMN assets.key IS 'Object key in the storage bucket';
 */
