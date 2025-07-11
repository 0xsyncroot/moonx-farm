import { EventFactory } from './eventFactory';
import { EventEnvelope, EventPublisher, EventFactoryOptions } from './types';
import { KafkaManager } from '../kafka';
import { createLogger } from '@moonx-farm/common';

export interface EventPublisherConfig {
  serviceName: string;
  serviceVersion?: string;
  kafka: {
    brokers: string[];
    clientId: string;
    connectionTimeout?: number;
    requestTimeout?: number;
  };
  topic: {
    main: string;
    deadLetterQueue?: string;
  };
  options?: {
    enableValidation?: boolean;
    enableBatching?: boolean;
    batchSize?: number;
    batchTimeout?: number;
    enableRetry?: boolean;
    retryAttempts?: number;
    retryDelay?: number;
  };
}

/**
 * Event Publisher - Publish events to Kafka với single topic pattern
 */
export class KafkaEventPublisher implements EventPublisher {
  private readonly logger = createLogger('event-publisher');
  private readonly eventFactory: EventFactory;
  private readonly kafkaManager: KafkaManager;
  private readonly config: EventPublisherConfig;
  private readonly pendingEvents: Array<{
    event: EventEnvelope<any>;
    resolve: (value: void) => void;
    reject: (error: Error) => void;
  }> = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isConnected = false;

  constructor(config: EventPublisherConfig) {
    this.config = {
      ...config,
      options: {
        enableValidation: true,
        enableBatching: false,
        batchSize: 100,
        batchTimeout: 5000,
        enableRetry: true,
        retryAttempts: 3,
        retryDelay: 1000,
        ...config.options,
      },
    };

    this.eventFactory = new EventFactory(
      config.serviceName,
      config.serviceVersion
    );

    this.kafkaManager = new KafkaManager({
      brokers: config.kafka.brokers,
      clientId: config.kafka.clientId,
      connectionTimeout: config.kafka.connectionTimeout,
      requestTimeout: config.kafka.requestTimeout,
    });

    this.logger.info('EventPublisher initialized', {
      serviceName: config.serviceName,
      mainTopic: config.topic.main,
      batchingEnabled: this.config.options?.enableBatching,
    });
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await this.kafkaManager.connect();
      this.isConnected = true;
      this.logger.info('EventPublisher connected to Kafka');
    } catch (error) {
      this.logger.error('Failed to connect EventPublisher to Kafka', { error });
      throw error;
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      // Flush pending events
      if (this.pendingEvents.length > 0) {
        await this.flushBatch();
      }

      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }

