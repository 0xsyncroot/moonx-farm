import { createKafka, createKafkaConfig } from '@moonx-farm/infrastructure';
import { createLoggerForAnyService } from '@moonx-farm/common';

const logger = createLoggerForAnyService('kafka-event-publisher');

export interface SyncEvent {
  type: 'sync.completed' | 'sync.failed' | 'sync.started' | 'portfolio.updated';
  userId: string;
  walletAddress: string;
  data: Record<string, any>;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PortfolioUpdateEvent extends SyncEvent {
  type: 'portfolio.updated';
  data: {
    totalValueUsd: number;
    totalTokens: number;
    totalChains: number;
    tokens: Array<{
      symbol: string;
      valueUsd: number;
      change24h?: number;
    }>;
    syncDuration: number;
    syncOperationId: string;
  };
}

export interface SyncCompletedEvent extends SyncEvent {
  type: 'sync.completed';
  data: {
    syncOperationId: string;
    processingTime: number;
    tokensSync: number;
    chainsSync: number;
    totalValueUsd: number;
    success: boolean;
  };
}

export interface SyncFailedEvent extends SyncEvent {
  type: 'sync.failed';
  data: {
    syncOperationId: string;
    error: string;
    processingTime: number;
    retryCount: number;
  };
}

export class KafkaEventPublisher {
  private kafka: any;
  private isConnected = false;

  // Kafka topics for different event types
  private readonly TOPICS = {
    PORTFOLIO_UPDATES: 'portfolio.updates',
    SYNC_EVENTS: 'sync.events',
    SYSTEM_ALERTS: 'system.alerts',
    USER_ACTIVITIES: 'user.activities',
  };

  constructor() {
    // Initialize Kafka using shared infrastructure
    const kafkaConfig = createKafkaConfig();
    this.kafka = createKafka({
      ...kafkaConfig,
      clientId: 'sync-worker-publisher',
    });

    logger.info('KafkaEventPublisher initialized with shared infrastructure');
  }

