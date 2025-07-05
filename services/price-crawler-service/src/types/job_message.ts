// Định nghĩa interface message Kafka cho worker

import { JobType, TokenType } from "../models";
import { ChainMap } from "./chain_map";

export interface JobMessage {
  job_type: JobType;
  token_type: TokenType;
  chain: ChainMap;
  address: string;
  symbol?: string;
  coingeckoId?: string;
  timestamp: string;
}
