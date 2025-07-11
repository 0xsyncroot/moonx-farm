import { v4 as uuidv4 } from 'uuid';
import { 
  EventEnvelope, 
  EventMetadata, 
  EventFactoryOptions,
  DataClassification,
  EventValidationResult,
  PartitionStrategy
} from './types';

/**
 * Default Partition Strategy
 */
export class DefaultPartitionStrategy implements PartitionStrategy {
  getPartitionKey(eventType: string, data: any, userId?: string): string {
    // User-specific events partition by userId
    if (userId) {
      return userId;
    }

    // System events partition by event category
    if (eventType.startsWith('system.')) {
      return 'system';
    }

    // Default partition by event type prefix
    const prefix = eventType.split('.')[0];
    return prefix || 'default';
  }
}

/**
 * Default Data Classification Strategy
 */
export class DefaultDataClassificationStrategy {
  getDataClassification(eventType: string, data: any): DataClassification {
    // System events are internal by default
    if (eventType.startsWith('system.')) {
      return 'internal';
    }

    // User events are internal by default
    if (eventType.startsWith('user.')) {
      return 'internal';
    }

    // Default to internal
    return 'internal';
  }
}

/**
 * Generic Event Factory - Tạo events theo chuẩn Message Envelope Pattern
 * Đảm bảo consistency và completeness của metadata
 */
export class EventFactory {
  private readonly serviceName: string;
  private readonly serviceVersion: string;
  private readonly partitionStrategy: PartitionStrategy;
  private readonly dataClassificationStrategy: DefaultDataClassificationStrategy;

  constructor(
    serviceName: string,
    serviceVersion: string = '1.0.0',
    partitionStrategy?: PartitionStrategy,
    dataClassificationStrategy?: DefaultDataClassificationStrategy
  ) {
    this.serviceName = serviceName;
    this.serviceVersion = serviceVersion;
    this.partitionStrategy = partitionStrategy || new DefaultPartitionStrategy();
    this.dataClassificationStrategy = dataClassificationStrategy || new DefaultDataClassificationStrategy();
  }

  /**
   * Tạo event envelope với metadata đầy đủ
   */
  public createEvent<T>(
    eventType: string,
    data: T,
    options: EventFactoryOptions = {}
  ): EventEnvelope<T> {
    const eventId = uuidv4();
    const correlationId = options.correlationId || uuidv4();
    const timestamp = Date.now();

    const metadata: EventMetadata = {
      // Core identification
      eventId,
      eventType,
      eventVersion: '1.0.0',

      // Tracing & correlation
      correlationId,
      causationId: options.causationId,

      // Timing information
      timestamp,

      // Source information
      source: this.serviceName,
      sourceVersion: this.serviceVersion,

      // Context information
      tenantId: options.tenantId,
      userId: options.userId,
      sessionId: options.sessionId,

      // Technical metadata
      dataClassification: this.dataClassificationStrategy.getDataClassification(eventType, data),
      sequence: this.generateSequenceNumber(),
      partition: this.partitionStrategy.getPartitionKey(eventType, data, options.userId),

      // Additional context
      context: options.context,
    };

    return {
      metadata,
      data,
    };
  }

  /**
   * Tạo sequence number cho ordering (có thể override)
   */
  protected generateSequenceNumber(): number {
    return Date.now();
  }

  /**
   * Tạo derived event - event được tạo từ event khác
   */
  public createDerivedEvent<T>(
    eventType: string,
    data: T,
    parentEvent: EventEnvelope<any>,
    options: EventFactoryOptions = {}
  ): EventEnvelope<T> {
    return this.createEvent(eventType, data, {
      ...options,
      correlationId: parentEvent.metadata.correlationId,
      causationId: parentEvent.metadata.eventId,
      userId: options.userId || parentEvent.metadata.userId,
      sessionId: options.sessionId || parentEvent.metadata.sessionId,
      tenantId: options.tenantId || parentEvent.metadata.tenantId,
    });
  }

  /**
   * Tạo error event từ exception
   */
  public createErrorEvent(
    error: Error,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    affectedUsers?: string[],
    options: EventFactoryOptions = {}
  ): EventEnvelope<any> {
    const errorData = {
      error: error.message,
      stack: error.stack,
      service: this.serviceName,
      severity,
      affectedUsers,
      metadata: {
        errorType: error.constructor.name,
        timestamp: Date.now(),
        ...options.context,
      },
    };

    return this.createEvent('system.error', errorData, options);
  }

  /**
   * Validate event structure
   */
  public validateEvent(event: EventEnvelope<any>): EventValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate metadata
    if (!event.metadata) {
      errors.push('Metadata is required');
    } else {
      if (!event.metadata.eventId) errors.push('Event ID is required');
      if (!event.metadata.eventType) errors.push('Event type is required');
      if (!event.metadata.timestamp) errors.push('Timestamp is required');
      if (!event.metadata.source) errors.push('Source is required');
      if (!event.metadata.correlationId) errors.push('Correlation ID is required');
      
      // Warnings for optional but recommended fields
      if (!event.metadata.eventVersion) warnings.push('Event version is recommended');
      if (!event.metadata.dataClassification) warnings.push('Data classification is recommended');
    }

    // Validate data
    if (event.data === undefined || event.data === null) {
      errors.push('Data is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Enrich event với additional context
   */
  public enrichEvent<T>(
    event: EventEnvelope<T>,
    additionalContext: Record<string, any>
  ): EventEnvelope<T> {
    return {
      ...event,
      metadata: {
        ...event.metadata,
        context: {
          ...event.metadata.context,
          ...additionalContext,
        },
      },
    };
  }

  /**
   * Clone event với new data
   */
  public cloneEvent<T, U>(
    originalEvent: EventEnvelope<T>,
    newEventType: string,
    newData: U,
    options: Partial<EventFactoryOptions> = {}
  ): EventEnvelope<U> {
    return this.createEvent(newEventType, newData, {
      correlationId: originalEvent.metadata.correlationId,
      causationId: originalEvent.metadata.eventId,
      userId: originalEvent.metadata.userId,
      sessionId: originalEvent.metadata.sessionId,
      tenantId: originalEvent.metadata.tenantId,
      ...options,
    });
  }

  /**
   * Batch create events
   */
  public createEvents<T>(
    events: Array<{
      eventType: string;
      data: T;
      options?: EventFactoryOptions;
    }>
  ): Array<EventEnvelope<T>> {
    return events.map(({ eventType, data, options }) =>
      this.createEvent(eventType, data, options)
    );
  }

  /**
   * Get service info
   */
  public getServiceInfo() {
    return {
      serviceName: this.serviceName,
      serviceVersion: this.serviceVersion,
    };
  }
} 