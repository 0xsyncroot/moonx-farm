import { getTopCoinProfiles } from "../fetcher/coingecko.fetcher";
import { upsertTokenPg, upsertTokenPricePg } from "../db/upsert_pg";
import { pool, connectPgDb } from "../db/pgdb";
import { JobMessage } from "../types/job_message";

// Hàm nhận diện stablecoin đơn giản (có thể mở rộng)
function isStablecoin(symbol: string): boolean {
  const stablecoins = ["USDT", "USDC", "DAI", "WETH", "TUSD", "BUSD"];
  return stablecoins.includes(symbol?.toUpperCase());
}

// Xử lý từng loại job cho top token
async function handleTopJob(msg: JobMessage) {
  const { job_type, address, symbol, coingeckoId, timestamp } = msg;
  // Lấy profile top token từ coingecko
  const profiles = await getTopCoinProfiles(100);
  // Tìm profile theo address (ưu tiên contract đầu tiên)
  const profile = profiles.find(p =>
    Object.values(p.contracts).some((c: string) => c.toLowerCase() === address.toLowerCase())
  );
  if (!profile) {
    await pool.query(
      `INSERT INTO job_logs (job_type, token_type, contract, status, message) VALUES ($1, $2, $3, $4, $5)`,
      [job_type, "top", address, "fail", "Không tìm thấy profile top token"]
    );
    return;
  }
  // Loại trừ stablecoin
  if (isStablecoin(profile.symbol)) {
    await pool.query(
      `INSERT INTO job_logs (job_type, token_type, contract, status, message) VALUES ($1, $2, $3, $4, $5)`,
      [job_type, "top", address, "skip", "Stablecoin bị loại trừ"]
    );
    return;
  }
  // Upsert metadata
  if (job_type === "metadata") {
    await upsertTokenPg({
      contract: address,
      token_type: "top",
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
      [job_type, "top", address, "success", "Upsert metadata top token thành công"]
    );
  }
  // Upsert price
  if (job_type === "price" && profile.mainPool && profile.mainPool.priceUsd) {
    await upsertTokenPricePg({
      contract: address,
      token_type: "top",
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
      [job_type, "top", address, "success", "Upsert price top token thành công"]
    );
  }
}

async function main() {
  await connectPgDb();
  // Test message mẫu
  const testMsg: JobMessage = {
    job_type: "metadata",
    token_type: "top",
    chain: "ethereum",
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    coingeckoId: "weth",
    timestamp: new Date().toISOString()
  };
  await handleTopJob(testMsg);
  await pool.end();
  process.exit(0);
}

if (require.main === module) {
  main();
}
