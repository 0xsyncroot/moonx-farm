import { 
  KafkaManager, 
  createKafka, 
  createKafkaConfig,
  KafkaMetrics 
} from '@moonx-farm/infrastructure';
import { createLogger } from '@moonx-farm/common';

const logger = createLogger('KafkaService');

export class KafkaService {
  private kafka: KafkaManager;
  private isConnected: boolean = false;

  constructor() {
    const config = createKafkaConfig();
    this.kafka = createKafka(config);
  }

  async initialize(): Promise<void> {
    try {
      await this.kafka.connect();
      this.isConnected = true;
      logger.info('Kafka service initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize Kafka service: ${error}`);
      throw error;
    }
  }

  getKafka(): KafkaManager {
    return this.kafka;
  }

  async healthCheck(): Promise<boolean> {
    try {
      return this.isConnected && await this.kafka.isHealthy();
    } catch (error) {
      logger.error(`Kafka health check failed: ${error}`);
      return false;
    }
  }

  getMetrics(): KafkaMetrics {
    return this.kafka.getMetrics();
  }

  resetMetrics(): void {
    this.kafka.resetMetrics();
  }

  async shutdown(): Promise<void> {
    try {
      await this.kafka.disconnect();
      this.isConnected = false;
      logger.info('Kafka service shutdown completed');
    } catch (error) {
      logger.error(`Error during Kafka service shutdown: ${error}`);
    }
  }

  isInitialized(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const kafkaService = new KafkaService(); 