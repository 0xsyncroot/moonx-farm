// Kafka Consumer - Khung module worker nhận job từ Kafka topic
// Triển khai chi tiết ở giai đoạn sau

export interface KafkaJobPayload {
  job_type: string;
  token_type: string;
  symbols?: string[];
  contracts?: string[];
  timestamp: string;
  [key: string]: any;
}

import { Kafka, Consumer } from "kafkajs";
import configs from "../config";

export class KafkaConsumer {
  private consumer: Consumer | null = null;
  private kafka: Kafka | null = null;

  async connect(topics: string[]): Promise<void> {
    this.kafka = new Kafka({
      clientId: configs.kafka.consumerConfig.clientId || "price-crawler-consumer",
      brokers: configs.kafka.consumerConfig.brokers || ["localhost:9092"],
    });
    this.consumer = this.kafka.consumer({ groupId: "price-crawler-group" });
    await this.consumer.connect();
    for (const topic of topics) {
      await this.consumer.subscribe({ topic, fromBeginning: false });
    }
    console.log("[KafkaConsumer] Connected and subscribed to topics:", topics);
  }

  async onMessage(handler: (topic: string, payload: KafkaJobPayload) => Promise<void>): Promise<void> {
    if (!this.consumer) throw new Error("Consumer not connected");
    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (message.value) {
          const payload = JSON.parse(message.value.toString());
          console.log(`[KafkaConsumer] Received message from ${topic}:`, payload);
          await handler(topic, payload);
        }
      },
    });
  }
}
