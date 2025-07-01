/**
 * Cấu hình endpoint API cho các fetcher, có thể mở rộng cho từng môi trường.
 */
const configs = {
  api: {
    coingecko: "https://api.coingecko.com/api/v3",
    dexscreener: "https://api.dexscreener.com/latest/dex/tokens",
    geckoterminal: "https://api.geckoterminal.com/api/v2",
    goplus: "https://api.gopluslabs.io/api/v1/token_security",
    binance: "https://api.binance.com/api/v3"
  },
  scheduler: {
    priceCron: "*/5 * * * * *", // Mặc định mỗi 5 giây
    metadataCron: "0 0 * * *", // Mặc định mỗi ngày lúc 00:00
    auditCron: "*/120 * * * * *" // Mặc định mỗi 2 phút
  },
  kafka: {
    topic: {
      priceRequest: "price_request",
      metadataRequest: "metadata_request",
      auditRequest: "audit_request"
    },
    producerConfig: {
      clientId: "price-crawler-producer",
      brokers: ["localhost:9092"]
    },
    consumerConfig: {
      groupId: "price-crawler-consumer-group",
      clientId: "price-crawler-consumer",
      brokers: ["localhost:9092"],
      allowAutoTopicCreation: true
    }
  },
  chainIdMapGoPlus: {
    base: "8453",
    zora: "7777777",
    blast: "81457",
    ethereum: "1",
    bsc: "56",
    polygon: "137",
    arbitrum: "42161",
    optimism: "10",
    avalanche: "43114",
    fantom: "250",
  },
  TopLimit: 100, // Số lượng top coin mặc định
  TrendingLimit: 20, // Số lượng trending token mặc định
};

export = configs;
