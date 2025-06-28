// DB Access - Khung module truy cập database (PostgreSQL, Prisma/Knex)
// Triển khai chi tiết ở giai đoạn sau

export interface Token {
  contract: string;
  symbol: string;
  name?: string;
  chain_id?: string;
  decimals?: number;
  logo_url?: string;
  source?: string;
  is_stablecoin?: boolean;
  last_updated_at?: Date;
}

export interface TokenPrice {
  contract: string;
  price_usdt: number;
  source?: string;
  timestamp: Date;
}

export interface TokenAudit {
  contract: string;
  audit_score?: number;
  audit_provider?: string;
  is_verified?: boolean;
  report_url?: string;
  created_at?: Date;
}

export class Database {
  // Kết nối DB
  async connect(): Promise<void> {
    // TODO: Kết nối PostgreSQL qua Prisma/Knex
  }

  // Upsert token metadata
  async upsertToken(token: Token): Promise<void> {
    // TODO: Upsert vào bảng tokens
  }

  // Upsert token price
  async upsertTokenPrice(price: TokenPrice): Promise<void> {
    // TODO: Upsert vào bảng token_prices
  }

  // Thêm audit info
  async insertTokenAudit(audit: TokenAudit): Promise<void> {
    // TODO: Insert vào bảng token_audits
  }
}
