import axios from "axios";
import { AuditInfo, FetcherResult } from "./types";
import configs = require("../../../../packages/configs");

// Lấy endpoint từ config
const GOPLUS_API = configs.api?.goplus || "https://api.gopluslabs.io/api/v1/token_security";

const chainIdMapGoPlus: Record<string, string> = {
  base: "8453",
  zora: "7777777",
  blast: "81457",
  ethereum: "1",
  bsc: "56",
  polygon: "137",
  arbitrum: "42161",
  optimism: "10",
  avalanche: "43114",
  fantom: "250",
};

export async function getTokenAuditGoPlus(chain: string, address: string): Promise<AuditInfo | null> {
  const chainId = chainIdMapGoPlus[chain];
  if (!chainId) return null;
  try {
    const { data } = await axios.get(
      `${GOPLUS_API}/${chainId}?contract_addresses=${address}`
    );
    if (data?.result && data.result[address.toLowerCase()])
      return data.result[address.toLowerCase()];
    return null;
  } catch {
    return null;
  }
}

// Mock fetcher cho test pipeline
export async function mockTokenAuditGoPlus(chain: string, address: string): Promise<FetcherResult> {
  const audit = await getTokenAuditGoPlus(chain, address);
  return { profile: null, audit };
}
