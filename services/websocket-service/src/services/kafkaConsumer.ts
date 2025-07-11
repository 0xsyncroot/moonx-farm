import { createKafka, EventEnvelope, EventHandlerContext } from '@moonx-farm/infrastructure';
import { createLogger } from '@moonx-farm/common';
import { websocketConfig } from '../config';
import { connectionManager } from './connectionManager';
import { WebSocketMessage } from '../types';
import { eventFactory } from '../utils/eventFactory';

const logger = createLogger('kafka-consumer');

// Generic event routing configuration
interface EventRoutingRule {
  eventTypePattern: string | RegExp;
  userExtractor?: (event: EventEnvelope<any>) => string | null;
  channelMapping?: string;
  messageTransformer?: (event: EventEnvelope<any>) => WebSocketMessage;
  filter?: (event: EventEnvelope<any>) => boolean;
}

// Default message transformer
function defaultMessageTransformer(event: EventEnvelope<any>): WebSocketMessage {
  const { metadata, data } = event;
  
  return {
    id: `${metadata.eventType}_${metadata.eventId}_${metadata.timestamp}`,
    type: metadata.eventType.replace('.', '_'), // Convert to websocket message type
    timestamp: metadata.timestamp,
    data: {
      ...data,
      eventId: metadata.eventId,
      correlationId: metadata.correlationId,
      source: metadata.source
    }
  };
}

// Default user extractor
function defaultUserExtractor(event: EventEnvelope<any>): string | null {
  return event.data.userId || event.metadata.userId || null;
}

/**
 * Generic Kafka Consumer Service
 * - Uses routing rules instead of hardcoded handlers
 * - Automatically forwards events based on patterns
 * - Extensible via configuration
 */
export class KafkaConsumerService {
  private kafka;
  private isRunning = false;
  private consumerId = 'websocket-consumer';
  private readonly mainTopic = websocketConfig.kafka.mainTopic;
  private readonly consumerGroup = websocketConfig.kafka.consumerGroup;
  private readonly processingMetrics = {
    totalProcessed: 0,
    successCount: 0,
    errorCount: 0,
    lastProcessedAt: 0,
  };

