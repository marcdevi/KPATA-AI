-- ============================================
-- KPATA AI - Jobs Failed Definitely (DLQ) Table
-- ============================================
-- Stores jobs that have permanently failed after all retry attempts

CREATE TABLE IF NOT EXISTS jobs_failed_definitely (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  correlation_id UUID NOT NULL,
  error_code VARCHAR(50) NOT NULL,
  error_message TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}',
  stack_trace TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT jobs_failed_definitely_job_id_unique UNIQUE (job_id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_failed_definitely_profile_id ON jobs_failed_definitely (profile_id);
CREATE INDEX IF NOT EXISTS idx_jobs_failed_definitely_error_code ON jobs_failed_definitely (error_code);
CREATE INDEX IF NOT EXISTS idx_jobs_failed_definitely_last_attempt_at ON jobs_failed_definitely (last_attempt_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_failed_definitely_reviewed ON jobs_failed_definitely (reviewed_at) WHERE reviewed_at IS NULL;

-- RLS Policies
ALTER TABLE jobs_failed_definitely ENABLE ROW LEVEL SECURITY;

-- Admin/Support can view all failed jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs_failed_definitely'
      AND policyname = 'jobs_failed_definitely_select_admin'
  ) THEN
    CREATE POLICY jobs_failed_definitely_select_admin ON jobs_failed_definitely FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin', 'support_agent'))
    );
  END IF;
END $$;

-- Admin can update (mark as reviewed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs_failed_definitely'
      AND policyname = 'jobs_failed_definitely_update_admin'
  ) THEN
    CREATE POLICY jobs_failed_definitely_update_admin ON jobs_failed_definitely FOR UPDATE USING (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin'))
    );
  END IF;
END $$;

COMMENT ON TABLE jobs_failed_definitely IS 'Dead Letter Queue - Jobs that failed permanently after all retry attempts';
