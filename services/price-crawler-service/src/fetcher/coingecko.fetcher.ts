import axios from "axios";
import { TokenProfile, MarketInfo, FetcherResult, ContractsMap, SocialLinks } from "./types";

import configs = require("../config");

// Lấy endpoint từ config
const COINGECKO_API = configs.api?.coingecko || "https://api.coingecko.com/api/v3";

function normalizeSocials(links: any = {}): SocialLinks {
  return {
    website: links.homepage?.[0] || "",
    twitter: links.twitter_screen_name ? `https://twitter.com/${links.twitter_screen_name}` : "",
    telegram: links.telegram_channel_identifier ? `https://t.me/${links.telegram_channel_identifier}` : "",
    discord: links.chat_url?.find((x: string) => x.includes("discord")) || "",
    github: links.repos_url?.github?.[0] || "",
    whitepaper: links.official_forum_url?.[0] || "",
  };
}

function normalizeContracts(platforms: any = {}): ContractsMap {
  const contracts: ContractsMap = {};

  Object.entries(platforms).forEach(([chain, addr]) => {
    if (addr) contracts[chain] = addr as string;
  });

  return contracts;
}

function normalizeMarkets(tickers: any[] = []): MarketInfo[] {
  return tickers.map(t => ({
    chain: t.target === "USDT" ? "centralized" : (t.base_network || ""),
    dex: t.market?.name,
    pairAddress: t.base + "/" + t.target,
    priceUsd: t.converted_last?.usd || t.last,
    liquidityUsd: t.converted_volume?.usd || "",
    volume24h: t.converted_volume?.usd || "",
    url: t.trade_url || "",
    createdAt: null
  }));
}

export async function getCoinProfileCoingecko(id: string): Promise<TokenProfile | null> {
  const url = `${COINGECKO_API}/coins/${id}?localization=false&tickers=true&market_data=true&community_data=true&developer_data=true&sparkline=false`;
  const { data } = await axios.get(url);

  const contracts = normalizeContracts(data.platforms);
  const socials = normalizeSocials(data.links);

  const binanceMarkets = data.tickers?.filter((t: any) => t.market.name.toLowerCase() === "binance");
  const mainMarket = binanceMarkets?.[0] || data.tickers?.[0] || null;

  const mainPool: MarketInfo | undefined = mainMarket
    ? {
        chain: mainMarket.target === "USDT" ? "centralized" : (mainMarket.base_network || ""),
        dex: mainMarket.market?.name,
        pairAddress: mainMarket.base + "/" + mainMarket.target,
        priceUsd: mainMarket.converted_last?.usd || mainMarket.last,
        liquidityUsd: mainMarket.converted_volume?.usd || "",
        volume24h: mainMarket.converted_volume?.usd || "",
        createdAt: null,
        url: mainMarket.trade_url || ""
      }
    : undefined;

  const markets = normalizeMarkets(data.tickers);

  let decimals: number | null = null;
  if (data.detail_platforms) {
    for (const chain in data.detail_platforms) {
      if (data.detail_platforms[chain]?.decimal_place != null) {
        decimals = data.detail_platforms[chain].decimal_place;
        break;
      }
    }
  }

  return {
    address: data.id,
    name: data.name,
    symbol: data.symbol,
    decimals: decimals || undefined,
    logoUrl: data.image?.large || data.image?.thumb,
    contracts,
    socials,
    mainPool,
    markets,
    tags: data.categories || [],
    description: data.description?.en || "",
    source: "coingecko"
  };
}

// Lấy top N coin (marketcap)
export async function getTopCoinsCoingecko(limit = 20, currency = "usd"): Promise<any[]> {
  const url = `${COINGECKO_API}/coins/markets?vs_currency=${currency}&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false`;
  const { data } = await axios.get(url);
  return data;
}

// Lấy profile top N coin
export async function getTopCoinProfiles(limit = 10): Promise<TokenProfile[]> {
  const topCoins = await getTopCoinsCoingecko(limit);
  const results: TokenProfile[] = [];
  for (const coin of topCoins) {
    const profile = await getCoinProfileCoingecko(coin.id);
    if (profile) results.push(profile);
  }
  return results;
}

// Mock fetcher cho test pipeline
export async function mockTopCoinProfiles(limit = 2): Promise<FetcherResult[]> {
  const profiles = await getTopCoinProfiles(limit);
  return profiles.map(profile => ({ profile }));
}
