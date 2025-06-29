import { createDatabase, createDatabaseConfig, DatabaseManager } from "../../../../packages/infrastructure/src/database";

// Khởi tạo kết nối DB sử dụng DATABASE_URL từ env
const dbConfig = createDatabaseConfig();
export const db: DatabaseManager = createDatabase(dbConfig);

// Hàm connect DB (nên gọi ở đầu worker/service)
export async function connectDb() {
  await db.connect();
}
