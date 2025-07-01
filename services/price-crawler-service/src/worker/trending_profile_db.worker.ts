import { TrendingTokenFetcher } from "../fetchers/trendingTokenFetcher";
import { getTokenAuditGoPlus } from "../fetcher/goplus.fetcher";
import { upsertTokenPg, upsertTokenPricePg, upsertTokenAuditPg } from "../db/upsert_pg";
import { pool, connectPgDb } from "../db/pgdb";
import { JobMessage } from "../types/job_message";
import { logger } from "../../../../packages/common/src/logger";

// Hàm nhận diện stablecoin đơn giản (có thể mở rộng)
function isStablecoin(symbol: string): boolean {
  const stablecoins = ["USDT", "USDC", "DAI", "WETH", "TUSD", "BUSD"];
  return stablecoins.includes(symbol?.toUpperCase());
}

// Xử lý từng loại job cho trending token
export async function handleTrendingJob(msg: JobMessage) {
  const { job_type, chain, address, coingeckoId, symbol } = msg;
  let profile = null;
  let audit = null;
  const trendingTokenFetcher = new TrendingTokenFetcher();

  // Metadata & Price đều cần fetch profile
  if (job_type === "metadata" || job_type === "price") {
    profile = await trendingTokenFetcher.getTokenProfile(chain, address);

    logger.info("HandleTrendingJob - Start",{ job_type, token_type: "trending", address, step: "fetch_profile", status: !!profile });
    
    if (!profile) {
      await pool.query(
        `INSERT INTO job_logs (job_type, token_type, contract, status, message) VALUES ($1, $2, $3, $4, $5)`,
        [job_type, "trending", address, "fail", "Không fetch được profile"]
      );
      logger.error("HandleTrendingJob - Not Found Profile",{ job_type, token_type: "trending", address, error: "Không fetch được profile" });
      return;
    }

    // Loại trừ stablecoin
    if (isStablecoin(profile.symbol)) {
      await pool.query(
        `INSERT INTO job_logs (job_type, token_type, contract, status, message) VALUES ($1, $2, $3, $4, $5)`,
        [job_type, "trending", address, "skip", "Stablecoin bị loại trừ"]
      );
      return;
    }

    // Upsert metadata
    if (job_type === "metadata") {
      await upsertTokenPg({
        contract: address,
        token_type: "trending",
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
        [job_type, "trending", address, "success", "Upsert metadata thành công"]
      );
    }

    // Upsert price
    if (job_type === "price" && profile.mainPool && profile.mainPool.priceUsd) {
      await upsertTokenPricePg({
        contract: address,
        token_type: "trending",
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
        timestamp: msg.timestamp || new Date().toISOString()
      });
      await pool.query(
        `INSERT INTO job_logs (job_type, token_type, contract, status, message) VALUES ($1, $2, $3, $4, $5)`,
        [job_type, "trending", address, "success", "Upsert price thành công"]
      );
    }
  }

  // Audit job: chỉ chạy sau khi đã có metadata & price
  if (job_type === "audit") {
    // Kiểm tra đã có metadata & price chưa
    const metaRes = await pool.query(
      `SELECT contract FROM tokens WHERE contract = $1`, [address]
    );
    const priceRes = await pool.query(
      `SELECT contract FROM token_prices WHERE contract = $1`, [address]
    );
    if (metaRes.rowCount === 0 || priceRes.rowCount === 0) {
      await pool.query(
        `INSERT INTO job_logs (job_type, token_type, contract, status, message) VALUES ($1, $2, $3, $4, $5)`,
        [job_type, "trending", address, "wait", "Chưa có metadata/price, delay audit"]
      );
      return;
    }
    
    audit = await trendingTokenFetcher.getTokenAudit(chain, address);

    if (audit) {
      await upsertTokenAuditPg({
        contract: address,
        audit_score: audit.audit_score,
        audit_provider: "GoPlus Labs",
        is_verified: audit.is_verified,
        report_url: audit.report_url
      });
      await pool.query(
        `INSERT INTO job_logs (job_type, token_type, contract, status, message) VALUES ($1, $2, $3, $4, $5)`,
        [job_type, "trending", address, "success", "Upsert audit thành công"]
      );
    } else {
      await pool.query(
        `INSERT INTO job_logs (job_type, token_type, contract, status, message) VALUES ($1, $2, $3, $4, $5)`,
        [job_type, "trending", address, "fail", "Không fetch được audit"]
      );
    }
  }
  
  logger.info("HandleTrendingJob - End",{ job_type, token_type: "trending", address, step: "fetch_profile", status: !!profile });
}

// 