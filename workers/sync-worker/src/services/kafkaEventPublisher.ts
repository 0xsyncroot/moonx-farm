/**
 * Kafka Event Publisher for Sync Worker
 * - Uses shared events system from @moonx-farm/infrastructure
 * - Publishes sync-related events with proper envelope pattern
 * - Type-safe event publishing
 */

import { 
  KafkaEventPublisher,
  EventPublisherConfig,
  EventFactory,
  DefaultPartitionStrategy,
  DefaultDataClassificationStrategy,
  EventFactoryOptions,
  DataClassification
} from '@moonx-farm/infrastructure';
import { createLoggerForAnyService } from '@moonx-farm/common';

const logger = createLoggerForAnyService('kafka-event-publisher');

// Sync Worker Event Types
export type SyncWorkerEventType = 
  | 'sync.started'
  | 'sync.completed'
  | 'sync.failed'
  | 'portfolio.updated'
  | 'user.activity'
  | 'system.alert';

// Sync Worker Event Data Types
export interface SyncStartedEventData {
  syncOperationId: string;
  userId: string;
  walletAddress: string;
  syncType: 'manual' | 'automatic' | 'scheduled';
  chains: string[];
  startedAt: number;
}

export interface SyncCompletedEventData {
  syncOperationId: string;
  userId: string;
  walletAddress: string;
  processingTime: number;
  tokensSync: number;
  chainsSync: number;
  totalValueUsd: number;
  success: boolean;
  completedAt: number;
}

export interface SyncFailedEventData {
  syncOperationId: string;
  userId: string;
  walletAddress: string;
  error: string;
  processingTime: number;
  retryCount: number;
  failedAt: number;
}

export interface PortfolioUpdatedEventData {
  syncOperationId: string;
  userId: string;
  walletAddress: string;
  totalValueUsd: number;
  totalTokens: number;
  totalChains: number;
  tokens: Array<{
    symbol: string;
    valueUsd: number;
    change24h?: number;
  }>;
  syncDuration: number;
  updatedAt: number;
}

