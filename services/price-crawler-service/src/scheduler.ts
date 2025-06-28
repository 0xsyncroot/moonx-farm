// Scheduler - Khung module lập lịch job (node-cron)
// Triển khai chi tiết ở giai đoạn sau

/**
 * Định nghĩa các loại job, lịch chạy, mapping với Kafka Topic.
 */

import { KafkaProducer, KafkaJobMessage } from "./kafka/producer";
import { JobType, TokenType, KafkaTopic } from "./models";
import { Config } from "./config";
import cron from "node-cron";

/**
 * Định nghĩa các loại job, lịch chạy, mapping với Kafka Topic.
 */

export class Scheduler {
  private producer: KafkaProducer;

  constructor() {
    this.producer = new KafkaProducer();
  }

  // Khởi tạo scheduler, đăng ký các cronjob
  async init() {
    await this.producer.connect();
    const config = Config.load();

    // Price - Top 100: mỗi 5s
    cron.schedule(config.scheduler.priceCron || "*/5 * * * * *", async () => {
      await this.runJob(JobType.PRICE, TokenType.TOP100);
    });

    // Metadata - Top 100: mỗi 24h
    cron.schedule(config.scheduler.metadataCron || "0 0 * * *", async () => {
      await this.runJob(JobType.METADATA, TokenType.TOP100);
    });

    // Price+Meta - Trending: mỗi 1 phút
    cron.schedule(config.scheduler.priceCron || "*/60 * * * * *", async () => {
      await this.runJob(JobType.PRICE, TokenType.TRENDING);
      await this.runJob(JobType.METADATA, TokenType.TRENDING);
    });

    // Audit - Trending: sau price/meta (demo: mỗi 2 phút)
    cron.schedule(config.scheduler.auditCron || "*/120 * * * * *", async () => {
      await this.runJob(JobType.AUDIT, TokenType.TRENDING);
    });

    console.log("Scheduler started. Cronjobs registered.");
  }

  // Hàm chạy một job cụ thể (ví dụ: crawl top coin price)
  async runJob(jobType: JobType, tokenType: TokenType) {
    // Tạo message mẫu
    const message: KafkaJobMessage = {
      job_type: jobType,
      token_type: tokenType,
      symbols: [],
      timestamp: new Date().toISOString(),
    };
    // Mapping topic
    let topic = "";
    switch (jobType) {
      case JobType.PRICE:
        topic = KafkaTopic.PRICE_REQUEST;
        break;
      case JobType.METADATA:
        topic = KafkaTopic.METADATA_REQUEST;
        break;
      case JobType.AUDIT:
        topic = KafkaTopic.AUDIT_REQUEST;
        break;
      default:
        topic = "unknown";
    }
    // Gửi message lên Kafka
    await this.producer.send(topic, message);
    console.log(`[Scheduler] Sent job to topic ${topic}:`, message);
  }
}
