import { mockTopCoinProfiles } from "./coingecko.fetcher";
import { mockTokenProfileDexscreener } from "./dexscreener.fetcher";
import { mockTokenProfileGeckoTerminal } from "./geckoterminal.fetcher";
import { mockTokenAuditGoPlus } from "./goplus.fetcher";
import { mockBinancePrice } from "./binance.fetcher";

// Hàm mock tổng hợp test pipeline fetcher
async function runAllMocks() {
  console.log("=== Mock Coingecko Top Coin Profiles ===");
  const coingecko = await mockTopCoinProfiles(2);
  console.dir(coingecko, { depth: null });

  console.log("=== Mock Dexscreener Token Profile ===");
  const dex = await mockTokenProfileDexscreener("0x4200000000000000000000000000000000000006");
  console.dir(dex, { depth: null });

  console.log("=== Mock GeckoTerminal Token Profile ===");
  const gt = await mockTokenProfileGeckoTerminal("base", "0x4200000000000000000000000000000000000006");
  console.dir(gt, { depth: null });

  console.log("=== Mock GoPlus Audit ===");
  const audit = await mockTokenAuditGoPlus("base", "0x4200000000000000000000000000000000000006");
  console.dir(audit, { depth: null });

  console.log("=== Mock Binance Price ===");
  const binance = await mockBinancePrice("ETH");
  console.dir(binance, { depth: null });
}

if (require.main === module) {
  runAllMocks();
}
