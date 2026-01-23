-- Migration: Create runtime configuration tables
-- Description: AI model routing, prompts, and pricing configuration

 /*
  NOTE:
  Schema already applied via supabase/migrations/00000_combined.sql.
  This migration is intentionally kept as a NO-OP to avoid duplicate object errors.
 */

 /*
-- Model routing configuration (per category)
CREATE TABLE model_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category job_category NOT NULL,
  
  -- Primary model
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  
  -- Fallback model
  fallback_provider VARCHAR(50),
  fallback_model VARCHAR(100),
  
  -- Configuration
  priority INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  
  -- Status
  active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT model_routing_category_unique UNIQUE (category)
);

-- Index
CREATE INDEX idx_model_routing_active ON model_routing (active) WHERE active = true;

-- Updated_at trigger
CREATE TRIGGER model_routing_updated_at
  BEFORE UPDATE ON model_routing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Prompt profiles (per style)
CREATE TABLE prompt_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identifier
  style background_style NOT NULL,
  name VARCHAR(100) NOT NULL,
  
  -- Prompts
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  
  -- Model parameters
  params_json JSONB NOT NULL DEFAULT '{}',
  
  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique active prompt per style
CREATE UNIQUE INDEX idx_prompt_profiles_active_style 
  ON prompt_profiles (style) 
  WHERE active = true;

-- Updated_at trigger
CREATE TRIGGER prompt_profiles_updated_at
  BEFORE UPDATE ON prompt_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Pricing configuration
CREATE TABLE pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT pricing_config_key_unique UNIQUE (key)
);

-- Updated_at trigger
CREATE TRIGGER pricing_config_updated_at
  BEFORE UPDATE ON pricing_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed default pricing config
INSERT INTO pricing_config (key, value, description) VALUES
  ('credits_per_job', '1', 'Number of credits deducted per job'),
  ('margin_alert_threshold', '0.2', 'Alert when margin falls below this percentage'),
  ('free_credits_on_signup', '2', 'Free credits given to new users'),
  ('max_jobs_per_minute', '10', 'Rate limit: max jobs per user per minute');

-- Seed default model routing
INSERT INTO model_routing (category, provider, model, fallback_provider, fallback_model) VALUES
  ('clothing', 'openrouter', 'anthropic/claude-3-haiku', 'openrouter', 'openai/gpt-4o-mini'),
  ('beauty', 'openrouter', 'anthropic/claude-3-haiku', 'openrouter', 'openai/gpt-4o-mini'),
  ('accessories', 'openrouter', 'anthropic/claude-3-haiku', 'openrouter', 'openai/gpt-4o-mini'),
  ('shoes', 'openrouter', 'anthropic/claude-3-haiku', 'openrouter', 'openai/gpt-4o-mini'),
  ('jewelry', 'openrouter', 'anthropic/claude-3-haiku', 'openrouter', 'openai/gpt-4o-mini'),
  ('bags', 'openrouter', 'anthropic/claude-3-haiku', 'openrouter', 'openai/gpt-4o-mini'),
  ('other', 'openrouter', 'anthropic/claude-3-haiku', 'openrouter', 'openai/gpt-4o-mini');

-- Seed default prompt profiles
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

COMMENT ON TABLE model_routing IS 'AI model routing configuration per job category';
COMMENT ON TABLE prompt_profiles IS 'Prompt templates for different background styles';
COMMENT ON TABLE pricing_config IS 'Runtime pricing and business configuration';
 */
