-- Migration: Create admin audit logs (immutable)
-- Description: Immutable audit trail for admin actions

 /*
  NOTE:
  Schema already applied via supabase/migrations/00000_combined.sql.
  This migration is intentionally kept as a NO-OP to avoid duplicate object errors.
 */

 /*
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Actor info
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role user_role NOT NULL,
  
  -- Action details
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  
  -- Context
  reason TEXT,
  details JSONB DEFAULT '{}',
  
  -- Request info
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp (immutable - no updated_at)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_admin_audit_logs_actor_id ON admin_audit_logs (actor_id);
CREATE INDEX idx_admin_audit_logs_action ON admin_audit_logs (action);
CREATE INDEX idx_admin_audit_logs_target ON admin_audit_logs (target_type, target_id);
CREATE INDEX idx_admin_audit_logs_created_at ON admin_audit_logs (created_at DESC);

-- Prevent UPDATE on admin_audit_logs (immutable)
CREATE TRIGGER admin_audit_logs_prevent_update
  BEFORE UPDATE ON admin_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_modification();

-- Prevent DELETE on admin_audit_logs (immutable)
CREATE TRIGGER admin_audit_logs_prevent_delete
  BEFORE DELETE ON admin_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_modification();

COMMENT ON TABLE admin_audit_logs IS 'Immutable audit trail for administrative actions';
COMMENT ON COLUMN admin_audit_logs.action IS 'Action performed (e.g., ban_user, adjust_credits, update_config)';
COMMENT ON COLUMN admin_audit_logs.target_type IS 'Type of entity affected (e.g., profile, job, payment)';
 */
