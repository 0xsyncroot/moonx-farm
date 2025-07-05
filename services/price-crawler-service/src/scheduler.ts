// Scheduler - Khung module lập lịch job (node-cron)
// Triển khai chi tiết ở giai đoạn sau

/**
 * Định nghĩa các loại job, lịch chạy, mapping với Kafka Topic.
 */

import { KafkaProducer, KafkaJobMessage } from "./kafka/producer";
import { JobType, TokenType, KafkaTopic } from "./models";
import configs from "./config";
// Thư viện cron để lập lịch job
import cron from "node-cron";
import { ChainMap } from "types/chain_map";

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

    // Khởi tạo các job định kỳ
    await this.initScheduledJobs();

    console.log("Scheduler started. Cronjobs registered.");
  }

  /**
   * Hàm khởi tạo các job định kỳ
   */
  async initScheduledJobs() {
    // Price - Top 100: mỗi 5s
    cron.schedule(configs.scheduler.priceCron || "*/5 * * * * *", async () => {
      await this.runJob(JobType.PRICE, TokenType.TOP);
    });

    // Metadata - Top 100: mỗi 24h
    cron.schedule(configs.scheduler.metadataCron || "0 0 * * *", async () => {
      await this.runJob(JobType.METADATA, TokenType.TOP);
    });

    // Lấy danh sách chain
    const chains = configs.chainIdMap;
    // Metadata - Trending: mỗi 1 phút
    cron.schedule(
      configs.scheduler.metadataCron || "*/60 * * * * *",
      async () => {
        // Lặp qua từng chain để lấy trending token metadata
        for (const chain of chains) {
          await this.runJob(JobType.METADATA, TokenType.TRENDING, chain);
        }
      }
    );

    // Price: mỗi 1 phút
    cron.schedule(configs.scheduler.priceCron || "*/60 * * * * *", async () => {
      // Lặp qua từng chain để lấy trending token
      for (const chain of chains) {
        await this.runJob(JobType.PRICE, TokenType.TRENDING, chain);
      }
    });

    // Audit - Trending: sau price/meta (demo: mỗi 2 phút)
    cron.schedule(
      configs.scheduler.auditCron || "*/120 * * * * *",
      async () => {
        // Lặp qua từng chain để lấy trending token audit
        for (const chain of chains) {
          await this.runJob(JobType.AUDIT, TokenType.TRENDING, chain);
        }
      }
    );
  }

  // Hàm chạy tất cả các job khởi tạo khi service khởi động
  async runAllJobsOnStartup() {
    console.log("[START] Scheduler Run All Jobs On Startup.");
    try {
      await this.runJob(JobType.METADATA, TokenType.TOP);

      // delay 10s để đảm bảo metadata đã được cập nhật
      await new Promise((resolve) =>
        setTimeout(resolve, configs.DelayConfigAtStart.top.price || 10000)
      );

      await this.runJob(JobType.PRICE, TokenType.TOP);

      //trending
      const chains = configs.chainIdMap;

      for (const chain of chains) {
        await this.runJob(JobType.METADATA, TokenType.TRENDING, chain);

        // delay 5s để đảm bảo metadata đã được cập nhật
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            configs.DelayConfigAtStart.trending.price || 10000
          )
        );

        await this.runJob(JobType.PRICE, TokenType.TRENDING, chain);

        // delay 5s để đảm bảo price đã được cập nhật
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            configs.DelayConfigAtStart.trending.audit || 60000
          )
        );

        await this.runJob(JobType.AUDIT, TokenType.TRENDING, chain);
      }
    } catch (error) {
      console.error("[Scheduler] Error running all jobs on startup:", error);
    }

    console.log("[END] Scheduler Run All Jobs On Startup.");
  }

  // Hàm chạy một job cụ thể (ví dụ: crawl top coin price)
  async runJob(jobType: JobType, tokenType: TokenType, chain?: ChainMap) {
    // Tạo message mẫu
    const message: KafkaJobMessage = {
      job_type: jobType,
      token_type: tokenType,
      symbols: [],
      chain: chain, // Chỉ sử dụng cho trending token
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
