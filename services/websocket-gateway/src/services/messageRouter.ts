// Minimal Message Router for WebSocket Gateway
import { logger } from '@moonx-farm/common';
import { createRoomName } from '../types';

export class MessageRouter {
  private handlers: Map<string, (socket: any, data: any) => Promise<void>> = new Map();

  constructor() {
    this.setupDefaultHandlers();
  }

  private setupDefaultHandlers(): void {
    // Price subscription handler
    this.handlers.set('subscribe_price', async (socket, data) => {
      const { symbol } = data;
      if (symbol && typeof symbol === 'string') {
        await socket.join(createRoomName.price(symbol.toUpperCase()));
        socket.emit('price_subscribed', { symbol: symbol.toUpperCase() });
        logger.debug('Price subscription', { userId: socket.userId, symbol });
      }
    });

    // Trade subscription handler
    this.handlers.set('subscribe_trades', async (socket, data) => {
      const { pair } = data;
      if (pair && typeof pair === 'string') {
        await socket.join(createRoomName.trade(pair.toUpperCase()));
        socket.emit('trades_subscribed', { pair: pair.toUpperCase() });
        logger.debug('Trades subscription', { userId: socket.userId, pair });
      }
    });

    // Portfolio subscription handler
    this.handlers.set('subscribe_portfolio', async (socket, data) => {
      await socket.join(createRoomName.portfolio(socket.userId));
      socket.emit('portfolio_subscribed', { userId: socket.userId });
      logger.debug('Portfolio subscription', { userId: socket.userId });
    });

    // Order status subscription
    this.handlers.set('subscribe_orders', async (socket, data) => {
      await socket.join(createRoomName.orders(socket.userId));
      socket.emit('orders_subscribed', { userId: socket.userId });
      logger.debug('Orders subscription', { userId: socket.userId });
    });

    // Unsubscribe handlers
    this.handlers.set('unsubscribe', async (socket, data) => {
      const { type, identifier } = data;
      if (type && identifier) {
        await socket.leave(`${type}:${identifier}`);
        socket.emit('unsubscribed', { type, identifier });
        logger.debug('Unsubscribed', { userId: socket.userId, type, identifier });
      }
    });

    // Ping/pong handler
    this.handlers.set('ping', async (socket, data) => {
      socket.emit('pong', { 
        timestamp: Date.now(),
        serverTime: new Date().toISOString()
      });
    });
  }

  registerHandler(event: string, handler: (socket: any, data: any) => Promise<void>): void {
    this.handlers.set(event, handler);
  }

  async routeMessage(socket: any, event: string, data: any): Promise<void> {
    try {
      const handler = this.handlers.get(event);
      
      if (handler) {
        await handler(socket, data);
        logger.debug('Message routed', { 
          userId: socket.userId, 
          event, 
          hasData: !!data 
        });
      } else {
        // Unknown event - just log it
        logger.warn('Unknown message event', { 
          userId: socket.userId, 
          event, 
          data: typeof data 
        });
        
        socket.emit('error', { 
          message: 'Unknown event type',
          event 
        });
      }
    } catch (error) {
      logger.error('Message routing error', {
        userId: socket.userId,
        event,
        error: error instanceof Error ? error.message : String(error)
      });
      
      socket.emit('error', { 
        message: 'Message processing failed',
        event 
      });
    }
  }

  getRegisteredEvents(): string[] {
    return Array.from(this.handlers.keys());
  }

  removeHandler(event: string): boolean {
    return this.handlers.delete(event);
  }
} 