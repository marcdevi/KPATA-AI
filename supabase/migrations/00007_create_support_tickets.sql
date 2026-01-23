-- Migration: Create support tickets and messages
-- Description: Customer support ticket system

 /*
  NOTE:
  Schema already applied via supabase/migrations/00000_combined.sql.
  This migration is intentionally kept as a NO-OP to avoid duplicate object errors.
 */

 /*
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Ticket info
  subject VARCHAR(255) NOT NULL,
  status ticket_status NOT NULL DEFAULT 'open',
  priority ticket_priority NOT NULL DEFAULT 'medium',
  
  -- Assignment
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Related entities
  related_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  related_payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  
  -- Timestamps
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for support_tickets
CREATE INDEX idx_support_tickets_profile_id ON support_tickets (profile_id);
CREATE INDEX idx_support_tickets_status ON support_tickets (status);
CREATE INDEX idx_support_tickets_assigned_to ON support_tickets (assigned_to);
CREATE INDEX idx_support_tickets_last_message_at ON support_tickets (last_message_at DESC);
CREATE INDEX idx_support_tickets_created_at ON support_tickets (created_at DESC);
CREATE INDEX idx_support_tickets_priority_status ON support_tickets (priority, status);

-- Updated_at trigger
CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Ticket messages table
CREATE TABLE ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Message content
  content TEXT NOT NULL,
  
  -- Attachments (references to assets)
  attachments UUID[] DEFAULT '{}',
  
  -- Internal note (not visible to customer)
  is_internal BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for ticket_messages
CREATE INDEX idx_ticket_messages_ticket_id ON ticket_messages (ticket_id);
CREATE INDEX idx_ticket_messages_sender_profile_id ON ticket_messages (sender_profile_id);
CREATE INDEX idx_ticket_messages_created_at ON ticket_messages (created_at DESC);
CREATE INDEX idx_ticket_messages_ticket_created ON ticket_messages (ticket_id, created_at DESC);

-- Trigger to update last_message_at on support_tickets
CREATE OR REPLACE FUNCTION update_ticket_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE support_tickets 
  SET last_message_at = NEW.created_at
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ticket_messages_update_last_message
  AFTER INSERT ON ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_last_message_at();

COMMENT ON TABLE support_tickets IS 'Customer support tickets';
COMMENT ON TABLE ticket_messages IS 'Messages within support tickets';
COMMENT ON COLUMN ticket_messages.is_internal IS 'Internal notes not visible to customers';
 */
