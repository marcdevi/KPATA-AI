-- ============================================
-- KPATA AI - Combined Database Migration
-- ============================================
-- This file combines all migrations for easy application
-- Run: psql -d your_database -f 00000_combined.sql

-- ============================================
-- 1. ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM (
  'user_free',
  'user_pro',
  'reseller',
  'support_agent',
  'admin',
  'super_admin'
);

CREATE TYPE profile_status AS ENUM (
  'active',
  'banned',
  'deleting',
  'deleted'
);

CREATE TYPE job_status AS ENUM (
  'pending',
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE background_style AS ENUM (
  'studio_white',
  'studio_gray',
  'gradient_soft',
  'outdoor_street',
  'outdoor_nature',
  'lifestyle_cafe',
  'lifestyle_home',
  'abstract_colorful',
  'custom'
);

CREATE TYPE template_layout AS ENUM (
  'square_1x1',
  'portrait_4x5',
  'story_9x16',
  'landscape_16x9',
  'carousel'
);

CREATE TYPE job_category AS ENUM (
  'clothing',
  'beauty',
  'accessories',
  'shoes',
  'jewelry',
  'bags',
  'other'
);

CREATE TYPE mannequin_mode AS ENUM (
  'none',
  'ghost_mannequin',
  'virtual_model_female',
  'virtual_model_male',
  'flat_lay'
);

CREATE TYPE source_channel AS ENUM (
  'mobile_app',
  'telegram_bot',
  'whatsapp_bot',
  'web_app',
  'api'
);

CREATE TYPE ledger_entry_type AS ENUM (
  'topup',
  'debit_job',
  'refund_job',
  'bonus',
  'admin_adjustment'
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'succeeded',
  'failed',
  'canceled'
);

CREATE TYPE payment_provider AS ENUM (
  'orange_money',
  'mtn_money',
  'wave',
  'moov_money'
);

CREATE TYPE asset_type AS ENUM (
  'input_image',
  'output_image',
  'thumbnail'
);

CREATE TYPE ticket_status AS ENUM (
  'open',
  'in_progress',
  'waiting_customer',
  'resolved',
  'closed'
);

CREATE TYPE ticket_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

-- ============================================
-- 2. HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'This table is immutable. UPDATE and DELETE operations are not allowed.';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. TABLES
-- ============================================

-- Profiles
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

CREATE INDEX idx_profiles_phone_e164 ON profiles (phone_e164);
CREATE INDEX idx_profiles_role ON profiles (role);
CREATE INDEX idx_profiles_status ON profiles (status);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Jobs
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(255) NOT NULL,
  source_channel source_channel NOT NULL DEFAULT 'mobile_app',
  source_message_id VARCHAR(255),
  client_request_id VARCHAR(255),
  category job_category NOT NULL DEFAULT 'clothing',
  background_style background_style NOT NULL DEFAULT 'studio_white',
  template_layout template_layout NOT NULL DEFAULT 'square_1x1',
  mannequin_mode mannequin_mode NOT NULL DEFAULT 'none',
  status job_status NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error_code VARCHAR(50),
  last_error_message TEXT,
  stage_durations JSONB DEFAULT '{}',
  provider_used VARCHAR(50),
  model_used VARCHAR(100),
  duration_ms_total INTEGER,
  queued_at TIMESTAMPTZ,
  processing_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT jobs_idempotency_key_unique UNIQUE (idempotency_key)
);

CREATE INDEX idx_jobs_profile_id ON jobs (profile_id);
CREATE INDEX idx_jobs_status ON jobs (status);
CREATE INDEX idx_jobs_created_at ON jobs (created_at DESC);
CREATE INDEX idx_jobs_profile_status ON jobs (profile_id, status);
CREATE INDEX idx_jobs_profile_created ON jobs (profile_id, created_at DESC);
CREATE INDEX idx_jobs_correlation_id ON jobs (correlation_id);

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Assets
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  bucket VARCHAR(100) NOT NULL,
  key VARCHAR(500) NOT NULL,
  type asset_type NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL,
  width INTEGER,
  height INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assets_bucket_key_unique UNIQUE (bucket, key)
);

