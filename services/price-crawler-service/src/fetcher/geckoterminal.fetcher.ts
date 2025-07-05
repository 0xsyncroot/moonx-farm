import axios from "axios";
import { TokenProfile, FetcherResult, MarketInfo } from "./types";
import configs = require("../config");

// Lấy endpoint từ config
const GECKOTERMINAL_API =
  configs.api?.geckoterminal || "https://api.geckoterminal.com/api/v2";
/**
 * Lấy danh sách token trending từ GeckoTerminal API
 * @param chain Chuỗi đại diện cho chuỗi blockchain (ví dụ: "base", "ethereum", v.v.)
 * @param limit Số lượng token tối đa cần lấy
 * @returns Danh sách token trending
 */
export async function getTrendingTokensFromGeckoTerminal(
  chain: string,
  limit: number = 20
): Promise<TokenProfile[]> {
  let tokens: TokenProfile[] = [];
  let page = 1;
  const seen = new Set<string>();

  while (tokens.length < limit) {
    const url = `${GECKOTERMINAL_API}/networks/${chain}/pools?page=${page}`;
    const { data } = await axios.get(url);
    if (!data.data || data.data.length === 0) break;

    for (const pool of data.data) {
      const baseToken = pool.attributes;
      if (baseToken && !seen.has(baseToken.address)) {
        const market: MarketInfo = {
          chain,
          dex: "",
          pairAddress: pool.attributes.address,
          priceUsd: pool.attributes.price_usd,
          liquidityUsd: pool.attributes.reserve_in_usd,
          volume24h: pool.attributes.volume_usd_24h,
          fdv: pool.attributes.fdv_usd,
          createdAt: null,
          url: "",
        };
        tokens.push({
          address: baseToken.address,
          decimals: baseToken.decimals,
          name: baseToken.name,
          symbol: baseToken.symbol,
          logoUrl: baseToken.logo_uri,
          contracts: { [chain]: baseToken.address },
          socials: {},
          mainPool: market,
          markets: [market],
          tags: [],
          description: "",
          source: "geckoterminal",
        });
        seen.add(baseToken.address);
        if (tokens.length >= limit) break;
      }
    }
    page++;
  }
  return tokens;
}

/**
 * Lấy thông tin token từ GeckoTerminal API
 * @param chain Chuỗi đại diện cho chuỗi blockchain (ví dụ: "ethereum", "bsc", v.v.)
 * @param address Địa chỉ hợp đồng token
 * @returns TokenProfile hoặc null nếu không tìm thấy
 */
export async function getTokenProfileGeckoTerminal(
  chain: string,
  address: string
): Promise<TokenProfile | null> {
  try {
    const url = `${GECKOTERMINAL_API}/networks/${chain}/tokens/${address.toLowerCase()}`;

    const { data } = await axios.get(url);

    const attr = data.data?.attributes || {};
    const market: MarketInfo = {
      chain,
      dex: "",
      pairAddress: "",
      priceUsd: attr.price_usd,
      liquidityUsd: attr.reserve_in_usd,
      volume24h: attr.volume_usd_24h,
      fdv: attr.fdv_usd,
      createdAt: null,
      url: "",
    };
    return {
      address: attr.address,
      name: attr.name,
      symbol: attr.symbol,
      logoUrl: attr.logo_uri,
      contracts: { [chain]: attr.address },
      socials: {},
      mainPool: market,
      markets: [market],
      tags: [],
      description: "",
      source: "geckoterminal",
    };
  } catch {
    return null;
  }
}

// Mock fetcher cho test pipeline
export async function mockTokenProfileGeckoTerminal(
  chain: string,
  address: string
): Promise<FetcherResult> {
  const profile = await getTokenProfileGeckoTerminal(chain, address);
  return { profile };
}
