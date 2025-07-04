import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { logger } from '../utils/logger';
import { NotificationProcessor } from './notificationProcessor';

interface KafkaConfig {
  brokers: string[];
  groupId: string;
  clientId: string;
}

interface TopicHandlers {
  [topic: string]: (message: any) => Promise<void>;
}

export class KafkaConsumerPool {
  private kafka: Kafka;
  private consumers: Map<string, Consumer> = new Map();
  private config: KafkaConfig;
  private notificationProcessor: NotificationProcessor;
  private isRunning: boolean = false;
  private topics: string[] = [];

  constructor(config: KafkaConfig, notificationProcessor: NotificationProcessor) {
    this.config = config;
    this.notificationProcessor = notificationProcessor;
    
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 5
      }
    });
  }

  async start(topicHandlers: TopicHandlers): Promise<void> {
    try {
      this.topics = Object.keys(topicHandlers);
      
      // Create consumer for each topic
      for (const topic of this.topics) {
        const consumer = this.kafka.consumer({ 
          groupId: `${this.config.groupId}-${topic}`,
          sessionTimeout: 30000,
          heartbeatInterval: 3000
        });

        await consumer.connect();
        await consumer.subscribe({ topic, fromBeginning: false });

        // Set up message handler
        await consumer.run({
          eachMessage: async (payload: EachMessagePayload) => {
            await this.handleMessage(payload, topicHandlers[topic]);
          }
        });

        this.consumers.set(topic, consumer);
        logger.info(`Kafka consumer started for topic: ${topic}`);
      }

      this.isRunning = true;
      logger.info('Kafka consumer pool started successfully');
    } catch (error) {
      logger.error('Error starting Kafka consumer pool:', error);
      throw error;
    }
  }

  private async handleMessage(
    payload: EachMessagePayload,
    handler: (message: any) => Promise<void>
  ): Promise<void> {
    try {
      const message = JSON.parse(payload.message.value?.toString() || '{}');
      
      // Add metadata
      message.metadata = {
        topic: payload.topic,
        partition: payload.partition,
        offset: payload.message.offset,
        timestamp: payload.message.timestamp,
        receivedAt: Date.now()
      };

      // Process message
      await handler(message);
      
      // Track metrics
      await this.notificationProcessor.trackProcessedMessage(
        payload.topic,
        'success',
        Date.now() - Number(payload.message.timestamp)
      );

      logger.debug(`Message processed successfully from topic: ${payload.topic}`);
    } catch (error) {
      logger.error(`Error processing message from topic ${payload.topic}:`, error);
      
      // Track error
      await this.notificationProcessor.trackProcessedMessage(
        payload.topic,
        'error',
        Date.now() - Number(payload.message.timestamp)
      );

      // TODO: Send to dead letter queue
      await this.sendToDeadLetterQueue(payload, error);
    }
  }

  private async sendToDeadLetterQueue(
    payload: EachMessagePayload,
    error: any
  ): Promise<void> {
    try {
      const producer = this.kafka.producer();
      await producer.connect();

      await producer.send({
        topic: `${payload.topic}-dlq`,
        messages: [{
          key: payload.message.key,
          value: JSON.stringify({
            originalMessage: payload.message.value?.toString(),
            error: error.message,
            timestamp: Date.now(),
            topic: payload.topic,
            partition: payload.partition,
            offset: payload.message.offset
          })
        }]
      });

      await producer.disconnect();
      logger.info(`Message sent to dead letter queue: ${payload.topic}-dlq`);
    } catch (dlqError) {
      logger.error('Error sending message to dead letter queue:', dlqError);
    }
  }

  async stop(): Promise<void> {
    try {
      for (const [topic, consumer] of this.consumers) {
        await consumer.disconnect();
        logger.info(`Kafka consumer stopped for topic: ${topic}`);
      }

      this.consumers.clear();
      this.isRunning = false;
      logger.info('Kafka consumer pool stopped');
    } catch (error) {
      logger.error('Error stopping Kafka consumer pool:', error);
    }
  }

  isHealthy(): boolean {
    return this.isRunning && this.consumers.size === this.topics.length;
  }

  getConsumerStats(): any {
    return {
      totalConsumers: this.consumers.size,
      topics: this.topics,
      isRunning: this.isRunning,
      consumers: Array.from(this.consumers.entries()).map(([topic, consumer]) => ({
        topic,
        connected: true // TODO: Check actual connection status
      }))
    };
  }
} 