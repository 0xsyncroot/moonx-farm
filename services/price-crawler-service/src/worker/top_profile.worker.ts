import { getTopCoinProfiles } from "../fetcher/coingecko.fetcher";
import { TokenProfile } from "../fetcher/types";

// Pipeline test: lấy top N token từ Coingecko, chuẩn hóa dữ liệu, không ghi DB
export async function getTopTokensProfile(limit = 10): Promise<TokenProfile[]> {
  return await getTopCoinProfiles(limit);
}

// Demo/mock: gọi pipeline với dữ liệu mẫu
async function demo() {
  const profiles = await getTopTokensProfile(5);
  console.dir(profiles, { depth: null });
}

if (require.main === module) {
  demo();
}
