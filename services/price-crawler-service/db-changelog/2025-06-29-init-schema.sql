-- Changelog: Khởi tạo schema các bảng chính cho price-crawler-service
-- Ngày tạo: 2025-06-29

-- Bảng metadata token
CREATE TABLE IF NOT EXISTS tokens (
  contract         VARCHAR(255) PRIMARY KEY,
  symbol           VARCHAR(50) NOT NULL,
  name             VARCHAR(255),
  chain_id         VARCHAR(50),
  decimals         INT,
  logo_url         TEXT,
  source           VARCHAR(100),
  is_stablecoin    BOOLEAN DEFAULT FALSE,
  last_updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng theo dõi giá token
CREATE TABLE IF NOT EXISTS token_prices (
  id               SERIAL PRIMARY KEY,
  contract         VARCHAR(255) REFERENCES tokens(contract),
  price_usdt       NUMERIC(30, 10) NOT NULL,
  source           VARCHAR(100),
  timestamp        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (contract, timestamp)
);

-- Bảng audit token trending
CREATE TABLE IF NOT EXISTS token_audits (
  id               SERIAL PRIMARY KEY,
  contract         VARCHAR(255) REFERENCES tokens(contract),
  audit_score      NUMERIC(5,2),
  audit_provider   VARCHAR(255),
  is_verified      BOOLEAN,
  report_url       TEXT,
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

-- END changelog
