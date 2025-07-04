
import { upsertTokenPg, upsertTokenPricePg } from "../db/upsert_pg";
import { pool, connectPgDb } from "../db/pgdb";
import { JobMessage } from "../types/job_message";
import { JobType } from "../models/index";

// Hàm nhận diện stablecoin đơn giản (có thể mở rộng)
function isStablecoin(symbol: string): boolean {
  const stablecoins = ["USDT", "USDC", "DAI", "WETH", "TUSD", "BUSD"];
  return stablecoins.includes(symbol?.toUpperCase());
}

// Xử lý từng loại job cho top token
export async function handleTopJob(msg: JobMessage, profile?: any) {
  const { job_type, token_type, address, symbol, coingeckoId, timestamp } = msg;
  
  if (!profile) {
    await pool.query(
      `INSERT INTO job_logs (job_type, token_type, contract, status, message) VALUES ($1, $2, $3, $4, $5)`,
      [job_type, token_type, "", "fail", "Không tìm thấy profile top token"]
    );
    return;
  }

  // Loại trừ stablecoin
  if (isStablecoin(profile.symbol)) {
    await pool.query(
      `INSERT INTO job_logs (job_type, token_type, contract, status, message) VALUES ($1, $2, $3, $4, $5)`,
      [job_type, token_type || "top", address, "skip", "Stablecoin bị loại trừ"]
    );
    return;
  }

  // Upsert metadata
  if (job_type === JobType.METADATA) {
    await upsertTokenPg({
      contract: address,
      token_type: token_type || "top",
      symbol: profile.symbol,
      name: profile.name,
      decimals: profile.decimals,
      logo_url: profile.logoUrl,
      contracts: profile.contracts,
      socials: profile.socials,
      tags: profile.tags,
      description: profile.description,
      source: profile.source
    });
    await pool.query(
      `INSERT INTO job_logs (job_type, token_type, contract, status, message) VALUES ($1, $2, $3, $4, $5)`,
      [job_type, token_type || "top", address, "success", "Upsert metadata top token thành công"]
    );
  }
  // Upsert price
  if (job_type === JobType.PRICE && profile.mainPool && profile.mainPool.priceUsd) {
    await upsertTokenPricePg({
      contract: address,
      token_type: token_type,
      chain: profile.mainPool.chain,
      dex: profile.mainPool.dex,
      pair_address: profile.mainPool.pairAddress,
      price_usd: profile.mainPool.priceUsd,
      liquidity_usd: profile.mainPool.liquidityUsd,
      volume_24h: profile.mainPool.volume24h,
      fdv: profile.mainPool.fdv,
      pool_created_at: typeof profile.mainPool.createdAt === "number"
        ? profile.mainPool.createdAt
        : (typeof profile.mainPool.createdAt === "string"
            ? Number(profile.mainPool.createdAt) || null
            : null),
      pool_url: profile.mainPool.url,
      markets: profile.markets,
      source: profile.source,
      timestamp: timestamp || new Date().toISOString()
    });
    await pool.query(
      `INSERT INTO job_logs (job_type, token_type, contract, status, message) VALUES ($1, $2, $3, $4, $5)`,
      [job_type, token_type, address, "success", "Upsert price top token thành công"]
    );
  }
}

