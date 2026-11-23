-- Prescription Cost Optimizer: database update v3 (login and saved prescriptions)
-- Run once in Supabase: SQL Editor > New query > paste > Run
-- Safe to run more than once, and safe whether or not update_v2.sql was run.

-- Columns for saved prescriptions
ALTER TABLE scan_session ADD COLUMN IF NOT EXISTS device_id  TEXT;
ALTER TABLE scan_session ADD COLUMN IF NOT EXISTS title      TEXT;    -- medicine names
ALTER TABLE scan_session ADD COLUMN IF NOT EXISTS label      TEXT;    -- name the user gives it
ALTER TABLE scan_session ADD COLUMN IF NOT EXISTS medicines  JSONB;
ALTER TABLE scan_session ADD COLUMN IF NOT EXISTS results    JSONB;

-- Each saved prescription belongs to a logged-in user (Supabase Auth)
ALTER TABLE scan_session ADD COLUMN IF NOT EXISTS user_id UUID
    REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_scan_session_user ON scan_session(user_id, created_at DESC);

-- Sponsored pharmacies (from v2, in case it was not run)
CREATE TABLE IF NOT EXISTS featured_pharmacy (
    pharmacy_id  SERIAL PRIMARY KEY,
    name         VARCHAR(150) NOT NULL,
    address      TEXT,
    phone        VARCHAR(30),
    latitude     DECIMAL(9,6),
    longitude    DECIMAL(9,6),
    active       BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT NOW()
);

-- Block Supabase's public REST API from reading the tables directly.
-- The FastAPI backend connects as the database owner, so it still works.
ALTER TABLE manufacturer       ENABLE ROW LEVEL SECURITY;
ALTER TABLE generic            ENABLE ROW LEVEL SECURITY;
ALTER TABLE equivalence_group  ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand              ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_record       ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_session       ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_item          ENABLE ROW LEVEL SECURITY;
ALTER TABLE featured_pharmacy  ENABLE ROW LEVEL SECURITY;
