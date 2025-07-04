// Centralized DEX Event Types and Constants
// This file contains all event-related types and constants to avoid duplication

// Event Types - Centralized enum để dễ mở rộng
export enum DEXEventType {
  PRICE_UPDATE = 'price_update',
  ORDER_BOOK_UPDATE = 'order_book_update',
  TRADE_NOTIFICATION = 'trade_notification',
  PORTFOLIO_UPDATE = 'portfolio_update',
  SYSTEM_ALERT = 'system_alert'
}

// WebSocket Event Names - Mapping từ DEXEventType sang WebSocket event names
export const WEBSOCKET_EVENTS = {
  [DEXEventType.PRICE_UPDATE]: 'price_update',
  [DEXEventType.ORDER_BOOK_UPDATE]: 'order_book_update',
  [DEXEventType.TRADE_NOTIFICATION]: 'trade_notification',
  [DEXEventType.PORTFOLIO_UPDATE]: 'portfolio_update',
  [DEXEventType.SYSTEM_ALERT]: 'system_alert'
} as const;

// Kafka Topics - Mapping từ DEXEventType sang Kafka topic names
export const KAFKA_TOPICS = {
  [DEXEventType.PRICE_UPDATE]: 'price.updates',
  [DEXEventType.ORDER_BOOK_UPDATE]: 'order.book.updates',
  [DEXEventType.TRADE_NOTIFICATION]: 'trade.notifications',
  [DEXEventType.PORTFOLIO_UPDATE]: 'portfolio.updates',
  [DEXEventType.SYSTEM_ALERT]: 'system.alerts'
} as const;

// Room Name Prefixes - Standardized room naming convention
export const ROOM_PREFIXES = {
  PRICE: 'price',
  ORDERBOOK: 'orderbook',
  TRADE: 'trade',
  USER: 'user',
  PORTFOLIO: 'portfolio',
  ORDERS: 'orders'
} as const;

// General Room Names - Shared rooms không cần symbol/userId
export const GENERAL_ROOMS = {
  PRICE_UPDATES: 'price_updates',
  TRADE_NOTIFICATIONS: 'trade_notifications',
  PORTFOLIO_UPDATES: 'portfolio_updates',
  SYSTEM_ALERTS: 'system_alerts',
  ORDER_UPDATES: 'order_updates'
} as const;

// Subscription Types - Valid subscription types for clients
export const SUBSCRIPTION_TYPES = {
  PRICE_UPDATES: 'price_updates',
  TRADE_NOTIFICATIONS: 'trade_notifications',
  PORTFOLIO_UPDATES: 'portfolio_updates',
  SYSTEM_ALERTS: 'system_alerts',
  ORDER_UPDATES: 'order_updates'
} as const;

// Room Name Generators - Helper functions để tạo room names
export const createRoomName = {
  price: (symbol: string) => `${ROOM_PREFIXES.PRICE}:${symbol}`,
  orderbook: (symbol: string) => `${ROOM_PREFIXES.ORDERBOOK}:${symbol}`,
  trade: (symbol: string) => `${ROOM_PREFIXES.TRADE}:${symbol}`,
  user: (userId: string) => `${ROOM_PREFIXES.USER}:${userId}`,
  portfolio: (userId: string) => `${ROOM_PREFIXES.PORTFOLIO}:${userId}`,
  orders: (userId: string) => `${ROOM_PREFIXES.ORDERS}:${userId}`
} as const;

// DEX Event Interface - Centralized interface definition
export interface DEXEvent {
  type: DEXEventType;
  symbol?: string;
  userId?: string;
  data: any;
  timestamp: number;
  metadata?: {
    priority?: 'low' | 'medium' | 'high';
    source?: string;
    traceId?: string;
    version?: string;
  };
}

// Specific Event Data Types - Type-safe data structures for each event type
export interface PriceUpdateData {
  price: number;
  change: number;
  changePercent?: number;
  volume: number;
  high24h?: number;
  low24h?: number;
  lastUpdated?: number;
}