      await this.kafkaManager.disconnect();
      this.isConnected = false;
      this.logger.info('EventPublisher disconnected from Kafka');
    } catch (error) {
      this.logger.error('Failed to disconnect EventPublisher from Kafka', { error });
      throw error;
    }
  }

  /**
   * Publish single event
   */
  async publish<T>(
    eventType: string,
    data: T,
    options: EventFactoryOptions = {}
  ): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    const event = this.eventFactory.createEvent(eventType, data, options);

    // Validate event if enabled
    if (this.config.options?.enableValidation) {
      const validation = this.eventFactory.validateEvent(event);
      if (!validation.isValid) {
        const error = new Error(`Event validation failed: ${validation.errors.join(', ')}`);
        this.logger.error('Event validation failed', {
          eventType,
          eventId: event.metadata.eventId,
          errors: validation.errors,
        });
        throw error;
      }
    }

    // Use batching if enabled
    if (this.config.options?.enableBatching) {
      return this.addToBatch(event);
    }

    // Send immediately
    return this.sendEvent(event);
  }

  /**
   * Publish multiple events in batch
   */
  async publishBatch<T>(
    events: Array<{
      eventType: string;
      data: T;
      options?: EventFactoryOptions;
    }>
  ): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    const eventEnvelopes = events.map(({ eventType, data, options }) =>
      this.eventFactory.createEvent(eventType, data, options)
    );

    // Validate events if enabled
    if (this.config.options?.enableValidation) {
      for (const event of eventEnvelopes) {
        const validation = this.eventFactory.validateEvent(event);
        if (!validation.isValid) {
          const error = new Error(`Event validation failed: ${validation.errors.join(', ')}`);
          this.logger.error('Event validation failed', {
            eventType: event.metadata.eventType,
            eventId: event.metadata.eventId,
            errors: validation.errors,
          });
          throw error;
        }
      }
    }

    // Send batch
    return this.sendEventBatch(eventEnvelopes);
  }

  /**
   * Add event to batch
   */
  private addToBatch(event: EventEnvelope<any>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pendingEvents.push({ event, resolve, reject });

      // Start batch timer if not already started
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.flushBatch().catch((error) => {
            this.logger.error('Failed to flush batch', { error });
          });
        }, this.config.options?.batchTimeout || 5000);
      }

      // Flush if batch is full
      if (this.pendingEvents.length >= (this.config.options?.batchSize || 100)) {
        this.flushBatch().catch((error) => {
          this.logger.error('Failed to flush batch', { error });
        });
      }
    });
  }

  /**
   * Flush pending events
   */
  private async flushBatch(): Promise<void> {
    if (this.pendingEvents.length === 0) {
      return;
    }

    const batch = this.pendingEvents.splice(0);
    const events = batch.map(({ event }) => event);

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      await this.sendEventBatch(events);
      
      // Resolve all promises
      batch.forEach(({ resolve }) => resolve());
      
      this.logger.debug('Batch flushed successfully', {
        eventCount: events.length,
      });
    } catch (error) {
      // Reject all promises
      batch.forEach(({ reject }) => reject(error as Error));
      
      this.logger.error('Failed to flush batch', {
        error,
        eventCount: events.length,
      });
    }
  }

     /**
    * Send single event with retry
    */
   private async sendEvent(event: EventEnvelope<any>): Promise<void> {
     const maxRetries = this.config.options?.retryAttempts || 3;
     const retryDelay = this.config.options?.retryDelay || 1000;

     for (let attempt = 0; attempt <= maxRetries; attempt++) {
       try {
         await this.kafkaManager.publish(event, {
           topic: this.config.topic.main,
           key: event.metadata.partition,
           headers: {
             'content-type': 'application/json',
             'event-type': event.metadata.eventType,
             'correlation-id': event.metadata.correlationId,
             'event-id': event.metadata.eventId,
             'source': event.metadata.source,
           },
         });

         this.logger.debug('Event published successfully', {
           eventType: event.metadata.eventType,
           eventId: event.metadata.eventId,
           partition: event.metadata.partition,
         });

         return;
       } catch (error) {
         const isLastAttempt = attempt === maxRetries;
         
         this.logger.error('Failed to publish event', {
           eventType: event.metadata.eventType,
           eventId: event.metadata.eventId,
           attempt: attempt + 1,
           maxRetries: maxRetries + 1,
           error: (error as Error).message,
           isLastAttempt,
         });

         if (isLastAttempt) {
           // Send to dead letter queue if available
           if (this.config.topic.deadLetterQueue) {
             await this.sendToDeadLetterQueue(event, error as Error);
           }
           throw error;
         }

         // Wait before retry
         await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
       }
     }
   }

     /**
    * Send event batch
    */
   private async sendEventBatch(events: Array<EventEnvelope<any>>): Promise<void> {
     const messages = events.map((event) => ({
       data: event,
       options: {
         topic: this.config.topic.main,
         key: event.metadata.partition,
         headers: {
           'content-type': 'application/json',
           'event-type': event.metadata.eventType,
           'correlation-id': event.metadata.correlationId,
           'event-id': event.metadata.eventId,
           'source': event.metadata.source,
         },
       },
     }));

     try {
       await this.kafkaManager.publishBatch(messages);
       
       this.logger.debug('Event batch published successfully', {
         eventCount: events.length,
       });
     } catch (error) {
       this.logger.error('Failed to publish event batch', {
         error: (error as Error).message,
         eventCount: events.length,
       });
       throw error;
     }
   }

     /**
    * Send event to dead letter queue
    */
   private async sendToDeadLetterQueue(
     event: EventEnvelope<any>,
     error: Error
   ): Promise<void> {
     if (!this.config.topic.deadLetterQueue) {
       return;
     }

     try {
       const dlqEvent = this.eventFactory.enrichEvent(event, {
         deadLetterQueue: true,
         originalError: error.message,
         failedAt: Date.now(),
       });

       await this.kafkaManager.publish(dlqEvent, {
         topic: this.config.topic.deadLetterQueue,
         key: event.metadata.partition,
         headers: {
           'content-type': 'application/json',
           'event-type': event.metadata.eventType,
           'correlation-id': event.metadata.correlationId,
           'event-id': event.metadata.eventId,
           'source': event.metadata.source,
           'dlq-reason': 'publish-failed',
         },
       });

       this.logger.info('Event sent to dead letter queue', {
         eventType: event.metadata.eventType,
         eventId: event.metadata.eventId,
         dlqTopic: this.config.topic.deadLetterQueue,
       });
     } catch (dlqError) {
       this.logger.error('Failed to send event to dead letter queue', {
         eventType: event.metadata.eventType,
         eventId: event.metadata.eventId,
         error: (dlqError as Error).message,
       });
     }
   }

  /**
   * Get publisher metrics
   */
  getMetrics() {
    return {
      ...this.kafkaManager.getMetrics(),
      serviceName: this.config.serviceName,
      mainTopic: this.config.topic.main,
      pendingEvents: this.pendingEvents.length,
      batchingEnabled: this.config.options?.enableBatching,
      validationEnabled: this.config.options?.enableValidation,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      return await this.kafkaManager.isHealthy();
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return false;
    }
  }
} 