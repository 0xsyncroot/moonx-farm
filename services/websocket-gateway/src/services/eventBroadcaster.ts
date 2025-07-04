// Event Broadcaster Service - Bridges Kafka events to WebSocket clients
import { Server } from 'socket.io';
import { logger } from '@moonx-farm/common';
import { ConnectionManager } from './connectionManager';
import { PrometheusMetrics } from './prometheusMetrics';
import { 
  DEXEvent, 
  DEXEventType, 
  WEBSOCKET_EVENTS, 
  createRoomName, 
  GENERAL_ROOMS 
} from '../types';

export class EventBroadcasterService {
  private io: Server;
  private connectionManager: ConnectionManager;
  private prometheusMetrics: PrometheusMetrics;

  constructor(
    io: Server,
    connectionManager: ConnectionManager,
    prometheusMetrics: PrometheusMetrics
  ) {
    this.io = io;
    this.connectionManager = connectionManager;
    this.prometheusMetrics = prometheusMetrics;
  }

  async broadcastEvent(event: DEXEvent): Promise<void> {
    try {
      const startTime = Date.now();
      
      switch (event.type) {
        case DEXEventType.PRICE_UPDATE:
          await this.broadcastPriceUpdate(event);
          break;
        case DEXEventType.ORDER_BOOK_UPDATE:
          await this.broadcastOrderBookUpdate(event);
          break;
        case DEXEventType.TRADE_NOTIFICATION:
          await this.broadcastTradeNotification(event);
          break;
        case DEXEventType.PORTFOLIO_UPDATE:
          await this.broadcastPortfolioUpdate(event);
          break;
        case DEXEventType.SYSTEM_ALERT:
          await this.broadcastSystemAlert(event);
          break;
        default:
          logger.warn('Unknown event type', { type: event.type });
      }

      // Record metrics - increment messages processed
      this.prometheusMetrics.incrementMessagesSent();
      
    } catch (error) {
      logger.error('Error broadcasting event', {
        type: event.type,
        symbol: event.symbol,
        error: error instanceof Error ? error.message : String(error)
      });
      
      this.prometheusMetrics.incrementErrors();
    }
  }

  private async broadcastPriceUpdate(event: DEXEvent): Promise<void> {
    const { symbol, data } = event;
    
    if (!symbol) {
      logger.warn('Price update missing symbol', { event });
      return;
    }

    // Broadcast to all clients subscribed to price updates
    const room = createRoomName.price(symbol);
    this.io.to(room).emit(WEBSOCKET_EVENTS[DEXEventType.PRICE_UPDATE], {
      symbol,
      price: data.price,
      change: data.change,
      volume: data.volume,
      timestamp: event.timestamp
    });

    // Also broadcast to general price room
    this.io.to(GENERAL_ROOMS.PRICE_UPDATES).emit(WEBSOCKET_EVENTS[DEXEventType.PRICE_UPDATE], {
      symbol,
      price: data.price,
      change: data.change,
      volume: data.volume,
      timestamp: event.timestamp
    });

    logger.debug('Price update broadcasted', { 
      symbol, 
      price: data.price,
      clientsCount: await this.getClientsCount(room)
    });
  }

  private async broadcastOrderBookUpdate(event: DEXEvent): Promise<void> {
    const { symbol, data } = event;
    
    if (!symbol) {
      logger.warn('Order book update missing symbol', { event });
      return;
    }

    const room = createRoomName.orderbook(symbol);
    this.io.to(room).emit(WEBSOCKET_EVENTS[DEXEventType.ORDER_BOOK_UPDATE], {
      symbol,
      bids: data.bids,
      asks: data.asks,
      timestamp: event.timestamp
    });

    logger.debug('Order book update broadcasted', { 
      symbol,
      clientsCount: await this.getClientsCount(room)
    });
  }

  private async broadcastTradeNotification(event: DEXEvent): Promise<void> {
    const { symbol, userId, data } = event;

    // Broadcast to symbol-specific room
    if (symbol) {
      const symbolRoom = createRoomName.trade(symbol);
      this.io.to(symbolRoom).emit(WEBSOCKET_EVENTS[DEXEventType.TRADE_NOTIFICATION], {
        symbol,
        price: data.price,
        amount: data.amount,
        side: data.side,
        timestamp: event.timestamp
      });
    }

    // Broadcast to user-specific room (if userId provided)
    if (userId) {
      const userRoom = createRoomName.user(userId);
      this.io.to(userRoom).emit(WEBSOCKET_EVENTS[DEXEventType.TRADE_NOTIFICATION], {
        symbol,
        price: data.price,
        amount: data.amount,
        side: data.side,
        timestamp: event.timestamp,
        personal: true
      });
    }

    logger.debug('Trade notification broadcasted', { 
      symbol: symbol || 'unknown',
      userId: userId || 'unknown',
      side: data.side || 'unknown'
    });
  }

  private async broadcastPortfolioUpdate(event: DEXEvent): Promise<void> {
    const { userId, data } = event;
    
    if (!userId) {
      logger.warn('Portfolio update missing userId', { event });
      return;
    }

    const userRoom = createRoomName.user(userId);
    this.io.to(userRoom).emit(WEBSOCKET_EVENTS[DEXEventType.PORTFOLIO_UPDATE], {
      totalValue: data.totalValue,
      positions: data.positions,
      pnl: data.pnl,
      timestamp: event.timestamp
    });

    logger.debug('Portfolio update broadcasted', { userId });
  }

  private async broadcastSystemAlert(event: DEXEvent): Promise<void> {
    const { data } = event;

    // Broadcast to all connected clients
    this.io.emit(WEBSOCKET_EVENTS[DEXEventType.SYSTEM_ALERT], {
      level: data.level,
      message: data.message,
      timestamp: event.timestamp
    });

    logger.info('System alert broadcasted', { 
      level: data.level,
      message: data.message
    });
  }

  private async getClientsCount(room: string): Promise<number> {
    try {
      const clients = await this.io.in(room).fetchSockets();
      return clients.length;
    } catch (error) {
      logger.error('Error getting clients count', { 
        room,
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }

  // Stats for monitoring
  async getBroadcastStats(): Promise<{
    totalRooms: number;
    totalClients: number;
    roomStats: Array<{ room: string; clients: number }>;
  }> {
    try {
      const rooms = [
        GENERAL_ROOMS.PRICE_UPDATES,
        GENERAL_ROOMS.TRADE_NOTIFICATIONS,
        GENERAL_ROOMS.PORTFOLIO_UPDATES,
        GENERAL_ROOMS.SYSTEM_ALERTS
      ];
      const roomStats = [];
      let totalClients = 0;

      for (const room of rooms) {
        const clients = await this.getClientsCount(room);
        roomStats.push({ room, clients });
        totalClients += clients;
      }

      return {
        totalRooms: rooms.length,
        totalClients,
        roomStats
      };
    } catch (error) {
      logger.error('Error getting broadcast stats', { 
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        totalRooms: 0,
        totalClients: 0,
        roomStats: []
      };
    }
  }
} 