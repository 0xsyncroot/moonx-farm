# 📦 Price Crawler Worker Specification

## 🧠 Objective

Develop a scalable **Price Crawler Worker** system that:

- Periodically collects **price**, **metadata**, and **audit** information for tokens.
- Fetches data from **Binance API**, **DexScreener**, and other CEX/DEX sources.
- Sends jobs via **Kafka** to worker services.
- Stores results in **PostgreSQL** with upsert logic.
- Supports real-time pricing for trading UI and backend order logic (Limit/DCA).

---

## 🧱 System Architecture

```
[SCHEDULER - node-cron]
   → [Kafka Producer - node-rdkafka]
      → Kafka Topics
         → [Worker - Kafka Consumer (per job type)]
             → [API Calls → Transformation → PostgreSQL]
```

Each (token type + job type) is handled by **independent pipelines** to support modular scaling and failure isolation.

---

## ⏱️ Job Schedule Requirements

| Token Type   | Job Type    | Frequency     | Notes                                 |
|--------------|-------------|---------------|---------------------------------------|
| Top 100      | Metadata    | Every 24h     | Static metadata, fetched rarely       |
| Top 100      | Price       | Every 5 sec   | High frequency for trading UI         |
| Trending     | Price+Meta  | Every 1 min   | Fetched together                      |
| Trending     | Audit       | After price/meta | Executed immediately after completion |

---

## 📦 Kafka Topic Design

| Topic Name                          | Purpose                        |
|------------------------------------|--------------------------------|
| `price-crawler.price.request`      | Price crawling jobs            |
| `price-crawler.metadata.request`   | Metadata crawling jobs         |
| `price-crawler.audit.request`      | Audit crawling jobs            |

**Kafka Message Structure:**

```json
{
  "job_type": "price",
  "token_type": "top100",
  "symbols": ["BTC", "ETH", "SOL"],
  "timestamp": "2025-06-25T21:00:00Z"
}
```

---

## ⚙️ Backend Stack

| Layer          | Technology                         |
|----------------|-------------------------------------|
| Scheduler      | `node-cron`                        |
| Messaging      | Kafka + `node-rdkafka`             |
| Worker         | `Node.js` + `TypeScript`           |
| API Client     | `axios` or `node-fetch`            |
| DB Access      | `Prisma` or `Knex.js`              |
| Database       | PostgreSQL                         |

---

## 🔐 Business Rules

- Prices must always be fetched against **USDT**
- **Stablecoins** (e.g. USDT, USDC, DAI, WETH) are excluded
- Data is **overwritten** if a token contract already exists
- Use **contract address** as the primary key
- Audit jobs are executed **after** metadata/price for trending tokens

---

## 🗃️ Database Schema

### 🔸 `tokens` (Token Metadata)

