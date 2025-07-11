/**
 * Infrastructure clients and managers for MoonXFarm DEX
 * 
 * This package provides:
 * - DatabaseManager: PostgreSQL connection and query management
 * - RedisManager: Redis caching and pub/sub operations  
 * - KafkaManager: Kafka messaging and event streaming
 * - MongoManager: MongoDB document storage and operations using Mongoose
 * 
 * Note: This is NOT the configuration management package.
 * For configuration management, use @moonx-farm/configs instead.
 */

export * from './database';
export * from './redis';
export * from './kafka';
export * from './mongo';

// Event system exports
export * from './events';

// Explicit exports for commonly used types
export {
  KafkaManager,
  KafkaManagerConfig,
  ConsumerOptions,
  ProducerOptions,
  PublishOptions,
  KafkaMetrics,
  createKafka,
  createKafkaConfig
} from './kafka';

export {
  MongoManager,
  MongoConfig,
  MongoMetrics,
  MongoTransaction,
  QueryOptions,
  createMongo,
  createMongoConfig,
  Schema,
  Model,
  Document,
  FilterQuery,
  UpdateQuery,
  PipelineStage,
  PopulateOptions,
  ClientSession
} from './mongo';

// Event system explicit exports
export {
  EventEnvelope,
  EventMetadata,
  EventFactoryOptions,
  EventHandler,
  EventPublisher,
  EventSubscriber,
  EventHandlerContext,
  EventValidationResult,
  DataClassification,
  EventCategory,
  PartitionStrategy,
  EventSerializer,
  EventFilter,
  EventTransformer,
  EventRegistry
} from './events/types';

export {
  EventFactory,
  DefaultPartitionStrategy,
  DefaultDataClassificationStrategy
} from './events/eventFactory';

export {
  KafkaEventPublisher,
  EventPublisherConfig
} from './events/eventPublisher'; 