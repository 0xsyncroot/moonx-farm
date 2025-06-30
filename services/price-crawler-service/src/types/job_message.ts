// Định nghĩa interface message Kafka cho worker

export type JobType = "price" | "metadata" | "audit";
export type TokenType = "top" | "trending";

export interface JobMessage {
  job_type: JobType;
  token_type: TokenType;
  chain: string;
  address: string;
  symbol?: string;
  coingeckoId?: string;
  timestamp: string;
}