```sql
CREATE TABLE tokens (
  contract         VARCHAR(255) PRIMARY KEY,
  symbol           VARCHAR(50) NOT NULL,
  name             VARCHAR(255),
  chain_id         VARCHAR(50),
  decimals         INT,
  logo_url         TEXT,
  source           VARCHAR(100),
  is_stablecoin    BOOLEAN DEFAULT FALSE,
  last_updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 🔸 `token_prices` (Price Tracking)

```sql
CREATE TABLE token_prices (
  id               SERIAL PRIMARY KEY,
  contract         VARCHAR(255) REFERENCES tokens(contract),
  price_usdt       NUMERIC(30, 10) NOT NULL,
  source           VARCHAR(100),
  timestamp        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (contract, timestamp)
);
```

---

### 🔸 `token_audits` (Trending Token Audits)

```sql
CREATE TABLE token_audits (
  id               SERIAL PRIMARY KEY,
  contract         VARCHAR(255) REFERENCES tokens(contract),
  audit_score      NUMERIC(5,2),
  audit_provider   VARCHAR(255),
  is_verified      BOOLEAN,
  report_url       TEXT,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 🔸 `job_logs` (Optional Monitoring)

```sql
CREATE TABLE job_logs (
  id               SERIAL PRIMARY KEY,
  job_type         VARCHAR(50),
  token_type       VARCHAR(50),
  contract         VARCHAR(255),
  status           VARCHAR(20),
  message          TEXT,
  executed_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔍 Index Recommendations

```sql
CREATE INDEX idx_tokens_symbol ON tokens(symbol);
CREATE INDEX idx_prices_contract_time ON token_prices(contract, timestamp DESC);
CREATE INDEX idx_audits_contract ON token_audits(contract);
CREATE INDEX idx_joblog_contract ON job_logs(contract);
```

---

## 📌 Implementation Goals for AI Agent

- [ ] Generate scheduler job definitions (using `node-cron`)
- [ ] Implement Kafka producer for dispatching jobs
- [ ] Setup consumer pipelines per job type (price, metadata, audit)
- [ ] Implement data fetchers from Binance, DexScreener
- [ ] Normalize & transform data
- [ ] Connect to PostgreSQL using Prisma/Knex (In Progress)
- [ ] Use upsert logic on contract key (In Progress)
- [ ] Add retry, error logging, and healthcheck endpoints
- [ ] Optional: Docker + Compose setup for Kafka/PostgreSQL

## 🚀 Current Implementation Progress

---

### Tiến độ các giai đoạn

- **Giai đoạn 1: Khung code & cấu trúc dự án** — 100% hoàn thành
- **Giai đoạn 2: Scheduler & Job Definition** — 100% hoàn thành
- **Giai đoạn 3: Kafka Producer/Consumer, tích hợp end-to-end** — 100% hoàn thành


## 🛠️ Deployment Roadmap (Kế hoạch triển khai chi tiết)

### Giai đoạn 1: Khung code & cấu trúc dự án
- **Mục tiêu:** Tạo đầy đủ các file, module, class, interface chính cho toàn bộ luồng, chưa cần code logic chi tiết.
- **Đầu ra:** 
  - Thư mục, file cho từng thành phần: Scheduler, Kafka Producer, Kafka Consumer (Worker), API Client, DB Access, Models, Config, Logger, Healthcheck.
  - Định nghĩa interface/class rỗng, comment mô tả vai trò.
  - Đảm bảo đủ các pipeline cho từng loại job (price, metadata, audit).
- **Tiêu chí hoàn thành:** Review cấu trúc, xác nhận đủ thành phần, sẵn sàng cho code chi tiết.

### Giai đoạn 2: Scheduler & Job Definition
- **Mục tiêu:** Cài đặt Scheduler (node-cron), định nghĩa các loại job, lịch chạy, mapping với Kafka Topic.
- **Đầu ra:** 
  - File scheduler với các cronjob cho từng loại token/job.
  - Định nghĩa cấu trúc job, mapping với Kafka message.
- **Tiêu chí hoàn thành:** Có thể tạo job và gửi message mẫu lên Kafka (chưa cần worker xử lý).

### Giai đoạn 3: Kafka Producer/Consumer
- **Mục tiêu:** 
  - Cài đặt Kafka Producer gửi job lên topic.
  - Cài đặt Kafka Consumer cho từng loại job (price, metadata, audit).
- **Đầu ra:** 
  - Module producer, consumer, config kết nối Kafka.
  - Worker nhận message, log ra console (chưa xử lý logic).
- **Tiêu chí hoàn thành:** Có thể gửi/nhận message giữa scheduler và worker.

### Giai đoạn 4: Data Fetcher & API Integration
- **Mục tiêu:** 
  - Cài đặt các hàm fetch dữ liệu từ Binance, DexScreener, các nguồn CEX/DEX.
  - Chuẩn hóa dữ liệu đầu ra.
- **Đầu ra:** 
  - Module fetcher, mock API call, trả về dữ liệu mẫu.
  - Định nghĩa interface dữ liệu chuẩn.
- **Tiêu chí hoàn thành:** Worker có thể gọi fetcher, nhận dữ liệu mẫu.

### Giai đoạn 5: Database Access & Upsert Logic
- **Mục tiêu:** 
  - Kết nối PostgreSQL qua Prisma/Knex.
  - Cài đặt upsert cho bảng tokens, token_prices, token_audits.
- **Đầu ra:** 
  - Module DB, hàm upsert, migration schema.
- **Tiêu chí hoàn thành:** Worker lưu dữ liệu mẫu vào DB.

### Giai đoạn 6: Xử lý logic từng loại Job
- **Mục tiêu:** 
  - Cài đặt chi tiết pipeline cho từng loại job: price, metadata, audit.
  - Đảm bảo audit chạy sau price/meta với trending token.
- **Đầu ra:** 
  - Worker xử lý đủ các loại job, flow hoàn chỉnh.
- **Tiêu chí hoàn thành:** End-to-end flow cho từng loại job.

### Giai đoạn 7: Error Handling, Retry, Logging
- **Mục tiêu:** 
  - Thêm retry, error log, lưu job_logs.
- **Đầu ra:** 
  - Module logging, error handler, lưu log vào DB.
- **Tiêu chí hoàn thành:** Có thể theo dõi trạng thái job, retry khi lỗi.

### Giai đoạn 8: Healthcheck & Monitoring
- **Mục tiêu:** 
  - Thêm endpoint healthcheck, metric cơ bản.
- **Đầu ra:** 
  - Endpoint kiểm tra trạng thái service.
- **Tiêu chí hoàn thành:** Có thể kiểm tra health qua HTTP.

### Giai đoạn 9: Docker Compose & Deployment
- **Mục tiêu:** 
  - Viết docker-compose cho Kafka, PostgreSQL, worker.
- **Đầu ra:** 
  - File docker-compose, hướng dẫn chạy local.
- **Tiêu chí hoàn thành:** Có thể chạy toàn bộ hệ thống local.

### Giai đoạn 10: Refactor, Test, Document
- **Mục tiêu:** 
  - Refactor code, bổ sung test, hoàn thiện tài liệu.
- **Đầu ra:** 
  - Unit test, integration test, tài liệu hướng dẫn.
- **Tiêu chí hoàn thành:** Đảm bảo code sạch, dễ bảo trì, có test/tài liệu.

---