  // Generic routing rules - can be extended without code changes
  private routingRules: EventRoutingRule[] = [
    // Price events -> broadcast to prices channel
    {
      eventTypePattern: /^price\./,
      channelMapping: 'prices',
      messageTransformer: (event) => ({
        id: `price_${event.data.token}_${event.data.chainId}_${event.metadata.timestamp}`,
        type: 'price_update',
        timestamp: event.metadata.timestamp,
        data: event.data
      })
    },
    
    // Order events -> send to user + broadcast to orders channel
    {
      eventTypePattern: /^order\./,
      userExtractor: defaultUserExtractor,
      channelMapping: 'orders',
      messageTransformer: (event) => ({
        id: `order_${event.data.orderId}_${event.metadata.timestamp}`,
        type: 'order_update',
        timestamp: event.metadata.timestamp,
        data: event.data
      })
    },
    
    // Portfolio events -> send to user only
    {
      eventTypePattern: /^portfolio\./,
      userExtractor: defaultUserExtractor,
      messageTransformer: (event) => ({
        id: `portfolio_${event.data.userId}_${event.metadata.timestamp}`,
        type: 'portfolio_update',
        timestamp: event.metadata.timestamp,
        data: event.data
      })
    },
    
    // Trade events -> send to user + broadcast to trades channel
    {
      eventTypePattern: /^trade\./,
      userExtractor: defaultUserExtractor,
      channelMapping: 'trades',
      messageTransformer: (event) => ({
        id: `trade_${event.data.tradeId}_${event.metadata.timestamp}`,
        type: 'trade_update',
        timestamp: event.metadata.timestamp,
        data: event.data
      })
    },
    
    // Sync events -> send to user only
    {
      eventTypePattern: /^sync\./,
      userExtractor: defaultUserExtractor,
      messageTransformer: (event) => ({
        id: `sync_${event.data.syncOperationId}_${event.metadata.timestamp}`,
        type: 'sync_update',
        timestamp: event.metadata.timestamp,
        data: {
          ...event.data,
          status: event.metadata.eventType.split('.')[1] // started, completed, failed
        }
      })
    },
    
    // User activity events -> log only (no forwarding)
    {
      eventTypePattern: /^user\.activity/,
      filter: () => false, // Don't forward, just log
    },
    
    // System events -> log only (no forwarding)
    {
      eventTypePattern: /^system\./,
      filter: () => false, // Don't forward, just log
    },

    // Chain stats events from stats-worker -> broadcast to chain_stats channel ONLY
    {
      eventTypePattern: 'moonx.ws.chain_stats',
      channelMapping: 'chain_stats',
      userExtractor: () => null, // ✅ Don't extract userId - broadcast only
      messageTransformer: (event) => ({
        id: `chain_stats_${event.data.chainId}_${event.data.timestamp}`,
        type: 'chain_stats_update',
        timestamp: event.data.timestamp,
        data: {
          chainId: event.data.chainId,
          chainName: event.data.chainName,
          stats: event.data.stats,
          source: event.metadata.source
        }
      })
    },

    // Bridge stats events from stats-worker -> broadcast to bridge_stats channel ONLY
    {
      eventTypePattern: 'moonx.ws.bridge_stats',
      channelMapping: 'bridge_stats',
      userExtractor: () => null, // ✅ Don't extract userId - broadcast only
      messageTransformer: (event) => ({
        id: `bridge_stats_${event.data.provider}_${event.data.timestamp}`,
        type: 'bridge_stats_update',
        timestamp: event.data.timestamp,
        data: {
          provider: event.data.provider,
          stats: event.data.stats,
          source: event.metadata.source
        }
      })
    },

    // Stats overview events from stats-worker -> broadcast to stats_overview channel ONLY
    {
      eventTypePattern: 'moonx.ws.stats_overview',
      channelMapping: 'stats_overview',
      userExtractor: () => null, // ✅ Don't extract userId - broadcast only
      messageTransformer: (event) => ({
        id: `stats_overview_${event.data.timestamp}`,
        type: 'stats_overview_update',
        timestamp: event.data.timestamp,
        data: {
          overview: event.data.overview,
          chainCount: event.data.overview.chainPerformance?.length || 0,
          bridgeCount: event.data.overview.bridgeLatency?.length || 0,
          healthStatus: event.data.overview.healthStatus,
          lastUpdated: event.data.overview.lastUpdated,
          source: event.metadata.source
        }
      })
    }
  ];

