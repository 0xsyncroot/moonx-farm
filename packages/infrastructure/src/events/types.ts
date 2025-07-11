/**
 * Shared Event Types for MoonX Farm Microservices
 * - Generic Event Structure theo Message Envelope Pattern
 * - Common interfaces và utilities
 * - Business-specific types sẽ được định nghĩa trong từng service
 */

// Base Event Envelope Structure
export interface EventEnvelope<T = any> {
  // Metadata section - system/technical information
  metadata: EventMetadata;
  
  // Data section - domain/business information
  data: T;
}

// Event Metadata - thông tin system/technical
export interface EventMetadata {
  // Core identification
  eventId: string;          // Unique identifier (UUID)
  eventType: string;        // Type discriminator (extensible)
  eventVersion: string;     // Schema version (e.g., "1.0.0")
  
  // Tracing & correlation
  correlationId: string;    // For tracing across services
  causationId?: string;     // Event that caused this event
  
  // Timing information
  timestamp: number;        // Event creation timestamp
  processingTime?: number;  // Processing duration if applicable
  
  // Source information
  source: string;           // Service that generated the event
  sourceVersion?: string;   // Version of the source service
  
  // Context information
  tenantId?: string;        // For multi-tenant scenarios
  userId?: string;          // User context if applicable
  sessionId?: string;       // Session context
  
  // Technical metadata
  dataClassification?: DataClassification;
  sequence?: number;        // Sequence number for ordering
  partition?: string;       // Partition key for Kafka
  
  // Additional context
  context?: Record<string, any>;
}

// Data Classification for security
export type DataClassification = 
  | 'public'
  | 'internal' 
  | 'confidential'
  | 'restricted';

// Event Categories for organization (generic)
export type EventCategory = 
  | 'business'    // Business domain events
  | 'system'      // System events
  | 'user'        // User events
  | 'notification' // Notification events
  | 'analytics';  // Analytics events

// Event handler context
export interface EventHandlerContext {
  topic: string;
  partition: number;
  offset: string;
  timestamp: number;
  headers?: Record<string, string>;
  service?: string;
}

// Event validation result
export interface EventValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Event factory options
export interface EventFactoryOptions {
  correlationId?: string;
  causationId?: string;
  userId?: string;
  sessionId?: string;
  tenantId?: string;
  context?: Record<string, any>;
}

// Event handler type - generic for any service
export type EventHandler<T extends EventEnvelope<any> = EventEnvelope<any>> = (
  event: T,
  context: EventHandlerContext
) => Promise<void>;

// Event publisher interface
export interface EventPublisher {
  publish<T>(eventType: string, data: T, options?: EventFactoryOptions): Promise<void>;
  publishBatch<T>(events: Array<{ eventType: string; data: T; options?: EventFactoryOptions }>): Promise<void>;
}

// Event subscriber interface
export interface EventSubscriber {
  subscribe<T>(eventType: string, handler: EventHandler<EventEnvelope<T>>): void;
  unsubscribe(eventType: string): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}

// Event registry for service-specific types
export interface EventRegistry<T extends Record<string, any> = Record<string, any>> {
  getEventTypes(): (keyof T)[];
  getEventSchema(eventType: keyof T): any;
  validateEventData(eventType: keyof T, data: any): EventValidationResult;
}

// Partition strategy interface
export interface PartitionStrategy {
  getPartitionKey(eventType: string, data: any, userId?: string): string;
}

// Event serialization interface
export interface EventSerializer {
  serialize<T>(event: EventEnvelope<T>): string;
  deserialize<T>(data: string): EventEnvelope<T>;
}

// Event filtering interface
export interface EventFilter {
  shouldProcess(event: EventEnvelope<any>): boolean;
}

// Event transformation interface
export interface EventTransformer {
  transform<T, U>(event: EventEnvelope<T>): EventEnvelope<U>;
} 