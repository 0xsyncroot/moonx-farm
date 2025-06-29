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
  }
};

module.exports = configs;
