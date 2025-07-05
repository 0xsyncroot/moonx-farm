/**
 * Cấu hình endpoint API cho các fetcher, có thể mở rộng cho từng môi trường.
 */
const configs = {
  api: {
    coingecko: "https://api.coingecko.com/api/v3",
    dexscreener: "https://api.dexscreener.com/latest/dex/tokens",
    geckoterminal: "https://api.geckoterminal.com/api/v2",
    goplus: "https://api.gopluslabs.io/api/v1/token_security",
    binance: "https://api.binance.com/api/v3",
  },
  scheduler: {
    priceCron: "*/5 * * * * *", // Mặc định mỗi 5 giây
    metadataCron: "0 0 * * *", // Mặc định mỗi ngày lúc 00:00
    auditCron: "*/120 * * * * *", // Mặc định mỗi 2 phút
  },
  kafka: {
    topic: {
      priceRequest: "price_request",
      metadataRequest: "metadata_request",
      auditRequest: "audit_request",
    },
    producerConfig: {
      clientId: "price-crawler-producer",
      brokers: ["185.192.97.148:19092"],
    },
    consumerConfig: {
      groupId: "price-crawler-consumer-group",
      clientId: "price-crawler-consumer",
      brokers: ["185.192.97.148:19092"],
      allowAutoTopicCreation: true,
    },
  },
  chainIdMap: [
    // {
    //   id: "base",
    //   name: "Base",
    //   goPlus: "8453",
    // },
    // {
    //   id: "zora",
    //   name: "Zora",
    //   goPlus: "7777777",
    // },
    // {
    //   id: "blast",
    //   name: "Blast",
    //   goPlus: "81457",
    // },
    {
      id: "eth",
      name: "Ethereum",
      goPlus: "1",
    },
    // {
    //   id: "bsc",
    //   name: "BNB Chain",
    //   goPlus: "56",
    // },
    // {
    //   id: "polygon_pos",
    //   name: "Polygon POS",
    //   goPlus: "137",
    // },
    // {
    //   id: "arbitrum",
    //   name: "Arbitrum",
    //   goPlus: "42161",
    // },
    // {
    //   id: "optimism",
    //   name: "Optimism",
    //   goPlus: "10",
    // },
    // {
    //   id: "avax",
    //   name: "Avalanche",
    //   goPlus: "43114",
    // },
    // {
    //   id: "ftm",
    //   name: "Fantom",
    //   goPlus: "250",
    // },
  ],

  TopLimit: 10, // Số lượng top coin mặc định
  TrendingLimit: 10, // Số lượng trending token mặc định
  DelayConfigAtStart: {
    // Thời gian delay khi khởi động service
    top: {
      price: 10000, // 10 giây
    },
    trending: {
      price: 10000, // 10 giây
      audit: 60000, //1 phút
    },
  },
};

export = configs;
