-- Changelog: Thiết kế lại schema lưu trữ token/profile/price/audit theo code mẫu get_top.js và trending_token_full_profile.js
-- Ngày tạo: 2025-06-29

-- Bảng lưu thông tin token/profile (multi-chain, socials, tags, mô tả, ...)
CREATE TABLE IF NOT EXISTS tokens (
  contract         VARCHAR(255) PRIMARY KEY, -- contract chính (ưu tiên chain mặc định)
  token_type       VARCHAR(20), -- 'top', 'trending', ...
  name             VARCHAR(255),
  symbol           VARCHAR(50) NOT NULL,
  decimals         INT,
  logo_url         TEXT,
  contracts        JSONB, -- mapping chain => contract address
  socials          JSONB, -- website, twitter, telegram, discord, github, whitepaper
  tags             JSONB,
  description      TEXT,
  source           VARCHAR(100),
  last_updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng lưu thông tin pool chính (mainPool) và giá hiện tại
CREATE TABLE IF NOT EXISTS token_prices (
  id               SERIAL PRIMARY KEY,
  contract         VARCHAR(255) REFERENCES tokens(contract),
  token_type       VARCHAR(20), -- 'top', 'trending', ...
  chain            VARCHAR(50),
  dex              VARCHAR(100),
  pair_address     VARCHAR(255),
  price_usd        NUMERIC(30, 10),
  liquidity_usd    NUMERIC(30, 10),
  volume_24h       NUMERIC(30, 10),
  fdv              NUMERIC(30, 10),
  pool_created_at  BIGINT, -- timestamp hoặc null
  pool_url         TEXT,
  markets          JSONB, -- list các pool/market khác (markets[])
  source           VARCHAR(100),
  timestamp        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (contract, timestamp)
);

-- Bảng lưu audit GoPlus Labs (raw audit data)
CREATE TABLE IF NOT EXISTS token_audits (
  id               SERIAL PRIMARY KEY,
  contract         VARCHAR(255) REFERENCES tokens(contract),
  audit_score      NUMERIC(5,2),
  audit_provider   VARCHAR(255),
  is_verified      BOOLEAN,
  report_url       TEXT,
  raw_audit_data   JSONB,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng log job (tùy chọn)
CREATE TABLE IF NOT EXISTS job_logs (
  id               SERIAL PRIMARY KEY,
  job_type         VARCHAR(50),
  token_type       VARCHAR(50),
  contract         VARCHAR(255),
  status           VARCHAR(20),
  message          TEXT,
  executed_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index đề xuất
CREATE INDEX IF NOT EXISTS idx_tokens_symbol ON tokens(symbol);
CREATE INDEX IF NOT EXISTS idx_prices_contract_time ON token_prices(contract, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audits_contract ON token_audits(contract);
CREATE INDEX IF NOT EXISTS idx_joblog_contract ON job_logs(contract);

-- END changelog v2
