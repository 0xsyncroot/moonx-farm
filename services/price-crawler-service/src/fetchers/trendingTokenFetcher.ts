// Trending Token Fetcher - Khung module lấy trending token từ GeckoTerminal/Dexscreener
// Triển khai chi tiết ở giai đoạn sau

export interface TrendingTokenProfile {
  name: string;
  symbol: string;
  decimals?: number | null;
  logoUrl?: string;
  contracts: Record<string, string>;
  socials?: {
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
    github?: string;
    whitepaper?: string;
  };
  description?: string;
  mainPool?: any;
  markets?: any[];
  tags?: string[];
  source: string;
  audit?: any;
}

import {getTrendingTokensFromGeckoTerminal, getTokenProfileGeckoTerminal} from "../fetcher/geckoterminal.fetcher";
import {getTokenProfileDexscreener} from "../fetcher/dexscreener.fetcher";
import {getTokenAuditGoPlus } from "../fetcher/goplus.fetcher"; // Chưa triển khai

export class TrendingTokenFetcher {
  // Lấy danh sách trending token (chỉ khung)
  async getTrendingTokens(chain: string, limit: number): Promise<any[]> {
    // Triển khai gọi GeckoTerminal API
    const tokens = await getTrendingTokensFromGeckoTerminal(chain, limit);
    if (tokens.length > 0) {
      return tokens;
    }
    return [];
  }

  // Lấy profile chi tiết cho từng token (chỉ khung)
  async getTokenProfile(chain: string, address: string): Promise<TrendingTokenProfile | null> {
    // TODO: Triển khai lấy profile từ Dexscreener/GeckoTerminal
    var profile =  await getTokenProfileDexscreener(address);
    if (!profile) profile = await getTokenProfileGeckoTerminal(chain, address);
    // if (!profile && coingeckoId) profile = await getCoinProfileCoingecko(coingeckoId);

    if (profile) {
      return profile;
    }
    return null;
  }

  // Lấy audit info cho token (chỉ khung)
  async getTokenAudit(chain: string, address: string): Promise<any> {
    // TODO: Triển khai lấy audit từ GoPlus
    const audit = await getTokenAuditGoPlus(chain, address);
    if (audit) {
      return audit;
    }
    return null;
  }
}
