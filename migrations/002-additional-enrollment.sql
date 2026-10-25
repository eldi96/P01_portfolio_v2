-- Existing first-enrollment invitations retain a NULL issuer_session_hash.
-- Additional-key invitations are bound to the session that approved them.
ALTER TABLE t08_invitations ADD COLUMN IF NOT EXISTS issuer_session_hash text
  REFERENCES t08_sessions(token_hash) ON DELETE CASCADE;
