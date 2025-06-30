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
- **Giai đoạn 4: Data Fetcher & API Integration** — 100% hoàn thành
- **Giai đoạn 5: Database Access & Upsert Logic** —  
  - [x] Thiết kế lại schema bảng tokens, token_prices, token_audits, job_logs theo đúng chuẩn dữ liệu thực tế từ code mẫu (get_top.js, trending_token_full_profile.js), bổ sung đầy đủ các trường động (contracts, socials, tags, markets, ...), phân biệt rõ token_type (top/trending).
  - [x] Đã cập nhật các entity và hàm upsert tương thích hoàn toàn với schema mới, đảm bảo lưu trữ đầy đủ property cho cả top/trending token, multi-chain, socials, markets, audit, v.v.
  - [x] Đã cập nhật pipeline worker thực tế và pipeline test cho cả trending và top token.
  - [x] Đã cập nhật changelog, hướng dẫn migrate schema mới.
  - [x] Đã kiểm thử pipeline upsert dữ liệu mẫu thành công.
  - [x] Đã log thao tác vào job_logs.
  - **Tình trạng:** ĐÃ HOÀN THÀNH checklist giai đoạn 5, sẵn sàng chuyển sang giai đoạn tiếp theo.

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

#### Phân biệt pipeline chính và pipeline test

- **Pipeline chính (production):**
  - `src/worker/trending_profile_db.worker.ts`: Worker thực tế, fetch + chuẩn hóa + upsert vào DB + log job_logs. Dùng cho production.
  - (Sẽ có pipeline tương tự cho top token: `src/worker/top_profile_db.worker.ts`)

- **Pipeline test/mock:**
  - `src/worker/trending_profile.worker.ts`: Chỉ fetch và chuẩn hóa dữ liệu, không ghi vào DB. Dùng để kiểm thử fetcher, chuẩn hóa dữ liệu, mock/test pipeline.
  - (Sẽ có pipeline tương tự cho top token: `src/worker/top_profile.worker.ts`)

-------
- **Mục tiêu:** 
  - Kết nối PostgreSQL qua package DB chung của project (@moonx/infrastructure hoặc tương đương).
  - Cài đặt upsert cho bảng tokens, token_prices, token_audits.
- **Đầu ra:** 
  - Module DB, hàm upsert, migration/schema chuẩn.
- **Checklist chi tiết:**
  - [ ] Sử dụng package DB chung để kết nối PostgreSQL (DATABASE_URL).
  - [ ] Đảm bảo migration/schema cho các bảng: tokens, token_prices, token_audits.
  - [ ] Viết hàm upsert cho từng bảng (tokens, token_prices, token_audits) theo logic: insert nếu chưa có, update nếu đã tồn tại (theo contract key hoặc unique constraint).
  - [ ] Worker gọi fetcher → chuẩn hóa dữ liệu → gọi hàm upsert lưu vào DB.
  - [ ] Log thao tác thành công/lỗi vào job_logs.
  - [ ] Viết script test pipeline: fetch dữ liệu mẫu → upsert vào DB → kiểm tra dữ liệu.
  - [ ] Đảm bảo worker lưu dữ liệu thành công, không trùng lặp, đúng logic.
- **Tiêu chí hoàn thành:** 
  - Đã kết nối DB thành công.
  - Đã có migration/schema chuẩn.
  - Đã có hàm upsert cho từng bảng.
  - Worker lưu dữ liệu thành công, log thao tác vào job_logs.

### Giai đoạn 6: Xử lý logic từng loại Job (Top & Trending)

#### Tiến độ & xác nhận checklist

- [x] Đã hoàn thiện worker cho **top token** và **trending token** (metadata, price, audit).
- [x] Đã chuẩn hóa nhận message từ Kafka topic, phân biệt job_type, token_type.
- [x] Đã đảm bảo tuần tự chuẩn: Lập lịch (scheduler) → gửi job lên Kafka topic → Kafka consumer worker nhận và xử lý → Call API fetch dữ liệu → map dữ liệu chuẩn hóa → lưu trữ vào DB (tokens, token_prices, token_audits).
- [x] Đã loại trừ stablecoin, chỉ lấy giá USDT.
- [x] Đã đảm bảo audit chỉ chạy sau khi đã có price/meta với trending token.
- [x] Đã structured logging, log trạng thái vào job_logs, dùng logger chuẩn.
- [x] Đã viết script test end-to-end pipeline trending, kiểm tra kết quả DB và log.
- [x] Đã đảm bảo không trùng lặp dữ liệu, đúng logic upsert, dùng config/DB/package chung.

#### Checklist xác nhận từng bước pipeline (cho cả Top/Trending, đủ Meta/Price/Audit):

| Bước                | Top Token (Meta/Price) | Trending Token (Meta/Price/Audit) |
|---------------------|:---------------------:|:---------------------------------:|
| Lập lịch (Scheduler)|          ✅           |                ✅                 |
| Gửi Kafka topic     |          ✅           |                ✅                 |
| Kafka Consumer      |          ✅           |                ✅                 |
| Call API            |          ✅           |                ✅                 |
| Map dữ liệu         |          ✅           |                ✅                 |
| Lưu DB              |          ✅           |                ✅                 |
| Audit (nếu có)      |          ❌           |                ✅                 |

- **Lưu ý:** Audit chỉ áp dụng cho trending token.

#### Kết luận

- Đã hoàn thiện đầy đủ pipeline cho cả top/trending token, mỗi loại đều có đủ metadata, price, audit (trending).
- Toàn bộ luồng đã đáp ứng đúng tuần tự chuẩn: Scheduler → Kafka topic → Kafka consumer worker → Call API → map dữ liệu → lưu trữ dữ liệu.
- Đã kiểm thử end-to-end, log/tracking đầy đủ, sẵn sàng chuyển sang giai đoạn tiếp theo.


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
