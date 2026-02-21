-- Admin Dashboard Tables for KPATA AI
-- Phase 10: Back-office Admin
-- 
-- NOTE: Many tables already exist in 00000_combined.sql:
--   - support_tickets (with ticket_status enum, different columns)
--   - ticket_messages (sender_profile_id, is_internal - no sender_type)
--   - model_routing (provider/model columns, job_category enum)
--   - prompt_profiles (background_style enum)
--   - credit_packs (name, description, display_order columns)
--
-- This migration only creates NEW tables and adds missing policies.

-- ============================================
-- 1. NEW TABLE: Admin Audit Logs
-- ============================================
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES profiles(id),
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  reason TEXT,
  changes_json JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor ON admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);

-- ============================================
-- 2. NEW TABLE: App Config (key-value store)
-- ============================================
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_config (key, value) VALUES
  ('pricing', '{"credits_per_job": 1, "margin_alert_threshold": 20}')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 3. ADD COLUMNS TO EXISTING TABLES (if missing)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'priority'
  ) THEN
    ALTER TABLE jobs ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'model_used'
  ) THEN
    ALTER TABLE jobs ADD COLUMN model_used TEXT;
  END IF;
END $$;

-- ============================================
-- 4. RLS FOR NEW TABLES ONLY
-- ============================================
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_audit_logs' AND policyname = 'Service role full access on admin_audit_logs'
  ) THEN
    CREATE POLICY "Service role full access on admin_audit_logs" ON admin_audit_logs
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_config' AND policyname = 'Service role full access on app_config'
  ) THEN
    CREATE POLICY "Service role full access on app_config" ON app_config
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
