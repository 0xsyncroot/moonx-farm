/**
 * Event Factory for WebSocket Service
 * - Uses shared EventFactory from infrastructure
 * - Configurable partition strategy for websocket-specific logic
 * - Type-safe event creation
 */

import { 
  EventFactory,
  DefaultPartitionStrategy,
  DefaultDataClassificationStrategy,
  PartitionStrategy,
  DataClassification
} from '@moonx-farm/infrastructure';
import { WebSocketEventType } from '../types/events';

/**
 * WebSocket-specific partition strategy
 */
export class WebSocketPartitionStrategy extends DefaultPartitionStrategy {
  override getPartitionKey(eventType: string, data: any, userId?: string): string {
    // Priority: userId > data.userId > eventType category
    if (userId) {
      return userId;
    }
    
    if (data.userId) {
      return data.userId;
    }
    
    // For price events, use token + chainId for better distribution
    if (eventType === 'price.updated') {
      return `${data.token || 'unknown'}_${data.chainId || 'unknown'}`;
    }
    
    // For trade events, use orderId for consistency
    if (eventType.startsWith('trade.')) {
      const tradeId = data.orderId || data.tradeId;
      return tradeId ? String(tradeId) : 'unknown';
    }
    
    // Use event type category as fallback
    return eventType.split('.')[0] || 'unknown';
  }
}

/**
 * WebSocket-specific data classification strategy
 */
export class WebSocketDataClassificationStrategy extends DefaultDataClassificationStrategy {
  override getDataClassification(eventType: string, data: any): DataClassification {
    // Classify based on event type
    if (eventType.startsWith('user.')) {
      return 'confidential';
    }
    
    if (eventType.startsWith('portfolio.') || eventType.startsWith('trade.')) {
      return 'confidential';
    }
    
    if (eventType.startsWith('order.')) {
      return 'confidential';
    }
    
    if (eventType.startsWith('price.')) {
      return 'public';
    }
    
    if (eventType.startsWith('system.')) {
      return 'internal';
    }
    
    return 'internal';
  }
}

// Export singleton instance with websocket-specific strategies
export const eventFactory = new EventFactory(
  'websocket-service',
  '1.0.0',
  new WebSocketPartitionStrategy(),
  new WebSocketDataClassificationStrategy()
);

// Convenience functions for creating specific events
export const createPriceUpdatedEvent = (
  data: any,
  options: any = {}
) => eventFactory.createEvent('price.updated', data, options);

export const createOrderCreatedEvent = (
  data: any,
  options: any = {}
) => eventFactory.createEvent('order.created', data, options);

export const createOrderUpdatedEvent = (
  data: any,
  options: any = {}
) => eventFactory.createEvent('order.updated', data, options);

export const createPortfolioUpdatedEvent = (
  data: any,
  options: any = {}
) => eventFactory.createEvent('portfolio.updated', data, options);

export const createTradeExecutedEvent = (
  data: any,
  options: any = {}
) => eventFactory.createEvent('trade.executed', data, options);

export const createSystemErrorEvent = (
  error: Error,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  affectedUsers?: string[],
  options: any = {}
) => eventFactory.createErrorEvent(error, severity, undefined, options); 