// Định nghĩa interface/types chuẩn hóa cho fetcher

export interface SocialLinks {
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  github?: string;
  whitepaper?: string;
}

export interface ContractsMap {
  [chain: string]: string;
}

export interface MarketInfo {
  chain: string;
  dex: string;
  pairAddress: string;
  priceUsd: string | number;
  liquidityUsd?: string | number;
  volume24h?: string | number;
  fdv?: string | number;
  createdAt?: string | number | null;
  url?: string;
}

export interface AuditInfo {
  audit_score?: number | string;
  audit_provider?: string;
  is_verified?: boolean;
  report_url?: string;
  [key: string]: any;
}

export interface TokenProfile {
  address: string; // PK
  name: string;
  symbol: string;
  decimals?: number;
  logoUrl?: string;
  contracts: ContractsMap;
  socials: SocialLinks;
  mainPool?: MarketInfo;
  markets?: MarketInfo[];
  tags?: string[];
  description?: string;
  source: string;
  audit?: AuditInfo;
}

export interface FetcherResult {
  profile: TokenProfile | null;
  audit?: AuditInfo | null;
  raw?: any;
}