  constructor() {
    this.kafka = createKafka({
      brokers: websocketConfig.kafka.brokers.split(',').map((b: string) => b.trim()),
      clientId: websocketConfig.kafka.clientId,
      connectionTimeout: 10000,
      requestTimeout: 30000,
      retry: {
        initialRetryTime: 100,
        retries: 8
      },
      logLevel: 'info'
    });
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.kafka.connect();
      logger.info('Generic Kafka consumer initialized', {
        brokers: websocketConfig.kafka.brokers,
        clientId: websocketConfig.kafka.clientId,
        consumerGroup: this.consumerGroup,
        mainTopic: this.mainTopic,
        routingRules: this.routingRules.length
      });
    } catch (error) {
      logger.error('Failed to initialize Kafka consumer', { error });
      throw error;
    }
  }

  /**
   * Start consuming messages from main topic
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Kafka consumer is already running');
      return;
    }

    try {
      this.isRunning = true;
      
      await this.kafka.subscribe(
        this.consumerId,
        [this.mainTopic],
        {
          groupId: this.consumerGroup,
          sessionTimeout: 30000,
          autoCommit: true,
          enableDeadLetterQueue: websocketConfig.kafka.eventProcessing.deadLetterQueueEnabled,
          deadLetterQueueTopic: websocketConfig.kafka.eventProcessing.deadLetterQueueTopic
        },
        this.messageHandler.bind(this)
      );
      
      logger.info('Generic Kafka consumer started', {
        mainTopic: this.mainTopic,
        consumerGroup: this.consumerGroup,
        eventProcessingEnabled: websocketConfig.kafka.eventProcessing.enabled,
        validationEnabled: websocketConfig.kafka.eventProcessing.validationEnabled
      });
      
    } catch (error) {
      logger.error('Failed to start Kafka consumer', { error });
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop consuming messages
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Kafka consumer is not running');
      return;
    }

    try {
      this.isRunning = false;
      await this.kafka.disconnect();
      logger.info('Kafka consumer stopped', {
        totalProcessed: this.processingMetrics.totalProcessed,
        successCount: this.processingMetrics.successCount,
        errorCount: this.processingMetrics.errorCount
      });
    } catch (error) {
      logger.error('Failed to stop Kafka consumer', { error });
    }
  }

  /**
   * Generic message handler - routes events based on patterns
   */
  private async messageHandler(topic: string, message: any, rawMessage: any): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.processingMetrics.totalProcessed++;
      
      logger.info('🔥 [KAFKA DEBUG] Received message from topic', { 
        topic, 
        partition: rawMessage.partition,
        offset: rawMessage.offset,
        key: rawMessage.key?.toString(),
        messagePreview: JSON.stringify(message).substring(0, 200) + '...'
      });

      // Parse event envelope
      const event = this.parseEventEnvelope(message);
      if (!event) {
        logger.error('❌ [KAFKA DEBUG] Failed to parse event envelope', { 
          message: JSON.stringify(message).substring(0, 500) + '...',
          messageType: typeof message,
          hasMetadata: !!message?.metadata,
          hasData: !!message?.data
        });
        return;
      }

      logger.info('✅ [KAFKA DEBUG] Successfully parsed event envelope', {
        eventType: event.metadata.eventType,
        eventId: event.metadata.eventId,
        source: event.metadata.source,
        dataKeys: Object.keys(event.data || {})
      });

      // Validate event structure if enabled
      if (websocketConfig.kafka.eventProcessing.validationEnabled) {
        const validation = eventFactory.validateEvent(event);
        if (!validation.isValid) {
          logger.error('Event validation failed', {
            eventId: event.metadata?.eventId,
            eventType: event.metadata?.eventType,
            errors: validation.errors
          });
          return;
        }
      }

      // Route event using generic rules
      await this.routeEvent(event, {
        topic,
        partition: rawMessage.partition,
        offset: rawMessage.offset,
        timestamp: rawMessage.timestamp,
        headers: rawMessage.headers
      });
      
      this.processingMetrics.successCount++;
      this.processingMetrics.lastProcessedAt = Date.now();
      
      // Log processing metrics periodically
      if (this.processingMetrics.totalProcessed % 100 === 0) {
        logger.info('Event processing metrics', {
          totalProcessed: this.processingMetrics.totalProcessed,
          successRate: (this.processingMetrics.successCount / this.processingMetrics.totalProcessed * 100).toFixed(2),
          avgProcessingTime: Date.now() - startTime
        });
      }
      
    } catch (error) {
      this.processingMetrics.errorCount++;
      
      logger.error('Failed to handle message', { 
        error: (error as Error).message,
        stack: (error as Error).stack,
        topic, 
        messageKey: rawMessage.key?.toString(),
        processingTime: Date.now() - startTime
      });
    }
  }

  /**
   * Generic event routing using configurable rules
   */
  private async routeEvent(event: EventEnvelope<any>, context: EventHandlerContext): Promise<void> {
    const { eventType } = event.metadata;
    
    logger.info('🔄 [ROUTING DEBUG] Starting event routing', {
      eventType,
      eventId: event.metadata.eventId,
      totalRules: this.routingRules.length
    });
    
    // Find matching routing rules
    const matchingRules = this.routingRules.filter(rule => {
      const matches = typeof rule.eventTypePattern === 'string' 
        ? eventType === rule.eventTypePattern
        : rule.eventTypePattern.test(eventType);
      
      logger.debug('🔍 [ROUTING DEBUG] Checking rule', {
        pattern: rule.eventTypePattern.toString(),
        eventType,
        matches,
        hasChannel: !!rule.channelMapping
      });
      
      return matches;
    });

    logger.info('🎯 [ROUTING DEBUG] Found matching rules', {
      eventType,
      eventId: event.metadata.eventId,
      matchingRulesCount: matchingRules.length,
      matchingRules: matchingRules.map(r => ({
        pattern: r.eventTypePattern.toString(),
        channel: r.channelMapping
      }))
    });

    if (matchingRules.length === 0) {
      logger.error('❌ [ROUTING DEBUG] No routing rules matched for event type', { 
        eventType, 
        eventId: event.metadata.eventId,
        availablePatterns: this.routingRules.map(r => r.eventTypePattern.toString())
      });
      return;
    }

    // Process each matching rule
    for (const rule of matchingRules) {
      try {
        // Apply filter if exists
        if (rule.filter && !rule.filter(event)) {
          logger.debug('Event filtered out by rule', { 
            eventType, 
            eventId: event.metadata.eventId 
          });
          continue;
        }

        // Transform event to WebSocket message
        const transformer = rule.messageTransformer || defaultMessageTransformer;
        const message = transformer(event);
        
        logger.info('🔄 [TRANSFORM DEBUG] Message transformed', {
          eventType,
          eventId: event.metadata.eventId,
          transformedMessageId: message.id,
          transformedMessageType: message.type,
          hasCustomTransformer: !!rule.messageTransformer
        });

        // Extract user if needed
        const userExtractor = rule.userExtractor || defaultUserExtractor;
        const userId = userExtractor(event);

        // Send to user if userId exists
        if (userId) {
          await connectionManager.sendToUser(userId, message);
          logger.debug('Event sent to user', { 
            eventType, 
            eventId: event.metadata.eventId,
            userId 
          });
        }

        // Broadcast to channel if specified
        if (rule.channelMapping) {
          logger.info('📡 [BROADCAST DEBUG] Broadcasting to channel', {
            eventType,
            eventId: event.metadata.eventId,
            channel: rule.channelMapping,
            messageId: message.id,
            messageType: message.type
          });
          
          await connectionManager.sendToSubscribers(rule.channelMapping as any, message);
          
          logger.info('✅ [BROADCAST DEBUG] Successfully broadcasted to channel', { 
            eventType, 
            eventId: event.metadata.eventId,
            channel: rule.channelMapping,
            messageId: message.id
          });
        }

      } catch (error) {
        logger.error('Failed to process routing rule', { 
          error, 
          eventType, 
          eventId: event.metadata.eventId 
        });
      }
    }
  }

  /**
   * Parse event envelope from raw message
   */
  private parseEventEnvelope(message: any): EventEnvelope<any> | null {
    try {
      // Handle different message formats
      if (typeof message === 'string') {
        message = JSON.parse(message);
      }

      // Check if it's already an event envelope
      if (message.metadata && message.data) {
        return message as EventEnvelope<any>;
      }

      logger.warn('Unknown message format', { message });
      return null;
    } catch (error) {
      logger.error('Failed to parse event envelope', { error, message });
      return null;
    }
  }

  /**
   * Add custom routing rule - allows extending without code changes
   */
  addRoutingRule(rule: EventRoutingRule): void {
    this.routingRules.push(rule);
    logger.info('Custom routing rule added', { 
      pattern: rule.eventTypePattern.toString(),
      hasUserExtractor: !!rule.userExtractor,
      hasChannelMapping: !!rule.channelMapping,
      hasFilter: !!rule.filter
    });
  }

  /**
   * Remove routing rule
   */
  removeRoutingRule(pattern: string | RegExp): void {
    const initialLength = this.routingRules.length;
    this.routingRules = this.routingRules.filter(rule => 
      rule.eventTypePattern.toString() !== pattern.toString()
    );
    
    if (this.routingRules.length < initialLength) {
      logger.info('Routing rule removed', { pattern: pattern.toString() });
    }
  }

  /**
   * Get current routing rules
   */
  getRoutingRules(): EventRoutingRule[] {
    return [...this.routingRules];
  }

  /**
   * Get consumer health status
   */
  async getHealthStatus(): Promise<boolean> {
    try {
      return await this.kafka.isHealthy();
    } catch (error) {
      logger.error('Failed to check Kafka health', { error });
      return false;
    }
  }

  /**
   * Get consumer metrics
   */
  getMetrics() {
    return {
      ...this.kafka.getMetrics(),
      processing: this.processingMetrics,
      routing: {
        rulesCount: this.routingRules.length,
        rules: this.routingRules.map(rule => ({
          pattern: rule.eventTypePattern.toString(),
          hasUserExtractor: !!rule.userExtractor,
          hasChannelMapping: !!rule.channelMapping,
          hasFilter: !!rule.filter
        }))
      }
    };
  }

  /**
   * Check if consumer is running
   */
  isConsumerRunning(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const kafkaConsumer = new KafkaConsumerService(); 