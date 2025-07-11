import { KafkaEventPublisher, EventPublisherConfig } from '@moonx-farm/infrastructure';
import { 
  ChainPerformanceStats,
  BridgeLatencyStats
} from '../types/index';
import { logger } from '../utils/logger';

// WebSocket message types for client updates
export interface ChainStatsMessage {
  type: 'chain_stats';
  chainId: number;
  chainName: string;
  stats: ChainPerformanceStats;
  timestamp: number;
}

export interface BridgeStatsMessage {
  type: 'bridge_stats';
  provider: string;
  stats: BridgeLatencyStats;
  timestamp: number;
}



export type WebSocketStatsMessage = ChainStatsMessage | BridgeStatsMessage;

export class StatsEventPublisher {
  private eventPublisher: KafkaEventPublisher;
  private isConnected: boolean = false;
  private publishMetrics = {
    totalEvents: 0,
    successfulEvents: 0,
    failedEvents: 0,
    lastPublishTime: 0
  };

  constructor(
    kafkaConfig: {
      brokers: string[];
      clientId: string;
      topicEvents: string;
    }
  ) {
    // Setup Kafka event publisher for WebSocket notifications
    const publisherConfig: EventPublisherConfig = {
      serviceName: 'stats-worker',
      serviceVersion: '1.0.0',
      kafka: {
        brokers: kafkaConfig.brokers,
        clientId: kafkaConfig.clientId,
      },
      topic: {
        main: kafkaConfig.topicEvents,
        deadLetterQueue: `${kafkaConfig.topicEvents}.dlq`,
      },
      options: {
        enableValidation: true,
        enableBatching: false,
        enableRetry: true,
        retryAttempts: 3,
      },
    };

    this.eventPublisher = new KafkaEventPublisher(publisherConfig);
  }

  /**
   * Initialize and connect to Kafka
   */
  async connect(): Promise<void> {
    try {
      await this.eventPublisher.connect();
      this.isConnected = true;
      
      logger.info('Stats event publisher connected to Kafka');
    } catch (error) {
      logger.error('Failed to connect stats event publisher', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    try {
      await this.eventPublisher.disconnect();
      this.isConnected = false;
      
      logger.info('Stats event publisher disconnected from Kafka');
    } catch (error) {
      logger.error('Failed to disconnect stats event publisher', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }



  /**
   * Publish chain stats for WebSocket clients
   */
  async publishChainStatsUpdate(
    chainStats: ChainPerformanceStats[]
  ): Promise<void> {
    for (const stats of chainStats) {
      const message: ChainStatsMessage = {
        type: 'chain_stats',
        chainId: stats.chainId,
        chainName: stats.chainName,
        stats,
        timestamp: Date.now()
      };

      await this.publishToWebSocket(message);
    }
  }

  /**
   * Publish bridge stats for WebSocket clients
   */
  async publishBridgeStatsUpdate(
    bridgeStats: BridgeLatencyStats[]
  ): Promise<void> {
    for (const stats of bridgeStats) {
      const message: BridgeStatsMessage = {
        type: 'bridge_stats',
        provider: stats.provider,
        stats,
        timestamp: Date.now()
      };

      await this.publishToWebSocket(message);
    }
  }

  /**
   * Publish message to WebSocket topic
   */
  private async publishToWebSocket(message: WebSocketStatsMessage): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Stats event publisher not connected');
    }

    try {
      const startTime = Date.now();
      
      // Publish using event publisher for WebSocket gateway
      await this.eventPublisher.publish(
        `moonx.ws.${message.type}`,
        message,
        {
          correlationId: `stats-${message.type}-${Date.now()}`,
          userId: 'system'
        }
      );

      // Update metrics
      this.updateMetrics(true, Date.now() - startTime);
      
      logger.debug('Stats message published to WebSocket', {
        messageType: message.type,
        timestamp: message.timestamp,
        duration: Date.now() - startTime
      });
    } catch (error) {
      this.updateMetrics(false);
      
      logger.error('Failed to publish stats message to WebSocket', {
        messageType: message.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new Error(
        `Failed to publish ${message.type} message: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update publishing metrics
   */
  private updateMetrics(success: boolean, duration?: number): void {
    this.publishMetrics.totalEvents++;
    
    if (success) {
      this.publishMetrics.successfulEvents++;
    } else {
      this.publishMetrics.failedEvents++;
    }
    
    this.publishMetrics.lastPublishTime = Date.now();
  }

  /**
   * Get publishing metrics
   */
  getMetrics() {
    return {
      ...this.publishMetrics,
      isConnected: this.isConnected,
      successRate: this.publishMetrics.totalEvents > 0 
        ? (this.publishMetrics.successfulEvents / this.publishMetrics.totalEvents) * 100 
        : 0
    };
  }

  /**
   * Health check for event publisher
   */
  async healthCheck(): Promise<boolean> {
    try {
      return this.isConnected && await this.eventPublisher.healthCheck();
    } catch {
      return false;
    }
  }

  /**
   * Get connection status
   */
  isHealthy(): boolean {
    return this.isConnected;
  }
} 