CREATE INDEX idx_assets_owner_profile_id ON assets (owner_profile_id);
CREATE INDEX idx_assets_job_id ON assets (job_id);
CREATE INDEX idx_assets_owner_created ON assets (owner_profile_id, created_at DESC);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider payment_provider NOT NULL,
  provider_ref VARCHAR(255) NOT NULL,
  pack_code VARCHAR(50) NOT NULL,
  amount_xof INTEGER NOT NULL,
  credits_granted INTEGER NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  phone_e164 VARCHAR(20),
  raw_event JSONB,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payments_provider_ref_unique UNIQUE (provider, provider_ref)
);

CREATE INDEX idx_payments_profile_id ON payments (profile_id);
CREATE INDEX idx_payments_status ON payments (status);
CREATE INDEX idx_payments_created_at ON payments (created_at DESC);

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Credit Ledger (immutable)
CREATE TABLE credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_type ledger_entry_type NOT NULL,
  amount INTEGER NOT NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  idempotency_key VARCHAR(255),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT credit_ledger_amount_not_zero CHECK (amount <> 0),
  CONSTRAINT credit_ledger_idempotency_unique UNIQUE (idempotency_key)
);

CREATE UNIQUE INDEX idx_credit_ledger_single_refund_per_job 
  ON credit_ledger (job_id) WHERE entry_type = 'refund_job';

CREATE INDEX idx_credit_ledger_profile_id ON credit_ledger (profile_id);
CREATE INDEX idx_credit_ledger_profile_created ON credit_ledger (profile_id, created_at DESC);

CREATE TRIGGER credit_ledger_prevent_update
  BEFORE UPDATE ON credit_ledger
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_modification();

CREATE TRIGGER credit_ledger_prevent_delete
  BEFORE DELETE ON credit_ledger
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_modification();

-- Credit Packs
CREATE TABLE credit_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  credits INTEGER NOT NULL,
  price_xof INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT credit_packs_code_unique UNIQUE (code),
  CONSTRAINT credit_packs_credits_positive CHECK (credits > 0),
  CONSTRAINT credit_packs_price_positive CHECK (price_xof > 0)
);

CREATE TRIGGER credit_packs_updated_at
  BEFORE UPDATE ON credit_packs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Support Tickets
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  status ticket_status NOT NULL DEFAULT 'open',
  priority ticket_priority NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  related_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  related_payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_support_tickets_profile_id ON support_tickets (profile_id);
CREATE INDEX idx_support_tickets_status ON support_tickets (status);
CREATE INDEX idx_support_tickets_last_message_at ON support_tickets (last_message_at DESC);

CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Ticket Messages
CREATE TABLE ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachments UUID[] DEFAULT '{}',
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ticket_messages_ticket_id ON ticket_messages (ticket_id);
CREATE INDEX idx_ticket_messages_ticket_created ON ticket_messages (ticket_id, created_at DESC);

CREATE OR REPLACE FUNCTION update_ticket_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE support_tickets SET last_message_at = NEW.created_at WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ticket_messages_update_last_message
  AFTER INSERT ON ticket_messages
  FOR EACH ROW EXECUTE FUNCTION update_ticket_last_message_at();

-- Model Routing
CREATE TABLE model_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category job_category NOT NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  fallback_provider VARCHAR(50),
  fallback_model VARCHAR(100),
  priority INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT model_routing_category_unique UNIQUE (category)
);

CREATE TRIGGER model_routing_updated_at
  BEFORE UPDATE ON model_routing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Prompt Profiles
CREATE TABLE prompt_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  style background_style NOT NULL,
  name VARCHAR(100) NOT NULL,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  params_json JSONB NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_prompt_profiles_active_style 
  ON prompt_profiles (style) WHERE active = true;

