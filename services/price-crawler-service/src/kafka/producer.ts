// Kafka Producer - Khung module gửi job lên Kafka topic
// Triển khai chi tiết ở giai đoạn sau

export interface KafkaJobMessage {
  job_type: string;
  token_type: string;
  symbols?: string[];
  contracts?: string[];
  timestamp: string;
  [key: string]: any;
}

import { Kafka, Producer } from "kafkajs";

export class KafkaProducer {
  private producer: Producer | null = null;
  private kafka: Kafka | null = null;

  async connect(): Promise<void> {
    this.kafka = new Kafka({
      clientId: "price-crawler-producer",
      brokers: ["localhost:9092"], // TODO: lấy từ config
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
