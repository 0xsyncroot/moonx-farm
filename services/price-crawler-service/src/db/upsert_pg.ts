import { pool } from "./pgdb";

// Upsert token theo contract (primary key)
export async function upsertTokenPg(token: {
  contract: string;
  token_type?: string; // 'top', 'trending'
  name?: string;
  symbol: string;
  decimals?: number | null;
  logo_url?: string;
  contracts?: any; // JSONB
  socials?: any;   // JSONB
  tags?: any;      // JSONB
  description?: string;
  source?: string;
}) {
  const query = `
    INSERT INTO tokens (contract, token_type, name, symbol, decimals, logo_url, contracts, socials, tags, description, source, last_updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    ON CONFLICT (contract) DO UPDATE SET
      token_type = EXCLUDED.token_type,
      name = EXCLUDED.name,
      symbol = EXCLUDED.symbol,
      decimals = EXCLUDED.decimals,
      logo_url = EXCLUDED.logo_url,
      contracts = EXCLUDED.contracts,
      socials = EXCLUDED.socials,
      tags = EXCLUDED.tags,
      description = EXCLUDED.description,
      source = EXCLUDED.source,
      last_updated_at = NOW()
    RETURNING *;
  `;
  const params = [
    token.contract,
    token.token_type || null,
    token.name || null,
    token.symbol,
    token.decimals ?? null,
    token.logo_url || null,
    token.contracts ? JSON.stringify(token.contracts) : null,
    token.socials ? JSON.stringify(token.socials) : null,
    token.tags ? JSON.stringify(token.tags) : null,
    token.description || null,
    token.source || null
  ];
  const result = await pool.query(query, params);
  return result.rows[0];
}

// Upsert giá token theo contract + timestamp (unique)
export async function upsertTokenPricePg(price: {
  contract: string;
  token_type?: string; // 'top', 'trending'
  chain?: string;
  dex?: string;
  pair_address?: string;
  price_usd?: number | string;
  liquidity_usd?: number | string;
  volume_24h?: number | string;
  fdv?: number | string;
  pool_created_at?: number | null;
  pool_url?: string;
  markets?: any; // JSONB
  source?: string;
  timestamp?: string; // ISO string
}) {
  const query = `
    INSERT INTO token_prices (
      contract, token_type, chain, dex, pair_address, price_usd, liquidity_usd, volume_24h, fdv, pool_created_at, pool_url, markets, source, timestamp
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    ON CONFLICT (contract, timestamp) DO UPDATE SET
      token_type = EXCLUDED.token_type,
      chain = EXCLUDED.chain,
      dex = EXCLUDED.dex,
      pair_address = EXCLUDED.pair_address,
      price_usd = EXCLUDED.price_usd,
      liquidity_usd = EXCLUDED.liquidity_usd,
      volume_24h = EXCLUDED.volume_24h,
      fdv = EXCLUDED.fdv,
      pool_created_at = EXCLUDED.pool_created_at,
      pool_url = EXCLUDED.pool_url,
      markets = EXCLUDED.markets,
      source = EXCLUDED.source
    RETURNING *;
  `;
  const params = [
    price.contract,
    price.token_type || null,
    price.chain || null,
    price.dex || null,
    price.pair_address || null,
    price.price_usd ?? null,
    price.liquidity_usd ?? null,
    price.volume_24h ?? null,
    price.fdv ?? null,
    price.pool_created_at ?? null,
    price.pool_url || null,
    price.markets ? JSON.stringify(price.markets) : null,
    price.source || null,
    price.timestamp || new Date().toISOString()
  ];
  const result = await pool.query(query, params);
  return result.rows[0];
}

// Upsert audit theo contract (unique)
export async function upsertTokenAuditPg(audit: {
  contract: string;
  audit_score?: number | string;
  audit_provider?: string;
  is_verified?: boolean;
  report_url?: string;
  raw_audit_data?: any; // JSONB
}) {
  const query = `
    INSERT INTO token_audits (contract, audit_score, audit_provider, is_verified, report_url, raw_audit_data, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (contract) DO UPDATE SET
      audit_score = EXCLUDED.audit_score,
      audit_provider = EXCLUDED.audit_provider,
      is_verified = EXCLUDED.is_verified,
      report_url = EXCLUDED.report_url,
      raw_audit_data = EXCLUDED.raw_audit_data
    RETURNING *;
  `;
  const params = [
    audit.contract,
    audit.audit_score ?? null,
    audit.audit_provider || null,
    audit.is_verified ?? null,
    audit.report_url || null,
    audit.raw_audit_data ? JSON.stringify(audit.raw_audit_data) : null
  ];
  const result = await pool.query(query, params);
  return result.rows[0];
}