  async initialize(): Promise<void> {
    if (this.isConnected) return;

    try {
      await this.kafka.connect();
      this.isConnected = true;
      logger.info('✅ Kafka event publisher connected');
    } catch (error) {
      logger.error('❌ Failed to connect Kafka event publisher', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.kafka.disconnect();
      this.isConnected = false;
      logger.info('Kafka event publisher disconnected');
    } catch (error) {
      logger.error('Error disconnecting Kafka event publisher', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Publish sync completed event
   */
  async publishSyncCompleted(
    userId: string,
    walletAddress: string,
    syncData: {
      syncOperationId: string;
      processingTime: number;
      tokensSync: number;
      chainsSync: number;
      totalValueUsd: number;
    }
  ): Promise<void> {
    if (!this.isConnected) {
      logger.warn('Kafka not connected, skipping sync completed event');
      return;
    }

    try {
      const event: SyncCompletedEvent = {
        type: 'sync.completed',
        userId,
        walletAddress,
        data: {
          ...syncData,
          success: true,
        },
        timestamp: Date.now(),
        metadata: {
          source: 'sync-worker',
          version: '1.0.0',
        },
      };

      await this.kafka.publish(event, {
        topic: this.TOPICS.SYNC_EVENTS,
        key: userId,
        headers: {
          'event-type': 'sync.completed',
          'source': 'sync-worker',
        },
      });

      logger.info('📢 Sync completed event published', {
        userId,
        syncOperationId: syncData.syncOperationId,
        processingTime: syncData.processingTime,
      });

    } catch (error) {
      logger.error('❌ Failed to publish sync completed event', {
        userId,
        syncOperationId: syncData.syncOperationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Publish sync failed event
   */
  async publishSyncFailed(
    userId: string,
    walletAddress: string,
    failData: {
      syncOperationId: string;
      error: string;
      processingTime: number;
      retryCount: number;
    }
  ): Promise<void> {
    if (!this.isConnected) {
      logger.warn('Kafka not connected, skipping sync failed event');
      return;
    }

    try {
      const event: SyncFailedEvent = {
        type: 'sync.failed',
        userId,
        walletAddress,
        data: failData,
        timestamp: Date.now(),
        metadata: {
          source: 'sync-worker',
          version: '1.0.0',
        },
      };

      await this.kafka.publish(event, {
        topic: this.TOPICS.SYNC_EVENTS,
        key: userId,
        headers: {
          'event-type': 'sync.failed',
          'source': 'sync-worker',
        },
      });

      logger.info('📢 Sync failed event published', {
        userId,
        syncOperationId: failData.syncOperationId,
        error: failData.error,
      });

    } catch (error) {
      logger.error('❌ Failed to publish sync failed event', {
        userId,
        syncOperationId: failData.syncOperationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Publish portfolio updated event
   */
  async publishPortfolioUpdated(
    userId: string,
    walletAddress: string,
    portfolioData: {
      totalValueUsd: number;
      totalTokens: number;
      totalChains: number;
      tokens: Array<{
        symbol: string;
        valueUsd: number;
        change24h?: number;
      }>;
      syncDuration: number;
      syncOperationId: string;
    }
  ): Promise<void> {
    if (!this.isConnected) {
      logger.warn('Kafka not connected, skipping portfolio updated event');
      return;
    }

    try {
      const event: PortfolioUpdateEvent = {
        type: 'portfolio.updated',
        userId,
        walletAddress,
        data: portfolioData,
        timestamp: Date.now(),
        metadata: {
          source: 'sync-worker',
          version: '1.0.0',
        },
      };

      await this.kafka.publish(event, {
        topic: this.TOPICS.PORTFOLIO_UPDATES,
        key: userId,
        headers: {
          'event-type': 'portfolio.updated',
          'source': 'sync-worker',
        },
      });

      logger.info('📢 Portfolio updated event published', {
        userId,
        syncOperationId: portfolioData.syncOperationId,
        totalValueUsd: portfolioData.totalValueUsd,
        totalTokens: portfolioData.totalTokens,
      });

    } catch (error) {
      logger.error('❌ Failed to publish portfolio updated event', {
        userId,
        syncOperationId: portfolioData.syncOperationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Publish user activity event
   */
  async publishUserActivity(
    userId: string,
    activityType: 'sync_triggered' | 'portfolio_viewed' | 'manual_sync',
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.isConnected) {
      logger.warn('Kafka not connected, skipping user activity event');
      return;
    }

    try {
      const event: SyncEvent = {
        type: 'sync.started', // Generic type for user activity
        userId,
        walletAddress: '', // Not always available for activity events
        data: {
          activityType,
          timestamp: Date.now(),
          ...metadata,
        },
        timestamp: Date.now(),
        metadata: {
          source: 'sync-worker',
          version: '1.0.0',
        },
      };

      await this.kafka.publish(event, {
        topic: this.TOPICS.USER_ACTIVITIES,
        key: userId,
        headers: {
          'event-type': 'user.activity',
          'activity-type': activityType,
          'source': 'sync-worker',
        },
      });

      logger.debug('📢 User activity event published', {
        userId,
        activityType,
      });

    } catch (error) {
      logger.error('❌ Failed to publish user activity event', {
        userId,
        activityType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Publish system alert
   */
  async publishSystemAlert(
    alertType: 'high_error_rate' | 'service_degradation' | 'maintenance',
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.isConnected) {
      logger.warn('Kafka not connected, skipping system alert');
      return;
    }

    try {
      const event: SyncEvent = {
        type: 'sync.failed', // Generic type for system alerts
        userId: 'system',
        walletAddress: '',
        data: {
          alertType,
          message,
          severity,
          timestamp: Date.now(),
          ...metadata,
        },
        timestamp: Date.now(),
        metadata: {
          source: 'sync-worker',
          version: '1.0.0',
        },
      };

      await this.kafka.publish(event, {
        topic: this.TOPICS.SYSTEM_ALERTS,
        key: `system_${alertType}`,
        headers: {
          'event-type': 'system.alert',
          'alert-type': alertType,
          'severity': severity,
          'source': 'sync-worker',
        },
      });

      logger.warn('🚨 System alert published', {
        alertType,
        severity,
        message,
      });

    } catch (error) {
      logger.error('❌ Failed to publish system alert', {
        alertType,
        severity,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Batch publish events for better performance
   */
  async publishBatch(events: SyncEvent[]): Promise<void> {
    if (!this.isConnected || events.length === 0) {
      return;
    }

    try {
      const publishPromises = events.map(event => {
        let topic = this.TOPICS.SYNC_EVENTS; // Default topic

        // Route to appropriate topic based on event type
        switch (event.type) {
          case 'portfolio.updated':
            topic = this.TOPICS.PORTFOLIO_UPDATES;
            break;
          case 'sync.completed':
          case 'sync.failed':
          case 'sync.started':
            topic = this.TOPICS.SYNC_EVENTS;
            break;
        }

        return this.kafka.publish(event, {
          topic,
          key: event.userId,
          headers: {
            'event-type': event.type,
            'source': 'sync-worker',
          },
        });
      });

      await Promise.all(publishPromises);

      logger.info('📢 Batch events published', {
        eventCount: events.length,
      });

    } catch (error) {
      logger.error('❌ Failed to publish batch events', {
        eventCount: events.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    try {
      return this.isConnected && await this.kafka.isHealthy();
    } catch (error) {
      logger.error('Kafka event publisher health check failed', { error });
      return false;
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    connected: boolean;
    topics: Record<string, string>;
    metrics?: any;
  } {
    return {
      connected: this.isConnected,
      topics: this.TOPICS,
      metrics: this.kafka.getMetrics ? this.kafka.getMetrics() : undefined,
    };
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown(): Promise<void> {
    logger.info('📢 Graceful shutdown of Kafka event publisher...');
    
    try {
      await this.disconnect();
      logger.info('📢 Kafka event publisher shutdown completed');
    } catch (error) {
      logger.error('❌ Error during Kafka event publisher shutdown', { error });
      throw error;
    }
  }
} 