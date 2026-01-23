-- ============================================
-- KPATA AI - Content Reports Table
-- ============================================
-- Stores user-submitted content reports for moderation

CREATE TYPE report_status AS ENUM (
  'pending',
  'reviewing',
  'resolved_valid',
  'resolved_invalid',
  'dismissed'
);

CREATE TYPE report_reason AS ENUM (
  'nsfw',
  'violence',
  'hate_speech',
  'spam',
  'copyright',
  'other'
);

CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  reported_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  reported_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason report_reason NOT NULL,
  description TEXT,
  status report_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  action_taken TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT content_reports_has_target CHECK (
    reported_job_id IS NOT NULL OR 
    reported_asset_id IS NOT NULL OR 
    reported_profile_id IS NOT NULL
  )
);

CREATE INDEX idx_content_reports_reporter_id ON content_reports (reporter_id);
CREATE INDEX idx_content_reports_status ON content_reports (status);
CREATE INDEX idx_content_reports_created_at ON content_reports (created_at DESC);
CREATE INDEX idx_content_reports_pending ON content_reports (created_at DESC) WHERE status = 'pending';

CREATE TRIGGER content_reports_updated_at
  BEFORE UPDATE ON content_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

-- Users can create reports
CREATE POLICY content_reports_insert_own ON content_reports FOR INSERT 
  WITH CHECK (reporter_id = auth.uid());

-- Users can view their own reports
CREATE POLICY content_reports_select_own ON content_reports FOR SELECT 
  USING (reporter_id = auth.uid());

-- Admin/Support can view all reports
CREATE POLICY content_reports_select_admin ON content_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin', 'support_agent'))
);

-- Admin can update reports
CREATE POLICY content_reports_update_admin ON content_reports FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin', 'support_agent'))
);

COMMENT ON TABLE content_reports IS 'User-submitted content reports for moderation review';
