import axios from "axios";
import { AuditInfo, FetcherResult } from "./types";
import configs = require("../config");

// Lấy endpoint từ config
const GOPLUS_API = configs.api?.goplus || "https://api.gopluslabs.io/api/v1/token_security";

export async function getTokenAuditGoPlus(chainId: string, address: string): Promise<AuditInfo | null> {
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
