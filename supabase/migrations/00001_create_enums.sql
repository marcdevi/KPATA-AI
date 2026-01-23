-- Migration: Create all enums for KPATA AI
-- Description: User roles, job statuses, and related enums

 /*
  NOTE:
  This project has a single-source-of-truth combined migration in:
    supabase/migrations/00000_combined.sql
  The remote DB already applied 00000, so running 00001..00011 would duplicate objects.
  This file is intentionally a NO-OP and kept for reference only.
 */

 /*
-- User roles enum
CREATE TYPE user_role AS ENUM (
  'user_free',
  'user_pro',
  'reseller',
  'support_agent',
  'admin',
  'super_admin'
);

-- Profile status enum
CREATE TYPE profile_status AS ENUM (
  'active',
  'banned',
  'deleting',
  'deleted'
);

-- Job status enum
CREATE TYPE job_status AS ENUM (
  'pending',
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled'
);

-- Background style enum
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

-- Template layout enum
CREATE TYPE template_layout AS ENUM (
  'square_1x1',
  'portrait_4x5',
  'story_9x16',
  'landscape_16x9',
  'carousel'
);

-- Job category enum
CREATE TYPE job_category AS ENUM (
  'clothing',
  'beauty',
  'accessories',
  'shoes',
  'jewelry',
  'bags',
  'other'
);

-- Mannequin mode enum
CREATE TYPE mannequin_mode AS ENUM (
  'none',
  'ghost_mannequin',
  'virtual_model_female',
  'virtual_model_male',
  'flat_lay'
);

-- Source channel enum (where the job request came from)
CREATE TYPE source_channel AS ENUM (
  'mobile_app',
  'telegram_bot',
  'whatsapp_bot',
  'web_app',
  'api'
);

-- Credit ledger entry type enum
CREATE TYPE ledger_entry_type AS ENUM (
  'topup',
  'debit_job',
  'refund_job',
  'bonus',
  'admin_adjustment'
);

-- Payment status enum
CREATE TYPE payment_status AS ENUM (
  'pending',
  'succeeded',
  'failed',
  'canceled'
);

-- Payment provider enum
CREATE TYPE payment_provider AS ENUM (
  'orange_money',
  'mtn_money',
  'wave',
  'moov_money'
);

-- Asset type enum
CREATE TYPE asset_type AS ENUM (
  'input_image',
  'output_image',
  'thumbnail'
);

-- Ticket status enum
CREATE TYPE ticket_status AS ENUM (
  'open',
  'in_progress',
  'waiting_customer',
  'resolved',
  'closed'
);

-- Ticket priority enum
CREATE TYPE ticket_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);
 */