export interface OrderBookUpdateData {
  bids: Array<[number, number]>; // [price, amount]
  asks: Array<[number, number]>; // [price, amount]
  sequence?: number;
}

export interface TradeNotificationData {
  tradeId?: string;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  txHash?: string;
  gasUsed?: number;
  fees?: number;
  personal?: boolean;
}

export interface PortfolioUpdateData {
  totalValue: number;
  positions: Array<{
    symbol: string;
    amount: number;
    value: number;
  }>;
  pnl: number;
  pnlPercent?: number;
}

export interface SystemAlertData {
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  title?: string;
  actionUrl?: string;
  dismissible?: boolean;
}

// Typed DEX Events - Type-safe event interfaces
export interface PriceUpdateEvent extends Omit<DEXEvent, 'type' | 'data'> {
  type: DEXEventType.PRICE_UPDATE;
  data: PriceUpdateData;
}

export interface OrderBookUpdateEvent extends Omit<DEXEvent, 'type' | 'data'> {
  type: DEXEventType.ORDER_BOOK_UPDATE;
  data: OrderBookUpdateData;
}

export interface TradeNotificationEvent extends Omit<DEXEvent, 'type' | 'data'> {
  type: DEXEventType.TRADE_NOTIFICATION;
  data: TradeNotificationData;
}

export interface PortfolioUpdateEvent extends Omit<DEXEvent, 'type' | 'data'> {
  type: DEXEventType.PORTFOLIO_UPDATE;
  data: PortfolioUpdateData;
}

export interface SystemAlertEvent extends Omit<DEXEvent, 'type' | 'data'> {
  type: DEXEventType.SYSTEM_ALERT;
  data: SystemAlertData;
}

// Union type for all typed events
export type TypedDEXEvent = 
  | PriceUpdateEvent
  | OrderBookUpdateEvent
  | TradeNotificationEvent
  | PortfolioUpdateEvent
  | SystemAlertEvent;

// Room Validation Patterns - Regex patterns for room name validation
export const ROOM_VALIDATION_PATTERNS = {
  [ROOM_PREFIXES.PRICE]: /^price:[A-Z0-9]{2,20}(-[A-Z0-9]{2,20})?$/,
  [ROOM_PREFIXES.ORDERBOOK]: /^orderbook:[A-Z0-9]{2,20}(-[A-Z0-9]{2,20})?$/,
  [ROOM_PREFIXES.TRADE]: /^trade:[A-Z0-9]{2,20}(-[A-Z0-9]{2,20})?$/,
  [ROOM_PREFIXES.USER]: /^user:[a-zA-Z0-9-_]{8,}$/,
  [ROOM_PREFIXES.PORTFOLIO]: /^portfolio:[a-zA-Z0-9-_]{8,}$/,
  [ROOM_PREFIXES.ORDERS]: /^orders:[a-zA-Z0-9-_]{8,}$/
} as const;

// Helper function to validate room names
export function isValidRoomName(roomName: string): boolean {
  const [prefix] = roomName.split(':');
  const pattern = ROOM_VALIDATION_PATTERNS[prefix as keyof typeof ROOM_VALIDATION_PATTERNS];
  return pattern ? pattern.test(roomName) : false;
}

// Helper function to get all Kafka topics
export function getAllKafkaTopics(): string[] {
  return Object.values(KAFKA_TOPICS);
}

// Helper function to get all subscription types
export function getAllSubscriptionTypes(): string[] {
  return Object.values(SUBSCRIPTION_TYPES);
}

// Helper function to get all general rooms
export function getAllGeneralRooms(): string[] {
  return Object.values(GENERAL_ROOMS);
}

// Constants for easy import
export const ALL_KAFKA_TOPICS = getAllKafkaTopics();
export const ALL_SUBSCRIPTION_TYPES = getAllSubscriptionTypes();
export const ALL_GENERAL_ROOMS = getAllGeneralRooms(); 