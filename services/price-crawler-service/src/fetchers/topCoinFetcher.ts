// Top Coin Fetcher - Khung module lấy top coin từ Coingecko
// Triển khai chi tiết ở giai đoạn sau
import { getTopCoinProfiles , getCoinProfileCoingecko} from "../fetcher/coingecko.fetcher"; // Giả sử bạn đã có hàm này để lấy top coin từ Coingecko

export interface TopCoinProfile {
  name: string;
  symbol: string;
  decimals: number | null;
  logoUrl: string;
  contracts: Record<string, string>;
  socials: {
    website: string;
    twitter: string;
    telegram: string;
    discord: string;
    github: string;
    whitepaper: string;
  };
  mainPool: any;
  markets: any[];
  tags: string[];
  description: string;
  source: string;
}

export class TopCoinFetcher {
  // Lấy danh sách top coin (chỉ khung)
  async getTopCoins(limit: number): Promise<any[]> {
    // Lấy topcoins từ Coingecko API qua getTopCoinProfiles qua coingecko.fetcher.ts
    const profiles = await getTopCoinProfiles(limit);

    return profiles;
  }

  // Lấy profile chi tiết cho từng coin (chỉ khung)
  async getCoinProfile(id: string): Promise<TopCoinProfile | null> {
    // Lấy profile chi tiết từ Coingecko API
    const profile = await getCoinProfileCoingecko(id);
    // map profile về định dạng TopCoinProfile
    if (!profile) return null; 
    return {
      name: profile.name,
      symbol: profile.symbol,
      decimals: profile.decimals || null,
      logoUrl: profile.logoUrl || "",
      contracts: profile.contracts || {},
      socials: {
        website: profile.socials?.website || "",
        twitter: profile.socials?.twitter || "",
        telegram: profile.socials?.telegram || "",
        discord: profile.socials?.discord || "",
        github: profile.socials?.github || "",
        whitepaper: profile.socials?.whitepaper || ""
      },
      mainPool: profile.mainPool || {},
      markets: profile.markets || [],
      tags: profile.tags || [],
      description: profile.description || "",
      source: profile.source || "coingecko"
    };
  }
}
