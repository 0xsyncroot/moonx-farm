import { pool } from "./pgdb";

// Upsert token theo contract (primary key)
export async function upsertTokenPg(token: {
  contract: string;
  symbol: string;
  name?: string;
  chain_id?: string;
  decimals?: number;
  logo_url?: string;
  source?: string;
  is_stablecoin?: boolean;
}) {
  const query = `
    INSERT INTO tokens (contract, symbol, name, chain_id, decimals, logo_url, source, is_stablecoin, last_updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (contract) DO UPDATE SET
      symbol = EXCLUDED.symbol,
      name = EXCLUDED.name,
      chain_id = EXCLUDED.chain_id,
      decimals = EXCLUDED.decimals,
      logo_url = EXCLUDED.logo_url,
      source = EXCLUDED.source,
      is_stablecoin = EXCLUDED.is_stablecoin,
      last_updated_at = NOW()
    RETURNING *;
  `;
  const params = [
    token.contract,
    token.symbol,
    token.name || null,
    token.chain_id || null,
    token.decimals ?? null,
    token.logo_url || null,
    token.source || null,
    token.is_stablecoin ?? false
  ];
  const result = await pool.query(query, params);
  return result.rows[0];
}

// Upsert giá token theo contract + timestamp (unique)
export async function upsertTokenPricePg(price: {
  contract: string;
  price_usdt: number | string;
  source?: string;
  timestamp?: string; // ISO string
}) {
  const query = `
    INSERT INTO token_prices (contract, price_usdt, source, timestamp)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (contract, timestamp) DO UPDATE SET
      price_usdt = EXCLUDED.price_usdt,
      source = EXCLUDED.source
    RETURNING *;
  `;
  const params = [
    price.contract,
    price.price_usdt,
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
}) {
  const query = `
    INSERT INTO token_audits (contract, audit_score, audit_provider, is_verified, report_url, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (contract) DO UPDATE SET
      audit_score = EXCLUDED.audit_score,
      audit_provider = EXCLUDED.audit_provider,
      is_verified = EXCLUDED.is_verified,
      report_url = EXCLUDED.report_url
    RETURNING *;
  `;
  const params = [
    audit.contract,
    audit.audit_score ?? null,
    audit.audit_provider || null,
    audit.is_verified ?? null,
    audit.report_url || null
  ];
  const result = await pool.query(query, params);
  return result.rows[0];
}
