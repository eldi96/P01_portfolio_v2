CREATE TABLE IF NOT EXISTS t08_users (
  id text PRIMARY KEY, name text NOT NULL
);
CREATE TABLE IF NOT EXISTS t08_credentials (
  id text PRIMARY KEY, user_id text NOT NULL REFERENCES t08_users(id),
  public_key text NOT NULL, counter bigint NOT NULL DEFAULT 0,
  transports jsonb NOT NULL, name text NOT NULL,
  device_type text NOT NULL, backed_up boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS t08_credentials_user ON t08_credentials(user_id);
CREATE TABLE IF NOT EXISTS t08_sessions (
  token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES t08_users(id),
  credential_id text NOT NULL REFERENCES t08_credentials(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS t08_invitations (
  token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES t08_users(id),
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS t08_challenges (
  token_hash text PRIMARY KEY, challenge text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('register','login')),
  user_id text REFERENCES t08_users(id), invitation_hash text,
  session_hash text, key_name text, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS t08_private_items (
  id text PRIMARY KEY, user_id text NOT NULL REFERENCES t08_users(id),
  title text NOT NULL, body text NOT NULL
);
CREATE INDEX IF NOT EXISTS t08_private_user ON t08_private_items(user_id);
CREATE TABLE IF NOT EXISTS t08_rate_limits (
  bucket text PRIMARY KEY, attempts integer NOT NULL, expires_at timestamptz NOT NULL
);
