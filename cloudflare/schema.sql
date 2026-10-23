CREATE TABLE IF NOT EXISTS pairing_codes (
  code_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS devices (
  token_hash TEXT PRIMARY KEY,
  subscription_cipher TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS reminders (
  device_hash TEXT NOT NULL,
  reminder_hash TEXT NOT NULL,
  category TEXT NOT NULL,
  route TEXT NOT NULL,
  send_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (device_hash, reminder_hash)
);
CREATE INDEX IF NOT EXISTS reminders_due ON reminders(status, send_at, lease_until);
CREATE TABLE IF NOT EXISTS deliveries (
  device_hash TEXT NOT NULL,
  reminder_hash TEXT NOT NULL,
  delivered_at INTEGER NOT NULL,
  PRIMARY KEY (device_hash, reminder_hash)
);
CREATE TABLE IF NOT EXISTS pairing_attempts (
  client_hash TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
