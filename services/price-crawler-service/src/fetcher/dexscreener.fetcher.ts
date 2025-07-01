import axios from "axios";
import { TokenProfile, MarketInfo, FetcherResult, ContractsMap, SocialLinks } from "./types";
import configs = require("../config");

// Lấy endpoint từ config
const DEXSCREENER_API = configs.api?.dexscreener || "https://api.dexscreener.com/latest/dex/tokens";

function normalizeMarkets(pairs: any[] = []): MarketInfo[] {
  return pairs.map((pair: any) => ({
    chain: pair.chainId,
    dex: pair.dexId,
    pairAddress: pair.pairAddress,
    priceUsd: pair.priceUsd,
    liquidityUsd: pair.liquidity?.usd,
    volume24h: pair.volume?.h24,
    fdv: pair.fdv,
    createdAt: pair.createdAt,
    url: pair.url
  }));
}

export async function getTokenProfileDexscreener(address: string): Promise<TokenProfile | null> {
  try {
    const { data } = await axios.get(`${DEXSCREENER_API}/${address}`);
    if (!data.pairs || data.pairs.length === 0) return null;

    const contracts: ContractsMap = {};
    data.pairs.forEach((pair: any) => {
      if (pair.baseToken?.address) contracts[pair.chainId] = pair.baseToken.address;
    });

    const mainPool = data.pairs.reduce((a: any, b: any) =>
      (Number(a.liquidity?.usd || 0) > Number(b.liquidity?.usd || 0)) ? a : b
    );

    const info = mainPool.info || {};
    const logoUrl = info.imageUrl || info.logoUrl || null;

    const socials: SocialLinks = {
      website: info.websites?.[0] || "",
      twitter: info.twitter || "",
      telegram: info.telegram || "",
      discord: info.discord || "",
      github: info.github || "",
      whitepaper: info.whitepaper || ""
    };

    const markets = normalizeMarkets(data.pairs);

    return {
      name: mainPool.baseToken.name,
      symbol: mainPool.baseToken.symbol,
      decimals: mainPool.baseToken.decimals,
      logoUrl,
      contracts,
      socials,
      mainPool: {
        chain: mainPool.chainId,
        dex: mainPool.dexId,
        pairAddress: mainPool.pairAddress,
        priceUsd: mainPool.priceUsd,
        liquidityUsd: mainPool.liquidity?.usd,
        volume24h: mainPool.volume?.h24,
        fdv: mainPool.fdv,
        createdAt: mainPool.createdAt,
        url: mainPool.url
      },
      markets,
      tags: mainPool.tags || [],
      source: "dexscreener"
    };
  } catch {
    return null;
  }
}

// Mock fetcher cho test pipeline
export async function mockTokenProfileDexscreener(address: string): Promise<FetcherResult> {
  const profile = await getTokenProfileDexscreener(address);
  return { profile };
}
