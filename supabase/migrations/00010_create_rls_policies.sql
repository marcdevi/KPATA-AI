-- Migration: Enable RLS and create policies
-- Description: Row Level Security for user-facing tables

 /*
  NOTE:
  Schema already applied via supabase/migrations/00000_combined.sql.
  This migration is intentionally kept as a NO-OP to avoid duplicate object errors.
 */

 /*
-- Enable RLS on user-facing tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Users can read their own profile
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (limited fields)
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY profiles_select_admin ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('admin', 'super_admin', 'support_agent')
    )
  );

-- Admins can update all profiles
CREATE POLICY profiles_update_admin ON profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- JOBS POLICIES
-- ============================================

-- Users can read their own jobs
CREATE POLICY jobs_select_own ON jobs
  FOR SELECT
  USING (profile_id = auth.uid());

-- Users can insert their own jobs
CREATE POLICY jobs_insert_own ON jobs
  FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- Admins/support can read all jobs
CREATE POLICY jobs_select_admin ON jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('admin', 'super_admin', 'support_agent')
    )
  );

-- ============================================
-- ASSETS POLICIES
-- ============================================

-- Users can read their own assets
CREATE POLICY assets_select_own ON assets
  FOR SELECT
  USING (owner_profile_id = auth.uid());

-- Users can insert their own assets
CREATE POLICY assets_insert_own ON assets
  FOR INSERT
  WITH CHECK (owner_profile_id = auth.uid());

-- Admins can read all assets
CREATE POLICY assets_select_admin ON assets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('admin', 'super_admin', 'support_agent')
    )
  );

-- ============================================
-- CREDIT LEDGER POLICIES
-- ============================================

-- Users can read their own ledger entries
CREATE POLICY credit_ledger_select_own ON credit_ledger
  FOR SELECT
  USING (profile_id = auth.uid());

-- Admins can read all ledger entries
CREATE POLICY credit_ledger_select_admin ON credit_ledger
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- No direct INSERT/UPDATE/DELETE for users (handled by functions)

-- ============================================
-- PAYMENTS POLICIES
-- ============================================

-- Users can read their own payments
CREATE POLICY payments_select_own ON payments
  FOR SELECT
  USING (profile_id = auth.uid());

-- Admins can read all payments
CREATE POLICY payments_select_admin ON payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- SUPPORT TICKETS POLICIES
-- ============================================

-- Users can read their own tickets
CREATE POLICY support_tickets_select_own ON support_tickets
  FOR SELECT
  USING (profile_id = auth.uid());

-- Users can create their own tickets
CREATE POLICY support_tickets_insert_own ON support_tickets
  FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- Support/admins can read all tickets
CREATE POLICY support_tickets_select_support ON support_tickets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('admin', 'super_admin', 'support_agent')
    )
  );

-- Support/admins can update tickets
CREATE POLICY support_tickets_update_support ON support_tickets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('admin', 'super_admin', 'support_agent')
    )
  );

-- ============================================
-- TICKET MESSAGES POLICIES
-- ============================================

-- Users can read messages on their tickets (non-internal only)
CREATE POLICY ticket_messages_select_own ON ticket_messages
  FOR SELECT
  USING (
    NOT is_internal AND
    EXISTS (
      SELECT 1 FROM support_tickets t 
      WHERE t.id = ticket_id 
      AND t.profile_id = auth.uid()
    )
  );

-- Users can insert messages on their tickets
CREATE POLICY ticket_messages_insert_own ON ticket_messages
  FOR INSERT
  WITH CHECK (
    sender_profile_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM support_tickets t 
      WHERE t.id = ticket_id 
      AND t.profile_id = auth.uid()
    )
  );

-- Support/admins can read all messages
CREATE POLICY ticket_messages_select_support ON ticket_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('admin', 'super_admin', 'support_agent')
    )
  );

-- Support/admins can insert messages
CREATE POLICY ticket_messages_insert_support ON ticket_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('admin', 'super_admin', 'support_agent')
    )
  );

COMMENT ON POLICY profiles_select_own ON profiles IS 'Users can only read their own profile';
COMMENT ON POLICY jobs_select_own ON jobs IS 'Users can only read their own jobs';
COMMENT ON POLICY credit_ledger_select_own ON credit_ledger IS 'Users can only read their own ledger entries';
 */
