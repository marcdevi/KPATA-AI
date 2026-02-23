-- ============================================
-- Migration: Add pending_approval to profile_status enum
-- ============================================
-- New users who register via email will have status 'pending_approval'
-- until an admin approves them from the dashboard.

ALTER TYPE profile_status ADD VALUE IF NOT EXISTS 'pending_approval';
