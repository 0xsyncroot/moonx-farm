// Định nghĩa interface message Kafka cho worker

import { JobType, TokenType } from "../models";

export interface JobMessage {
  job_type: JobType;
  token_type: TokenType;
  chain: string;
  address: string;
  symbol?: string;
  coingeckoId?: string;
  timestamp: string;
}