CREATE TRIGGER prompt_profiles_updated_at
  BEFORE UPDATE ON prompt_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Pricing Config
CREATE TABLE pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pricing_config_key_unique UNIQUE (key)
);

CREATE TRIGGER pricing_config_updated_at
  BEFORE UPDATE ON pricing_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Admin Audit Logs (immutable)
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role user_role NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  reason TEXT,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_logs_actor_id ON admin_audit_logs (actor_id);
CREATE INDEX idx_admin_audit_logs_created_at ON admin_audit_logs (created_at DESC);

CREATE TRIGGER admin_audit_logs_prevent_update
  BEFORE UPDATE ON admin_audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_modification();

CREATE TRIGGER admin_audit_logs_prevent_delete
  BEFORE DELETE ON admin_audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_modification();

-- ============================================
-- 4. FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION get_credit_balance(p_profile_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE v_balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM credit_ledger WHERE profile_id = p_profile_id;
  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION create_job_and_debit(
  p_profile_id UUID,
  p_idempotency_key VARCHAR(255),
  p_category job_category DEFAULT 'clothing',
  p_background_style background_style DEFAULT 'studio_white',
  p_template_layout template_layout DEFAULT 'square_1x1',
  p_mannequin_mode mannequin_mode DEFAULT 'none',
  p_source_channel source_channel DEFAULT 'mobile_app',
  p_source_message_id VARCHAR(255) DEFAULT NULL,
  p_client_request_id VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE (job_id UUID, was_created BOOLEAN, balance_after INTEGER, error_code VARCHAR(50))
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_existing_job_id UUID;
  v_new_job_id UUID;
  v_current_balance INTEGER;
  v_credits_per_job INTEGER;
  v_balance_after INTEGER;
BEGIN
  SELECT (value::text)::integer INTO v_credits_per_job
  FROM pricing_config WHERE key = 'credits_per_job';
  IF v_credits_per_job IS NULL THEN v_credits_per_job := 1; END IF;

  SELECT j.id INTO v_existing_job_id FROM jobs j WHERE j.idempotency_key = p_idempotency_key;
  
  IF v_existing_job_id IS NOT NULL THEN
    SELECT get_credit_balance(p_profile_id) INTO v_balance_after;
    RETURN QUERY SELECT v_existing_job_id, FALSE, v_balance_after, NULL::VARCHAR(50);
    RETURN;
  END IF;
  
  SELECT get_credit_balance(p_profile_id) INTO v_current_balance;
  
  IF v_current_balance < v_credits_per_job THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, v_current_balance, 'INSUFFICIENT_CREDITS'::VARCHAR(50);
    RETURN;
  END IF;
  
  INSERT INTO jobs (profile_id, idempotency_key, category, background_style, template_layout, mannequin_mode, source_channel, source_message_id, client_request_id, status)
  VALUES (p_profile_id, p_idempotency_key, p_category, p_background_style, p_template_layout, p_mannequin_mode, p_source_channel, p_source_message_id, p_client_request_id, 'queued')
  RETURNING id INTO v_new_job_id;
  
  INSERT INTO credit_ledger (profile_id, entry_type, amount, job_id, idempotency_key, description)
  VALUES (p_profile_id, 'debit_job', -v_credits_per_job, v_new_job_id, 'debit_' || p_idempotency_key, 'Job creation debit');
  
  SELECT get_credit_balance(p_profile_id) INTO v_balance_after;
  RETURN QUERY SELECT v_new_job_id, TRUE, v_balance_after, NULL::VARCHAR(50);
END;
$$;

CREATE OR REPLACE FUNCTION refund_job_once(p_job_id UUID)
RETURNS TABLE (refund_created BOOLEAN, refund_amount INTEGER, error_message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
  v_credits_per_job INTEGER;
  v_existing_refund UUID;
BEGIN
  SELECT j.*, p.id as owner_id INTO v_job
  FROM jobs j JOIN profiles p ON p.id = j.profile_id WHERE j.id = p_job_id;
  
  IF v_job IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Job not found'::TEXT;
    RETURN;
  END IF;
  
  SELECT id INTO v_existing_refund FROM credit_ledger WHERE job_id = p_job_id AND entry_type = 'refund_job';
  
  IF v_existing_refund IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Refund already exists'::TEXT;
    RETURN;
  END IF;
  
  SELECT (value::text)::integer INTO v_credits_per_job FROM pricing_config WHERE key = 'credits_per_job';
  IF v_credits_per_job IS NULL THEN v_credits_per_job := 1; END IF;
  
  BEGIN
    INSERT INTO credit_ledger (profile_id, entry_type, amount, job_id, idempotency_key, description)
    VALUES (v_job.profile_id, 'refund_job', v_credits_per_job, p_job_id, 'refund_' || p_job_id::text, 'Automatic refund for failed job');
    RETURN QUERY SELECT TRUE, v_credits_per_job, NULL::TEXT;
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT FALSE, 0, 'Refund already exists (concurrent)'::TEXT;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_refund_on_job_failure()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'failed' AND (OLD.status IS NULL OR OLD.status <> 'failed') THEN
    PERFORM refund_job_once(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER jobs_auto_refund_on_failure
  AFTER UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION trigger_refund_on_job_failure();

CREATE OR REPLACE FUNCTION process_payment_topup(
  p_profile_id UUID,
  p_provider payment_provider,
  p_provider_ref VARCHAR(255),
  p_pack_code VARCHAR(50),
  p_amount_xof INTEGER,
  p_phone_e164 VARCHAR(20) DEFAULT NULL,
  p_raw_event JSONB DEFAULT NULL
)
RETURNS TABLE (payment_id UUID, was_created BOOLEAN, credits_added INTEGER, error_message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_existing_payment RECORD;
  v_new_payment_id UUID;
  v_pack RECORD;
BEGIN
  SELECT * INTO v_existing_payment FROM payments WHERE provider = p_provider AND provider_ref = p_provider_ref;
  
  IF v_existing_payment IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_payment.id, FALSE, v_existing_payment.credits_granted, 'Payment already processed'::TEXT;
    RETURN;
  END IF;
  
  SELECT * INTO v_pack FROM credit_packs WHERE code = p_pack_code AND active = true;
  
  IF v_pack IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 0, 'Invalid pack code'::TEXT;
    RETURN;
  END IF;
  
  INSERT INTO payments (profile_id, provider, provider_ref, pack_code, amount_xof, credits_granted, status, phone_e164, raw_event, completed_at)
  VALUES (p_profile_id, p_provider, p_provider_ref, p_pack_code, p_amount_xof, v_pack.credits, 'succeeded', p_phone_e164, p_raw_event, NOW())
  RETURNING id INTO v_new_payment_id;
  
  INSERT INTO credit_ledger (profile_id, entry_type, amount, payment_id, idempotency_key, description)
  VALUES (p_profile_id, 'topup', v_pack.credits, v_new_payment_id, 'topup_' || p_provider::text || '_' || p_provider_ref, 'Credit pack purchase: ' || v_pack.name);
  
  RETURN QUERY SELECT v_new_payment_id, TRUE, v_pack.credits, NULL::TEXT;
END;
$$;

-- ============================================
-- 5. SEED DATA
-- ============================================

INSERT INTO credit_packs (code, name, description, credits, price_xof, display_order) VALUES
  ('PACK_5', 'Pack Starter', '5 photos professionnelles', 5, 1500, 1),
  ('PACK_10', 'Pack Standard', '10 photos professionnelles', 10, 2500, 2),
  ('PACK_30', 'Pack Pro', '30 photos professionnelles - Meilleur rapport qualité/prix', 30, 6000, 3);

INSERT INTO pricing_config (key, value, description) VALUES
  ('credits_per_job', '1', 'Number of credits deducted per job'),
  ('margin_alert_threshold', '0.2', 'Alert when margin falls below this percentage'),
  ('free_credits_on_signup', '2', 'Free credits given to new users'),
  ('max_jobs_per_minute', '10', 'Rate limit: max jobs per user per minute');

INSERT INTO model_routing (category, provider, model, fallback_provider, fallback_model) VALUES
  ('clothing', 'openrouter', 'anthropic/claude-3-haiku', 'openrouter', 'openai/gpt-4o-mini'),
  ('beauty', 'openrouter', 'anthropic/claude-3-haiku', 'openrouter', 'openai/gpt-4o-mini'),
  ('accessories', 'openrouter', 'anthropic/claude-3-haiku', 'openrouter', 'openai/gpt-4o-mini'),
  ('shoes', 'openrouter', 'anthropic/claude-3-haiku', 'openrouter', 'openai/gpt-4o-mini'),
  ('jewelry', 'openrouter', 'anthropic/claude-3-haiku', 'openrouter', 'openai/gpt-4o-mini'),
  ('bags', 'openrouter', 'anthropic/claude-3-haiku', 'openrouter', 'openai/gpt-4o-mini'),
  ('other', 'openrouter', 'anthropic/claude-3-haiku', 'openrouter', 'openai/gpt-4o-mini');

INSERT INTO prompt_profiles (style, name, prompt, negative_prompt, params_json) VALUES
  ('studio_white', 'Studio Blanc Pro', 
   'Professional product photography on pure white background, soft studio lighting, high-end commercial quality, clean and minimal',
   'shadows, colored background, busy background, low quality, blurry',
   '{"guidance_scale": 7.5, "num_inference_steps": 30}'),
  ('studio_gray', 'Studio Gris Élégant',
   'Professional product photography on neutral gray background, soft diffused lighting, elegant commercial style',
   'harsh shadows, colored background, busy background, low quality',
   '{"guidance_scale": 7.5, "num_inference_steps": 30}'),
  ('gradient_soft', 'Dégradé Doux',
   'Product photography with soft gradient background, professional lighting, modern aesthetic',
   'harsh colors, busy background, low quality',
   '{"guidance_scale": 7.0, "num_inference_steps": 25}');

-- ============================================
-- 6. RLS POLICIES
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_select_admin ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin', 'support_agent'))
);

CREATE POLICY jobs_select_own ON jobs FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY jobs_insert_own ON jobs FOR INSERT WITH CHECK (profile_id = auth.uid());
CREATE POLICY jobs_select_admin ON jobs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin', 'support_agent'))
);

CREATE POLICY assets_select_own ON assets FOR SELECT USING (owner_profile_id = auth.uid());
CREATE POLICY assets_insert_own ON assets FOR INSERT WITH CHECK (owner_profile_id = auth.uid());

CREATE POLICY credit_ledger_select_own ON credit_ledger FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY credit_ledger_select_admin ON credit_ledger FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin'))
);

CREATE POLICY payments_select_own ON payments FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY support_tickets_select_own ON support_tickets FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY support_tickets_insert_own ON support_tickets FOR INSERT WITH CHECK (profile_id = auth.uid());
CREATE POLICY support_tickets_select_support ON support_tickets FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin', 'support_agent'))
);

CREATE POLICY ticket_messages_select_own ON ticket_messages FOR SELECT USING (
  NOT is_internal AND EXISTS (SELECT 1 FROM support_tickets t WHERE t.id = ticket_id AND t.profile_id = auth.uid())
);
CREATE POLICY ticket_messages_insert_own ON ticket_messages FOR INSERT WITH CHECK (
  sender_profile_id = auth.uid() AND EXISTS (SELECT 1 FROM support_tickets t WHERE t.id = ticket_id AND t.profile_id = auth.uid())
);
CREATE POLICY ticket_messages_select_support ON ticket_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin', 'support_agent'))
);

-- Done!
