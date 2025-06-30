// Worker - Khung module worker xử lý job từ Kafka
// Đảm nhiệm phân luồng pipeline cho từng loại job: price, metadata, audit
// Triển khai chi tiết ở giai đoạn sau

import { KafkaConsumer, KafkaJobPayload } from "./kafka/consumer";
import { JobType } from "./models";
import { TopCoinFetcher } from "./fetchers/topCoinFetcher";
import { TrendingTokenFetcher } from "./fetchers/trendingTokenFetcher";
import { Database } from "./db/index";
import { Logger } from "./logger";

export class Worker {
  private consumer: KafkaConsumer;
  private db: Database;
  private logger: Logger;
  private topCoinFetcher: TopCoinFetcher;
  private trendingTokenFetcher: TrendingTokenFetcher;

  constructor() {
    this.consumer = new KafkaConsumer();
    this.db = new Database();
    this.logger = new Logger();
    this.topCoinFetcher = new TopCoinFetcher();
    this.trendingTokenFetcher = new TrendingTokenFetcher();
  }

  // Khởi động worker, lắng nghe các topic
  async start() {
    const topics = [
      "price-crawler.price.request",
      "price-crawler.metadata.request",
      "price-crawler.audit.request",
    ];
    await this.consumer.connect(topics);
    await this.consumer.onMessage(async (topic, payload) => {
      await this.handleJob(topic, payload);
    });
    console.log("[Worker] Started and listening for jobs...");
  }

  // Xử lý pipeline cho từng loại job - thực hiện gọi đến các job đã thiết kế
  async handleJob(topic: string, payload: KafkaJobPayload) {
    switch (payload.job_type) {
      case JobType.PRICE:
        console.log(`[Worker] Handle PRICE job from ${topic}:`, payload);
        break;
      case JobType.METADATA:
        console.log(`[Worker] Handle METADATA job from ${topic}:`, payload);
        break;
      case JobType.AUDIT:
        console.log(`[Worker] Handle AUDIT job from ${topic}:`, payload);
        break;
      default:
        this.logger.warn("Unknown job type", payload.job_type);
    }
  }
}
