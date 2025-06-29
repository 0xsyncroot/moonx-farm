import { getTokenProfileDexscreener } from "../fetcher/dexscreener.fetcher";
import { getTokenProfileGeckoTerminal } from "../fetcher/geckoterminal.fetcher";
import { getCoinProfileCoingecko } from "../fetcher/coingecko.fetcher";
import { getTokenAuditGoPlus } from "../fetcher/goplus.fetcher";
import { upsertTokenPg, upsertTokenPricePg, upsertTokenAuditPg } from "../db/upsert_pg";
import { pool, connectPgDb } from "../db/pgdb";

// Pipeline: fetch profile + audit, upsert vào DB, log thao tác
async function trendingProfileToDb(chain: string, address: string, coingeckoId?: string) {
  // 1. Fetch profile
  let profile = await getTokenProfileDexscreener(address);
  if (!profile) profile = await getTokenProfileGeckoTerminal(chain, address);
  if (!profile && coingeckoId) profile = await getCoinProfileCoingecko(coingeckoId);

  // 2. Fetch audit
  const audit = await getTokenAuditGoPlus(chain, address);

  // 3. Upsert token
  if (profile) {
    await upsertTokenPg({
      contract: address,
      symbol: profile.symbol,
      name: profile.name,
      chain_id: chain,
      decimals: profile.decimals,
      logo_url: profile.logoUrl,
      source: profile.source,
      is_stablecoin: false // TODO: logic nhận diện stablecoin
    });

    // 4. Upsert giá (mainPool)
    if (profile.mainPool && profile.mainPool.priceUsd) {
      await upsertTokenPricePg({
        contract: address,
        price_usdt: profile.mainPool.priceUsd,
        source: profile.source,
        timestamp: new Date().toISOString()
      });
    }
  }

  // 5. Upsert audit
  if (audit) {
    await upsertTokenAuditPg({
      contract: address,
      audit_score: audit.audit_score,
      audit_provider: "GoPlus Labs",
      is_verified: audit.is_verified,
      report_url: audit.report_url
    });
  }

  // 6. Log thao tác vào job_logs
  await pool.query(
    `INSERT INTO job_logs (job_type, token_type, contract, status, message) VALUES ($1, $2, $3, $4, $5)`,
    [
      "trending_profile",
      "trending",
      address,
      "success",
      `Upsert profile${audit ? " + audit" : ""} thành công`
    ]
  );
}

async function main() {
  await connectPgDb();
  const chain = "base";
  const address = "0x4200000000000000000000000000000000000006";
  const coingeckoId = "weth";
  await trendingProfileToDb(chain, address, coingeckoId);
  await pool.end();
  process.exit(0);
}

if (require.main === module) {
  main();
}
