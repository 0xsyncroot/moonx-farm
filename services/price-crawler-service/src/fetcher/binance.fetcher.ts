import axios from "axios";
import { TokenProfile, MarketInfo, FetcherResult } from "./types";
import configs = require("../../../../packages/configs");

// Lấy endpoint từ config
const BINANCE_API = configs.api?.binance || "https://api.binance.com/api/v3";

export async function getBinancePrice(symbol: string): Promise<MarketInfo | null> {
  try {
    const { data } = await axios.get(`${BINANCE_API}/ticker/price?symbol=${symbol}USDT`);
    return {
      chain: "centralized",
      dex: "Binance",
      pairAddress: symbol + "/USDT",
      priceUsd: data.price,
      liquidityUsd: "",
      volume24h: "",
      fdv: "",
      createdAt: null,
      url: `https://www.binance.com/en/trade/${symbol}_USDT`
    };
  } catch {
    return null;
  }
}

// Mock fetcher cho test pipeline
export async function mockBinancePrice(symbol: string): Promise<FetcherResult> {
  const market = await getBinancePrice(symbol);
  return {
    profile: null,
    raw: market
  };
}
