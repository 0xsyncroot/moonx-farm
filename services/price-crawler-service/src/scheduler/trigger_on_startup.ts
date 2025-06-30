// Trigger all jobs on service startup (run once)
// Đảm bảo gửi metadata trước, sau đó price, cuối cùng audit (trending)

import { KafkaProducer } from "../kafka/producer";
import { getTopCoinProfiles } from "../fetcher/coingecko.fetcher";
/**
 * Hàm mock trending tokens cho mục đích trigger startup.
 * Thực tế có thể lấy từ DB, API hoặc config.
 */
function mockTrendingTokens() {
  return [
    {
      chain: "base",
      address: "0x4200000000000000000000000000000000000006",
      symbol: "WETH",
      coingeckoId: "weth"
    },
    // Thêm các token trending khác nếu cần
  ];
}
import { JobMessage } from "../types/job_message";

// Gửi job metadata và price cho top token
export async function triggerTopJobsOnStartup(producer: KafkaProducer) {
  const topProfiles = await getTopCoinProfiles(100);
  for (const profile of topProfiles) {
    const address = Object.values(profile.contracts)[0] || "";
    if (!address) continue;
    // Metadata
    await producer.send("price-crawler.metadata.request", {
      job_type: "metadata",
      token_type: "top",
      chain: profile.mainPool?.chain || "ethereum",
      address,
      symbol: profile.symbol,
      // Không có coingeckoId cho top token profile
      timestamp: new Date().toISOString()
    } as JobMessage);
    // Price
    await producer.send("price-crawler.price.request", {
      job_type: "price",
      token_type: "top",
      chain: profile.mainPool?.chain || "ethereum",
      address,
      symbol: profile.symbol,
      // Không có coingeckoId cho top token profile
      timestamp: new Date().toISOString()
    } as JobMessage);
  }
}

// Gửi job metadata, price, audit cho trending token (đảm bảo thứ tự)
export async function triggerTrendingJobsOnStartup(producer: KafkaProducer) {
  const trending = mockTrendingTokens();
  for (const token of trending) {
    // Metadata
    await producer.send("price-crawler.metadata.request", {
      job_type: "metadata",
      token_type: "trending",
      chain: token.chain,
      address: token.address,
      symbol: token.symbol,
      coingeckoId: token.coingeckoId,
      timestamp: new Date().toISOString()
    } as JobMessage);
    // Price
    await producer.send("price-crawler.price.request", {
      job_type: "price",
      token_type: "trending",
      chain: token.chain,
      address: token.address,
      symbol: token.symbol,
      coingeckoId: token.coingeckoId,
      timestamp: new Date().toISOString()
    } as JobMessage);
    // Audit (gửi sau cùng, worker sẽ tự kiểm tra đã có meta/price chưa)
    await producer.send("price-crawler.audit.request", {
      job_type: "audit",
      token_type: "trending",
      chain: token.chain,
      address: token.address,
      symbol: token.symbol,
      coingeckoId: token.coingeckoId,
      timestamp: new Date().toISOString()
    } as JobMessage);
  }
}

// Hàm tổng hợp gọi khi service start
export async function triggerAllJobsOnStartup() {
  const producer = new KafkaProducer();
  await producer.connect();
  await triggerTopJobsOnStartup(producer);
  await triggerTrendingJobsOnStartup(producer);
}
