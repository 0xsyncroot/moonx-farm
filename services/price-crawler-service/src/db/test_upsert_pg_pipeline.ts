import { pool, connectPgDb } from "./pgdb";
import { upsertTokenPg, upsertTokenPricePg, upsertTokenAuditPg } from "./upsert_pg";

// Dữ liệu mẫu test
const token = {
  contract: "0x4200000000000000000000000000000000000006",
  symbol: "WETH",
  name: "Wrapped Ether",
  chain_id: "base",
  decimals: 18,
  logo_url: "https://dd.dexscreener.com/ds-data/tokens/base/0x4200000000000000000000000000000000000006.png",
  source: "dexscreener",
  is_stablecoin: false
};

const price = {
  contract: "0x4200000000000000000000000000000000000006",
  price_usdt: 2432.88,
  source: "dexscreener",
  timestamp: new Date().toISOString()
};

const audit = {
  contract: "0x4200000000000000000000000000000000000006",
  audit_score: 95.5,
  audit_provider: "GoPlus Labs",
  is_verified: true,
  report_url: "https://gopluslabs.io/report/0x4200000000000000000000000000000000000006"
};

async function testPipeline() {
  await connectPgDb();

  console.log("Upsert token...");
  const tokenRow = await upsertTokenPg(token);
  console.log(tokenRow);

  console.log("Upsert price...");
  const priceRow = await upsertTokenPricePg(price);
  console.log(priceRow);

  console.log("Upsert audit...");
  const auditRow = await upsertTokenAuditPg(audit);
  console.log(auditRow);

  await pool.end();
  process.exit(0);
}

if (require.main === module) {
  testPipeline();
}
