// WebSocket Gateway Types - Centralized exports
export * from './events';

// Re-export commonly used types and constants for easy access
export type {
  DEXEvent,
  TypedDEXEvent,
  PriceUpdateEvent,
  OrderBookUpdateEvent,
  TradeNotificationEvent,
  PortfolioUpdateEvent,
  SystemAlertEvent,
  PriceUpdateData,
  OrderBookUpdateData,
  TradeNotificationData,
  PortfolioUpdateData,
  SystemAlertData
} from './events';

export {
  DEXEventType,
  WEBSOCKET_EVENTS,
  KAFKA_TOPICS,
  ROOM_PREFIXES,
  GENERAL_ROOMS,
  SUBSCRIPTION_TYPES,
  createRoomName,
  isValidRoomName,
  ALL_KAFKA_TOPICS,
  ALL_SUBSCRIPTION_TYPES,
  ALL_GENERAL_ROOMS
} from './events'; 