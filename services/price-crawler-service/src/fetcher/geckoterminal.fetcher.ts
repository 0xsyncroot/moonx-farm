import axios from "axios";
import { TokenProfile, FetcherResult, MarketInfo } from "./types";
import configs = require("../../../../packages/configs");

// Lấy endpoint từ config
const GECKOTERMINAL_API = configs.api?.geckoterminal || "https://api.geckoterminal.com/api/v2";

export async function getTokenProfileGeckoTerminal(chain: string, address: string): Promise<TokenProfile | null> {
  try {
    const { data } = await axios.get(
      `${GECKOTERMINAL_API}/networks/${chain}/tokens/${address.toLowerCase()}`
    );
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
      url: ""
    };
    return {
      name: attr.name,
      symbol: attr.symbol,
      logoUrl: attr.logo_uri,
      contracts: { [chain]: attr.address },
      socials: {},
      mainPool: market,
      markets: [market],
      tags: [],
      description: "",
      source: "geckoterminal"
    };
  } catch {
    return null;
  }
}

// Mock fetcher cho test pipeline
export async function mockTokenProfileGeckoTerminal(chain: string, address: string): Promise<FetcherResult> {
  const profile = await getTokenProfileGeckoTerminal(chain, address);
  return { profile };
}
