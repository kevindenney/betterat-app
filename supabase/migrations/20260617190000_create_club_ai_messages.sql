-- =============================================================================
-- Migration: Create club_ai_messages table
-- Purpose: Durable per-member chat history for the Club AI Assistant.
--          ai_conversations is per-user coach data (messages jsonb, no club_id);
--          the club assistant needs a per-message, per-(club, member) thread.
-- =============================================================================

CREATE TABLE IF NOT EXISTS club_ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Not FK'd: the assistant's club id may be a clubs.id (legacy) or an
  -- organizations.id depending on how the caller resolved it.
  club_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_ai_messages_thread
  ON club_ai_messages (club_id, user_id, created_at);

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE club_ai_messages ENABLE ROW LEVEL SECURITY;

-- Members read only their own thread; the edge function writes via the service
-- role (bypasses RLS), so no INSERT policy is needed for the client.
CREATE POLICY "Members read own club AI thread"
  ON club_ai_messages
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

COMMENT ON TABLE club_ai_messages IS 'Per-(club, member) chat history for the Club AI Assistant (ai-club-support edge function).';
COMMENT ON COLUMN club_ai_messages.club_id IS 'clubs.id or organizations.id (caller-resolved); intentionally not FK-constrained.';
COMMENT ON COLUMN club_ai_messages.role IS 'user | assistant';
