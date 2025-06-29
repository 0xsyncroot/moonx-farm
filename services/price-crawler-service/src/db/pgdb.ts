import { Pool } from "pg";

// Lấy DATABASE_URL từ env hoặc hardcode cho test nhanh
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://moonxfarm:posst3Dfgres3@185.192.97.148:5632/moonx_farm";

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: false
});

export async function connectPgDb() {
  await pool.connect();
}
