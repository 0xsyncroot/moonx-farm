import { 
  KafkaManager, 
  ConsumerOptions 
} from '@moonx-farm/infrastructure';
import { createLogger } from '@moonx-farm/common';
import { NotificationProcessor } from './notificationProcessor';
import { kafkaService } from './kafkaService';

const logger = createLogger('KafkaConsumerPool');

interface TopicHandlers {
  [topic: string]: (message: any) => Promise<void>;
}

export class KafkaConsumerPool {
  private kafka: KafkaManager;
  private notificationProcessor: NotificationProcessor;
  private isRunning: boolean = false;
  private topics: string[] = [];
  private activeConsumers: Set<string> = new Set();

  constructor(notificationProcessor: NotificationProcessor) {
    this.notificationProcessor = notificationProcessor;
    
    // Use kafkaService singleton instead of creating own KafkaManager
    this.kafka = kafkaService.getKafka();
  }

  async start(topicHandlers: TopicHandlers): Promise<void> {
    try {
      // Ensure kafkaService is initialized
      if (!kafkaService.isInitialized()) {
        await kafkaService.initialize();
      }
      
      this.topics = Object.keys(topicHandlers);
      
      // Create consumer for each topic using infrastructure pattern
      for (const topic of this.topics) {
        const handler = topicHandlers[topic];
        
        // Fix TypeScript error - ensure handler exists
        if (!handler) {
          logger.warn(`No handler found for topic: ${topic}`);
          continue;
        }

        const consumerId = `notification-hub-${topic}`;
        const consumerOptions: ConsumerOptions = {
          groupId: `moonx-notification-hub-${topic}`,
          sessionTimeout: 30000,
          autoCommit: true,
          enableDeadLetterQueue: true,
          deadLetterQueueTopic: `${topic}-dlq`,
          isolationLevel: 'read_committed'
        };

        // Use infrastructure subscribe method
        await this.kafka.subscribe(
          consumerId,
          [topic],
          consumerOptions,
          async (topic: string, message: any, rawMessage: any) => {
            await this.handleMessage(topic, message, rawMessage, handler);
          }
        );

        this.activeConsumers.add(consumerId);
        logger.info(`Kafka consumer started for topic: ${topic}`);
      }

      this.isRunning = true;
      logger.info('Kafka consumer pool started successfully');
    } catch (error) {
      logger.error(`Error starting Kafka consumer pool: ${error}`);
      throw error;
    }
  }

  private async handleMessage(
    topic: string,
    message: any,
    rawMessage: any,
    handler: (message: any) => Promise<void>
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Add metadata to message
      const enrichedMessage = {
        ...message,
        metadata: {
          topic,
          partition: rawMessage.partition,
          offset: rawMessage.offset,
          timestamp: rawMessage.timestamp,
          receivedAt: startTime,
          key: rawMessage.key?.toString()
        }
      };

      // Process message with handler
      await handler(enrichedMessage);
      
      // Track success metrics
      const processingTime = Date.now() - startTime;
      await this.notificationProcessor.trackProcessedMessage(
        topic,
        'success',
        processingTime
      );

      logger.debug(`Message processed successfully from topic: ${topic} (partition: ${rawMessage.partition}, offset: ${rawMessage.offset}, time: ${processingTime}ms)`);
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error(`Error processing message from topic ${topic} (partition: ${rawMessage.partition}, offset: ${rawMessage.offset}, time: ${processingTime}ms): ${error}`);
      
      // Track error metrics
      await this.notificationProcessor.trackProcessedMessage(
        topic,
        'error',
        processingTime
      );

      // Infrastructure will handle Dead Letter Queue automatically
      // if enableDeadLetterQueue is true in consumer options
      throw error; // Re-throw to trigger DLQ
    }
  }

  async stop(): Promise<void> {
    try {
      // Infrastructure handles consumer cleanup automatically
      // Don't disconnect kafkaService here as it's shared singleton
      // Just clean up our state
      this.activeConsumers.clear();
      this.isRunning = false;
      logger.info('Kafka consumer pool stopped');
    } catch (error) {
      logger.error(`Error stopping Kafka consumer pool: ${error}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      return this.isRunning && await kafkaService.healthCheck();
    } catch (error) {
      logger.error(`Health check failed: ${error}`);
      return false;
    }
  }

  getConsumerStats(): any {
    const metrics = kafkaService.getMetrics();
    
    return {
      totalConsumers: this.activeConsumers.size,
      topics: this.topics,
      isRunning: this.isRunning,
      consumers: Array.from(this.activeConsumers).map(consumerId => ({
        consumerId,
        connected: this.isRunning
      })),
      metrics: {
        messagesConsumed: metrics.messagesConsumed,
        consumerErrors: metrics.consumerErrors,
        averageConsumeTime: metrics.averageConsumeTime,
        topicStats: metrics.topicStats
      }
    };
  }

  // Additional method to get detailed metrics
  getMetrics() {
    return kafkaService.getMetrics();
  }

  // Reset metrics for monitoring
  resetMetrics(): void {
    kafkaService.resetMetrics();
  }
} 