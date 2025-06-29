# 📦 Đặc Tả Worker Thu Thập Giá (Price Crawler Worker)

## 🧠 Mục Tiêu

Phát triển hệ thống **Price Crawler Worker** có khả năng mở rộng, bao gồm:

- Định kỳ thu thập **giá**, **metadata**, và **audit** cho các token.
- Lấy dữ liệu từ **Binance API**, **DexScreener** và các nguồn CEX/DEX khác.
- Gửi job qua **Kafka** tới các worker service.
- Lưu kết quả vào **PostgreSQL** với logic upsert.
- Hỗ trợ giá real-time cho giao diện trading và backend order logic (Limit/DCA).

---

## 🛡️ Yêu Cầu & Tiêu Chuẩn Hệ Thống

- **Cấu hình tập trung:** Sử dụng `@moonx/configs` cho toàn bộ config, profile-based loading.
- **Logging chuẩn hóa:** Tích hợp logger chuẩn (`@moonx/common` - winston), log theo format toàn hệ thống.
- **Xử lý lỗi:** Chuẩn hóa error boundary, retry logic, lưu log vào DB (`job_logs`).
- **Healthcheck & Metrics:** Bắt buộc có endpoint healthcheck, expose Prometheus metrics.
- **Observability:** Structured logging, metrics, healthcheck cho vận hành/giám sát.
- **CI/CD & Docker:** Có Dockerfile, docker-compose, script setup/test/deploy, tích hợp pipeline CI/CD.
- **Package chung:** Tận dụng tối đa `@moonx/common`, `@moonx/infrastructure` cho logger, config, DB/Kafka/Redis connection.
- **Isolation:** Mỗi pipeline (price/meta/audit) độc lập, dễ scale/failure isolation.

---

## 🧱 Kiến Trúc Hệ Thống

```
[SCHEDULER - node-cron]
   → [Kafka Producer - node-rdkafka]
      → Kafka Topics
         → [Worker - Kafka Consumer (mỗi loại job)]
             → [API Calls → Chuyển đổi dữ liệu → PostgreSQL]
```

- Tất cả thành phần worker phải tuân thủ chuẩn centralized config, logging, error handling, healthcheck, metrics như các service khác trong hệ thống MoonXFarm.
- Mỗi pipeline là một process độc lập, có thể scale/failure isolation, dễ mở rộng.

Mỗi (loại token + loại job) được xử lý bởi **pipeline độc lập** để hỗ trợ mở rộng và cô lập lỗi.

---

## ⏱️ Yêu Cầu Lịch Chạy Job

| Loại Token   | Loại Job    | Tần suất        | Ghi chú                                 |
|--------------|-------------|-----------------|-----------------------------------------|
| Top 100      | Metadata    | Mỗi 24h         | Metadata tĩnh, lấy ít                   |
| Top 100      | Price       | Mỗi 5 giây      | Tần suất cao cho trading UI             |
| Trending     | Price+Meta  | Mỗi 1 phút      | Lấy đồng thời                           |
| Trending     | Audit       | Sau price/meta  | Chạy ngay sau khi xong price/meta       |

---

## 📦 Thiết Kế Kafka Topic

| Tên Topic                        | Mục đích                      |
|----------------------------------|-------------------------------|
| `price-crawler.price.request`    | Job thu thập giá              |
| `price-crawler.metadata.request` | Job thu thập metadata         |
| `price-crawler.audit.request`    | Job audit token               |

**Cấu trúc message Kafka:**

```json
{
  "job_type": "price",
  "token_type": "top100",
  "symbols": ["BTC", "ETH", "SOL"],
  "timestamp": "2025-06-25T21:00:00Z"
}
```

---

## ⚙️ Công Nghệ Backend

| Lớp           | Công nghệ                              |
|---------------|----------------------------------------|
| Config        | `@moonx/configs` (profile-based)       |
| Logging       | `@moonx/common` (winston logger)       |
| DB/Kafka/Redis| `@moonx/infrastructure`                |
| Scheduler     | `node-cron`                            |
| Messaging     | Kafka + `node-rdkafka`                 |
| Worker        | `Node.js` + `TypeScript`               |
| API Client    | `axios` hoặc `node-fetch`              |
| DB Access     | `Prisma` hoặc `Knex.js`                |
| Database      | PostgreSQL                             |
| Healthcheck   | Endpoint Express/Fastify + Prometheus metrics |

---

## 🔐 Quy Tắc Nghiệp Vụ

- Giá luôn phải lấy theo **USDT**
- **Stablecoin** (USDT, USDC, DAI, WETH,...) bị loại trừ
- Dữ liệu sẽ **ghi đè** nếu contract token đã tồn tại
- Sử dụng **địa chỉ contract** làm khóa chính
- Job audit chỉ chạy **sau** khi đã có metadata/price cho trending token

---

## 🗃️ Thiết Kế CSDL

### 🔸 `tokens` (Metadata Token)

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

### 🔸 `token_prices` (Theo Dõi Giá)

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

### 🔸 `token_audits` (Audit Token Trending)

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

### 🔸 `job_logs` (Theo Dõi Job - Tùy Chọn)

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

## 🔍 Đề Xuất Index

```sql
CREATE INDEX idx_tokens_symbol ON tokens(symbol);
CREATE INDEX idx_prices_contract_time ON token_prices(contract, timestamp DESC);
CREATE INDEX idx_audits_contract ON token_audits(contract);
CREATE INDEX idx_joblog_contract ON job_logs(contract);
```

---

## 📌 Mục Tiêu Triển Khai Cho AI Agent

