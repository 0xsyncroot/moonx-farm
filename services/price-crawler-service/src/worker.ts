// Worker - Khung module worker xử lý job từ Kafka
// Đảm nhiệm phân luồng pipeline cho từng loại job: price, metadata, audit
// Triển khai chi tiết ở giai đoạn sau

import { KafkaConsumer, KafkaJobPayload } from "./kafka/consumer";
import { JobType, TokenType } from "./models";
import { TopCoinFetcher } from "./fetchers/topCoinFetcher";
import { TrendingTokenFetcher } from "./fetchers/trendingTokenFetcher";
import { Database } from "./db/index";
import { Logger } from "./logger";
import { handleTrendingJob } from "./worker/trending_profile_db.worker";
import { handleTopJob } from "./worker/top_profile_db.worker";
import { JobMessage } from "./types/job_message";
import configs = require("./config");

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
    // Phân loại job theo topic, lấy dữ liệu top coin hoặc trending token theo TokenType
    const { job_type, token_type, contracts, symbols , chain_id} = payload;

    try {
      if (token_type === TokenType.TOP) {
        let profiles = await this.topCoinFetcher.getTopCoins(configs.TopLimit || 100);
        if (profiles.length === 0) {
          this.logger.warn("No top coins found");
          return;
        }
        //duyệt danh sách top coin và xử lý job
        for (const profile of profiles) {
          //tạo đối tượng JobMessage cho từng top coin
          const jobMessage: JobMessage = {
            job_type: job_type as JobType, //ép kiểu từ string sang JobType
            token_type: TokenType.TOP,
            chain: profile.chain,
            address: profile.address,
            coingeckoId: profile.coingeckoId,
            timestamp: new Date().toISOString()
          };
          handleTopJob(jobMessage);
        }
        
      } else if (token_type === TokenType.TRENDING) {

        let profiles = await this.trendingTokenFetcher.getTrendingTokens(chain_id, configs.TrendingLimit || 20);
        if (profiles.length === 0) {
          this.logger.warn("No trending tokens found");
          return;
        }
        //duyệt danh sách trending token và xử lý job
        for (const profile of profiles) {
          //tạo đối tượng JobMessage cho từng trending token
          const jobMessage: JobMessage = {
            job_type: job_type as JobType, //ép kiểu từ string sang JobType
            token_type: TokenType.TRENDING,
            chain: profile.chain,
            address: profile.address,
            coingeckoId: profile.coingeckoId,
            timestamp: new Date().toISOString()
          };
          handleTrendingJob(jobMessage);
        }
      }
      
    } catch (error) {
      this.logger.error( "Error processing job", error);
    }
  }
}
