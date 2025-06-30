// Script test end-to-end pipeline trending: gửi message mock, gọi worker, kiểm tra DB/logs

import { connectPgDb, pool } from "../src/db/pgdb";
import { handleTrendingJob } from "../src/worker/trending_profile_db.worker";
import { JobMessage } from "../src/types/job_message";

async function testTrendingPipeline() {
  await connectPgDb();

  // Test metadata
  const metaMsg: JobMessage = {
    job_type: "metadata",
    token_type: "trending",
    chain: "base",
    address: "0x4200000000000000000000000000000000000006",
    coingeckoId: "weth",
    timestamp: new Date().toISOString()
  };
  await handleTrendingJob(metaMsg);

  // Test price
  const priceMsg: JobMessage = {
    ...metaMsg,
    job_type: "price"
  };
  await handleTrendingJob(priceMsg);

  // Test audit (chỉ chạy sau khi đã có metadata/price)
  const auditMsg: JobMessage = {
    ...metaMsg,
    job_type: "audit"
  };
  await handleTrendingJob(auditMsg);

  // Kiểm tra kết quả DB
  const token = await pool.query("SELECT * FROM tokens WHERE contract = $1", [metaMsg.address]);
  const price = await pool.query("SELECT * FROM token_prices WHERE contract = $1", [metaMsg.address]);
  const audit = await pool.query("SELECT * FROM token_audits WHERE contract = $1", [metaMsg.address]);
  const logs = await pool.query("SELECT * FROM job_logs WHERE contract = $1", [metaMsg.address]);

  console.log("Token:", token.rows[0]);
  console.log("Price:", price.rows[0]);
  console.log("Audit:", audit.rows[0]);
  console.log("Job Logs:", logs.rows);

  await pool.end();
}

if (require.main === module) {
  testTrendingPipeline().catch(console.error);
}