- [ ] Sinh định nghĩa job scheduler (dùng `node-cron`)
- [ ] Cài đặt Kafka producer để gửi job
- [ ] Thiết lập pipeline consumer cho từng loại job (price, metadata, audit)
- [ ] Cài đặt fetcher lấy dữ liệu từ Binance, DexScreener
- [ ] Chuẩn hóa & chuyển đổi dữ liệu
- [ ] Kết nối PostgreSQL qua Prisma/Knex (Đang thực hiện)
- [ ] Logic upsert theo contract key (Đang thực hiện)
- [ ] Thêm retry, logging lỗi, healthcheck endpoint
- [ ] Tích hợp config, logger, connection manager từ package chung
- [ ] Thêm healthcheck endpoint, expose Prometheus metrics
- [ ] Đảm bảo structured logging, error boundary, retry logic
- [ ] Viết Dockerfile, docker-compose, script CI/CD
- [ ] Tùy chọn: Docker + Compose cho Kafka/PostgreSQL

---

## 🚀 Tiến Độ Hiện Tại

### Tiến độ các giai đoạn

- **Giai đoạn 1: Khung code & cấu trúc dự án** — 100% hoàn thành
- **Giai đoạn 2: Scheduler & Định nghĩa Job** — 100% hoàn thành
- **Giai đoạn 3: Kafka Producer/Consumer, tích hợp end-to-end** — 100% hoàn thành

---

## 🛠️ Lộ Trình Triển Khai (Deployment Roadmap)

### Giai đoạn 1: Khung code & cấu trúc dự án
- **Mục tiêu:** Tạo đầy đủ các file, module, class, interface chính cho toàn bộ luồng, chưa cần code logic chi tiết.
- **Đầu ra:** 
  - Thư mục, file cho từng thành phần: Scheduler, Kafka Producer, Kafka Consumer (Worker), API Client, DB Access, Models, Config, Logger, Healthcheck.
  - Định nghĩa interface/class rỗng, comment mô tả vai trò.
  - Đảm bảo đủ các pipeline cho từng loại job (price, metadata, audit).
- **Tiêu chí hoàn thành:** Review cấu trúc, xác nhận đủ thành phần, sẵn sàng cho code chi tiết.

### Giai đoạn 2: Scheduler & Định nghĩa Job
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
  - Cài đặt các hàm fetch dữ liệu từ Binance, DexScreener, GeckoTerminal, GoPlus Labs, các nguồn CEX/DEX.
  - Chuẩn hóa dữ liệu đầu ra theo interface thống nhất.
  - Đảm bảo worker có thể gọi fetcher, nhận dữ liệu mẫu (mock).
  - Tách biệt logic từng nguồn, dễ mở rộng, dễ test.
- **Đầu ra:** 
  - Module fetcher cho từng nguồn: coingecko, dexscreener, geckoterminal, goplus, binance.
  - Mock API call, trả về dữ liệu mẫu cho test pipeline.
  - Định nghĩa interface/types chuẩn hóa: TokenProfile, MarketInfo, AuditInfo, FetcherResult, ...
  - Worker gọi fetcher, nhận dữ liệu mẫu chuẩn hóa.
- **Checklist chi tiết:**
  - [ ] Định nghĩa các interface/types chuẩn hóa dữ liệu.
  - [ ] Tạo module fetcher cho từng nguồn, trả về đúng interface.
  - [ ] Áp dụng pattern chuẩn hóa từ code mẫu (mapping contracts, socials, markets, mainPool, audit).
  - [ ] Ưu tiên Dexscreener, fallback GeckoTerminal/Coingecko nếu không có dữ liệu.
  - [ ] Luôn kèm audit GoPlus Labs nếu là trending token.
  - [ ] Mock dữ liệu mẫu cho test.
  - [ ] Worker gọi fetcher thành công, nhận dữ liệu mẫu.
- **Lưu ý triển khai:**
  - Tất cả endpoint API (Coingecko, Dexscreener, GeckoTerminal, GoPlus Labs, Binance, ...) phải được cấu hình riêng qua file config, không hardcode trong code, để dễ dàng thay đổi khi cần.
  - Sử dụng package @moonx/configs để quản lý endpoint, key, timeout, retry, ... cho từng nguồn.
  - Đảm bảo interface mở rộng, dễ bổ sung nguồn mới.
  - Có thể mock dữ liệu để test pipeline end-to-end trước khi tích hợp thật.
  - Đảm bảo logging, error boundary, dễ debug.
  - Giai đoạn này là nền tảng cho toàn bộ pipeline, cần review kỹ logic chuẩn hóa và cấu hình endpoint.
- **Tiêu chí hoàn thành:** Worker có thể gọi fetcher, nhận dữ liệu mẫu chuẩn hóa từ nhiều nguồn, endpoint API quản lý qua config, sẵn sàng chuyển sang giai đoạn 5.

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

### Giai đoạn 9: Docker Compose & Triển khai
- **Mục tiêu:** 
  - Viết Dockerfile, docker-compose cho Kafka, PostgreSQL, worker.
  - Tích hợp CI/CD pipeline, script setup/test/deploy.
- **Đầu ra:** 
  - File Dockerfile, docker-compose, hướng dẫn chạy local/dev/prod.
- **Tiêu chí hoàn thành:** Có thể chạy toàn bộ hệ thống local/dev/prod, tích hợp CI/CD.

### Giai đoạn 10: Refactor, Test, Document
- **Mục tiêu:** 
  - Refactor code, bổ sung test, hoàn thiện tài liệu.
  - Refactor để dùng package chung cho config/logger/connection.
  - Thêm healthcheck, metrics, structured logging.
- **Đầu ra:** 
  - Unit test, integration test, tài liệu hướng dẫn.
- **Tiêu chí hoàn thành:** Đảm bảo code sạch, dễ bảo trì, có test/tài liệu, tuân thủ chuẩn hệ thống.

---
