-- Prescription Cost Optimizer: database update v2
-- Run once in Supabase: SQL Editor > New query > paste > Run
-- Safe to run on the existing database: it only adds, it deletes nothing.

-- 1. Saved prescriptions (no login yet: each phone has an anonymous device_id)
ALTER TABLE scan_session ADD COLUMN IF NOT EXISTS device_id   TEXT;
ALTER TABLE scan_session ADD COLUMN IF NOT EXISTS title       TEXT;    -- medicine names
ALTER TABLE scan_session ADD COLUMN IF NOT EXISTS label       TEXT;    -- name the user gives it
ALTER TABLE scan_session ADD COLUMN IF NOT EXISTS medicines   JSONB;   -- what the user confirmed
ALTER TABLE scan_session ADD COLUMN IF NOT EXISTS results     JSONB;   -- the alternatives shown
CREATE INDEX IF NOT EXISTS idx_scan_session_device ON scan_session(device_id, created_at DESC);

-- 2. Featured (sponsored) pharmacies: the advertising part of the business model
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

-- 3. Block Supabase's public REST API from reading these tables directly.
--    Our FastAPI backend connects as the database owner, so it still works.
ALTER TABLE manufacturer       ENABLE ROW LEVEL SECURITY;
ALTER TABLE generic            ENABLE ROW LEVEL SECURITY;
ALTER TABLE equivalence_group  ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand              ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_record       ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_session       ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_item          ENABLE ROW LEVEL SECURITY;
ALTER TABLE featured_pharmacy  ENABLE ROW LEVEL SECURITY;
