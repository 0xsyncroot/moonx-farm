// Kafka Producer - Khung module gửi job lên Kafka topic
// Triển khai chi tiết ở giai đoạn sau

export interface KafkaJobMessage {
  job_type: string;
  token_type: string;
  symbols?: string[];
  contracts?: string[];
  timestamp: string;
  chain_id?: string; // Chỉ sử dụng cho trending token
  [key: string]: any;
}

import { Kafka, Producer } from "kafkajs";
import configs from "../config";

export class KafkaProducer {
  private producer: Producer | null = null;
  private kafka: Kafka | null = null;

  async connect(): Promise<void> {
    this.kafka = new Kafka({
      clientId: configs.kafka.producerConfig.clientId || "price-crawler-producer",
      brokers: configs.kafka.producerConfig.brokers || ["localhost:9092"], // TODO: lấy từ config
    });
    this.producer = this.kafka.producer();
    await this.producer.connect();
    console.log("[KafkaProducer] Connected to Kafka");
  }

  async send(topic: string, message: KafkaJobMessage): Promise<void> {
    if (!this.producer) throw new Error("Producer not connected");
    await this.producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
    console.log(`[KafkaProducer] Sent message to ${topic}:`, message);
  }
}
