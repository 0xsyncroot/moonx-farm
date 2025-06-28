// Coingecko API Client - Khung module gọi API Coingecko
// Triển khai chi tiết ở giai đoạn sau

export class CoingeckoClient {
  // Lấy top coins
  async getTopCoins(limit: number): Promise<any[]> {
    // TODO: Gọi API lấy top coins
    return [];
  }

  // Lấy profile chi tiết cho coin
  async getCoinProfile(id: string): Promise<any> {
    // TODO: Gọi API lấy profile chi tiết
    return null;
  }
}
