import { getTopCoinProfiles } from "../fetcher/coingecko.fetcher";
import { upsertTokenPg, upsertTokenPricePg } from "../db/upsert_pg";
import { pool, connectPgDb } from "../db/pgdb";

// Pipeline chính: fetch top N token, upsert vào DB, log thao tác
async function topTokensToDb(limit = 10) {
  const profiles = await getTopCoinProfiles(limit);

  for (const profile of profiles) {
    // Upsert token
    await upsertTokenPg({
      contract: Object.values(profile.contracts)[0] || "", // Ưu tiên contract đầu tiên
      symbol: profile.symbol,
      name: profile.name,
      chain_id: Object.keys(profile.contracts)[0] || "",
      decimals: profile.decimals,
      logo_url: profile.logoUrl,
      source: profile.source,
      is_stablecoin: false // TODO: logic nhận diện stablecoin
    });

    // Upsert giá (mainPool)
    if (profile.mainPool && profile.mainPool.priceUsd) {
      await upsertTokenPricePg({
        contract: Object.values(profile.contracts)[0] || "",
        price_usdt: profile.mainPool.priceUsd,
        source: profile.source,
        timestamp: new Date().toISOString()
      });
    }

    // Log thao tác vào job_logs
    await pool.query(
      `INSERT INTO job_logs (job_type, token_type, contract, status, message) VALUES ($1, $2, $3, $4, $5)`,
      [
        "top_profile",
        "top",
        Object.values(profile.contracts)[0] || "",
        "success",
        `Upsert top token profile thành công`
      ]
    );
  }
}

async function main() {
  await connectPgDb();
  await topTokensToDb(5);
  await pool.end();
  process.exit(0);
}

if (require.main === module) {
  main();
}