export interface UserActivityEventData {
  userId: string;
  activityType: 'sync_triggered' | 'portfolio_viewed' | 'manual_sync';
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface SystemAlertEventData {
  alertType: 'high_error_rate' | 'service_degradation' | 'maintenance';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  service: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

/**
 * Sync Worker specific partition strategy
 */
export class SyncWorkerPartitionStrategy extends DefaultPartitionStrategy {
  override getPartitionKey(eventType: string, data: any, userId?: string): string {
    // For sync events, use userId for consistent partitioning
    if (eventType.startsWith('sync.') || eventType === 'portfolio.updated') {
      return data.userId || userId || 'default';
    }
    
    // For user activity, use userId
    if (eventType === 'user.activity') {
      return data.userId || userId || 'default';
    }
    
    // For system alerts, use service name
    if (eventType === 'system.alert') {
      return data.service || 'sync-worker';
    }
    
    return super.getPartitionKey(eventType, data, userId);
  }
}

/**
 * Sync Worker specific data classification strategy
 */
export class SyncWorkerDataClassificationStrategy extends DefaultDataClassificationStrategy {
  override getDataClassification(eventType: string, data: any): DataClassification {
    // Portfolio data is confidential
    if (eventType === 'portfolio.updated') {
      return 'confidential';
    }
    
    // Sync events contain user data
    if (eventType.startsWith('sync.')) {
      return 'confidential';
    }
    
    // User activities are internal
    if (eventType === 'user.activity') {
      return 'internal';
    }
    
    // System alerts are internal
    if (eventType === 'system.alert') {
      return 'internal';
    }
    
    return super.getDataClassification(eventType, data);
  }
}

export class SyncWorkerKafkaEventPublisher {
  private eventPublisher: KafkaEventPublisher;
  private eventFactory: EventFactory;
  private isInitialized = false;

  constructor() {
    // Configure event publisher
    const publisherConfig: EventPublisherConfig = {
      serviceName: 'sync-worker',
      serviceVersion: '1.0.0',
      kafka: {
        brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
        clientId: 'sync-worker-publisher',
      },
      topic: {
        main: 'moonx.ws.events',
        deadLetterQueue: 'moonx.ws.events.dlq',
      },
      options: {
        enableValidation: true,
        enableBatching: false,
        enableRetry: true,
        retryAttempts: 3,
        retryDelay: 1000,
      },
    };

    this.eventPublisher = new KafkaEventPublisher(publisherConfig);
    
    // Configure event factory with sync-worker specific strategies
    this.eventFactory = new EventFactory(
      'sync-worker',
      '1.0.0',
      new SyncWorkerPartitionStrategy(),
      new SyncWorkerDataClassificationStrategy()
    );

    logger.info('SyncWorkerKafkaEventPublisher initialized with shared infrastructure');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.eventPublisher.connect();
      this.isInitialized = true;
      logger.info('✅ Sync worker event publisher connected');
    } catch (error) {
      logger.error('❌ Failed to connect sync worker event publisher', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await this.eventPublisher.disconnect();
      this.isInitialized = false;
      logger.info('Sync worker event publisher disconnected');
    } catch (error) {
      logger.error('Error disconnecting sync worker event publisher', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Publish sync started event
   */
  async publishSyncStarted(
    syncOperationId: string,
    userId: string,
    walletAddress: string,
    syncType: 'manual' | 'automatic' | 'scheduled',
    chains: string[]
  ): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('Event publisher not initialized, skipping sync started event');
      return;
    }

    try {
      const eventData: SyncStartedEventData = {
        syncOperationId,
        userId,
        walletAddress,
        syncType,
        chains,
        startedAt: Date.now(),
      };

      await this.eventPublisher.publish('sync.started', eventData, {
        userId,
        correlationId: syncOperationId,
        context: {
          walletAddress,
          syncType,
          chains,
        },
      });

      logger.info('📢 Sync started event published', {
        syncOperationId,
        userId,
        syncType,
        chains: chains.length,
      });

    } catch (error) {
      logger.error('❌ Failed to publish sync started event', {
        syncOperationId,
        userId,
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
    if (!this.isInitialized) {
      logger.warn('Event publisher not initialized, skipping sync completed event');
      return;
    }

    try {
      const eventData: SyncCompletedEventData = {
        ...syncData,
        userId,
        walletAddress,
        success: true,
        completedAt: Date.now(),
      };

      await this.eventPublisher.publish('sync.completed', eventData, {
        userId,
        correlationId: syncData.syncOperationId,
        context: {
          walletAddress,
          processingTime: syncData.processingTime,
          totalValueUsd: syncData.totalValueUsd,
        },
      });

      logger.info('📢 Sync completed event published', {
        userId,
        syncOperationId: syncData.syncOperationId,
        processingTime: syncData.processingTime,
        totalValueUsd: syncData.totalValueUsd,
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
    if (!this.isInitialized) {
      logger.warn('Event publisher not initialized, skipping sync failed event');
      return;
    }

    try {
      const eventData: SyncFailedEventData = {
        ...failData,
        userId,
        walletAddress,
        failedAt: Date.now(),
      };

      await this.eventPublisher.publish('sync.failed', eventData, {
        userId,
        correlationId: failData.syncOperationId,
        context: {
          walletAddress,
          error: failData.error,
          retryCount: failData.retryCount,
        },
      });

      logger.info('📢 Sync failed event published', {
        userId,
        syncOperationId: failData.syncOperationId,
        error: failData.error,
        retryCount: failData.retryCount,
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
    if (!this.isInitialized) {
      logger.warn('Event publisher not initialized, skipping portfolio updated event');
      return;
    }

    try {
      const eventData: PortfolioUpdatedEventData = {
        ...portfolioData,
        userId,
        walletAddress,
        updatedAt: Date.now(),
      };

      await this.eventPublisher.publish('portfolio.updated', eventData, {
        userId,
        correlationId: portfolioData.syncOperationId,
        context: {
          walletAddress,
          totalValueUsd: portfolioData.totalValueUsd,
          totalTokens: portfolioData.totalTokens,
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
    if (!this.isInitialized) {
      logger.warn('Event publisher not initialized, skipping user activity event');
      return;
    }

    try {
      const eventData: UserActivityEventData = {
        userId,
        activityType,
        timestamp: Date.now(),
      };

      // Only add metadata if it exists
      if (metadata) {
        eventData.metadata = metadata;
      }

      await this.eventPublisher.publish('user.activity', eventData, {
        userId,
        context: {
          activityType,
          ...metadata,
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
    if (!this.isInitialized) {
      logger.warn('Event publisher not initialized, skipping system alert');
      return;
    }

    try {
      const eventData: SystemAlertEventData = {
        alertType,
        message,
        severity,
        service: 'sync-worker',
        timestamp: Date.now(),
      };

      // Only add metadata if it exists
      if (metadata) {
        eventData.metadata = metadata;
      }

      await this.eventPublisher.publish('system.alert', eventData, {
        context: {
          alertType,
          severity,
          message,
          service: 'sync-worker',
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
  async publishBatch(events: Array<{
    eventType: SyncWorkerEventType;
    data: any;
    options?: EventFactoryOptions;
  }>): Promise<void> {
    if (!this.isInitialized || events.length === 0) {
      return;
    }

    try {
      await this.eventPublisher.publishBatch(events);

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
      return this.isInitialized && await this.eventPublisher.healthCheck();
    } catch (error) {
      logger.error('Sync worker event publisher health check failed', { error });
      return false;
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    initialized: boolean;
    serviceName: string;
    serviceVersion: string;
    metrics?: any;
  } {
    return {
      initialized: this.isInitialized,
      serviceName: 'sync-worker',
      serviceVersion: '1.0.0',
      metrics: this.eventPublisher.getMetrics ? this.eventPublisher.getMetrics() : undefined,
    };
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown(): Promise<void> {
    logger.info('📢 Graceful shutdown of sync worker event publisher...');
    
    try {
      await this.disconnect();
      logger.info('📢 Sync worker event publisher shutdown completed');
    } catch (error) {
      logger.error('❌ Error during sync worker event publisher shutdown', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const syncWorkerEventPublisher = new SyncWorkerKafkaEventPublisher();

// Export class with alias for backward compatibility
export { SyncWorkerKafkaEventPublisher as KafkaEventPublisher }; 