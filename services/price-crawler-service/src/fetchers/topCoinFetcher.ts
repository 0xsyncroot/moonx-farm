// Top Coin Fetcher - Khung module lấy top coin từ Coingecko
// Triển khai chi tiết ở giai đoạn sau

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
    // TODO: Triển khai gọi Coingecko API
    return [];
  }

  // Lấy profile chi tiết cho từng coin (chỉ khung)
  async getCoinProfile(id: string): Promise<TopCoinProfile | null> {
    // TODO: Triển khai lấy profile từ Coingecko
    return null;
  }
}
