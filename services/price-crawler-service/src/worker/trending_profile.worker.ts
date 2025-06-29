import { getTokenProfileDexscreener } from "../fetcher/dexscreener.fetcher";
import { getTokenProfileGeckoTerminal } from "../fetcher/geckoterminal.fetcher";
import { getCoinProfileCoingecko } from "../fetcher/coingecko.fetcher";
import { getTokenAuditGoPlus } from "../fetcher/goplus.fetcher";
import { TokenProfile, FetcherResult } from "../fetcher/types";

// Pipeline lấy profile trending token: ưu tiên Dexscreener, fallback GeckoTerminal, fallback Coingecko, luôn kèm audit GoPlus Labs
export async function getTrendingTokenFullProfile(chain: string, address: string, coingeckoId?: string): Promise<FetcherResult> {
  let profile: TokenProfile | null = await getTokenProfileDexscreener(address);

  if (!profile) {
    profile = await getTokenProfileGeckoTerminal(chain, address);
  }

  if (!profile && coingeckoId) {
    profile = await getCoinProfileCoingecko(coingeckoId);
  }

  const audit = await getTokenAuditGoPlus(chain, address);

  return { profile, audit };
}

// Demo/mock: gọi pipeline với dữ liệu mẫu
async function demo() {
  // Ví dụ: trending token trên chain base, address và coingeckoId giả lập
  const chain = "base";
  const address = "0x4200000000000000000000000000000000000006"; // WETH trên Base
  const coingeckoId = "weth";

  const result = await getTrendingTokenFullProfile(chain, address, coingeckoId);
  console.dir(result, { depth: null });
}

if (require.main === module) {
  demo();
}
