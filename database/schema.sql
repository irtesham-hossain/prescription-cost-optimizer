-- Prescription Cost Optimizer: database tables
-- Run this once in Supabase: SQL Editor > New query > paste > Run

CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- fast fuzzy search on names

CREATE TABLE manufacturer (
    manufacturer_id  INT PRIMARY KEY,
    name             VARCHAR(150) NOT NULL,
    quality_tier     SMALLINT,
    size_class       VARCHAR(10)
);

CREATE TABLE generic (
    generic_id     INT PRIMARY KEY,
    generic_name   VARCHAR(255) NOT NULL,
    no_substitute  BOOLEAN DEFAULT FALSE,
    drug_class     VARCHAR(255)
);

CREATE TABLE equivalence_group (
    group_id     INT PRIMARY KEY,
    generic_id   INT REFERENCES generic(generic_id),
    strength     VARCHAR(100),
    dosage_form  VARCHAR(60)
);

CREATE TABLE brand (
    brand_id            INT PRIMARY KEY,
    brand_name          VARCHAR(150) NOT NULL,
    slug                VARCHAR(200) UNIQUE,
    manufacturer_id     INT REFERENCES manufacturer(manufacturer_id),
    group_id            INT REFERENCES equivalence_group(group_id),
    package_size        INT,
    dgda_registered     BOOLEAN DEFAULT TRUE,
    availability_score  DECIMAL(3,2) DEFAULT 1.0,
    needs_review        BOOLEAN DEFAULT FALSE
);

CREATE TABLE price_record (
    price_id       SERIAL PRIMARY KEY,
    brand_id       INT REFERENCES brand(brand_id),
    unit_price     DECIMAL(10,2),
    pack_price     DECIMAL(10,2),
    unit_label     VARCHAR(60),
    compare_price  DECIMAL(10,4),
    compare_unit   VARCHAR(60),
    source         VARCHAR(20) DEFAULT 'dataset',
    source_url     TEXT,
    fetched_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE scan_session (
    scan_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at    TIMESTAMP DEFAULT NOW(),
    status        VARCHAR(20) DEFAULT 'pending',
    total_saving  DECIMAL(10,2)
);

CREATE TABLE scan_item (
    item_id           SERIAL PRIMARY KEY,
    scan_id           UUID REFERENCES scan_session(scan_id) ON DELETE CASCADE,
    raw_text          TEXT,
    read_brand        VARCHAR(150),
    matched_brand_id  INT REFERENCES brand(brand_id),
    chosen_brand_id   INT REFERENCES brand(brand_id),
    confidence        DECIMAL(3,2),
    card_status       VARCHAR(10)
);

-- Indexes so searches stay fast
CREATE INDEX idx_brand_group ON brand(group_id);
CREATE INDEX idx_brand_name_trgm ON brand USING gin (brand_name gin_trgm_ops);
CREATE INDEX idx_price_brand ON price_record(brand_id, fetched_at DESC);
