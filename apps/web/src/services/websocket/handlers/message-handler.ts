import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { JsonRpcValidator, JsonRpcMessage } from '@moonx-farm/shared';
import { 
  JsonRpcMethods, 
  PriceUpdate, 
  TradeNotification, 
  PortfolioUpdate, 
  OrderUpdate 
} from '../types';

export class MessageHandler extends EventEmitter {
  constructor() {
    super();
  }

  // Main message processing method
  public processMessage(message: JsonRpcMessage | any): void {
    console.log('📥 Processing WebSocket message:', message);

    // Handle JSON-RPC responses first
    if (JsonRpcValidator.isResponse(message) || JsonRpcValidator.isErrorResponse(message)) {
      this.handleResponse(message);
    }
    
    // Handle JSON-RPC requests/notifications (method field)
    else if (JsonRpcValidator.isRequest(message) || JsonRpcValidator.isNotification(message)) {
      this.handleJsonRpcMessage(message);
    }
    
    // Handle Kafka messages (type field)
    else if (message?.type && typeof message.type === 'string') {
      this.handleKafkaMessage(message);
    }
    
    else {
      console.log('📩 Unknown message format:', message);
    }
  }

  // Handle JSON-RPC messages
  private handleJsonRpcMessage(message: JsonRpcMessage): void {
    // Only handle requests and notifications, not responses
    if (!JsonRpcValidator.isRequest(message) && !JsonRpcValidator.isNotification(message)) {
      return;
    }
    
    switch (message.method) {
      case JsonRpcMethods.AUTH_REQUIRED:
        this.emit('auth-required');
        break;

      case JsonRpcMethods.PONG:
        this.emit('pong');
        break;

      case JsonRpcMethods.AUTO_SUBSCRIBED:
        this.emit('auto-subscribed', message.params);
        break;

      case JsonRpcMethods.PRICE_UPDATE:
        this.handlePriceUpdate(message.params);
        break;

      case JsonRpcMethods.TRADE_UPDATE:
        this.handleTradeUpdate(message.params);
        break;

      case JsonRpcMethods.PORTFOLIO_UPDATE:
        this.emit('portfolio-update', message.params);
        break;

      case JsonRpcMethods.ORDER_UPDATE:
        this.emit('order-update', message.params);
        break;

      case JsonRpcMethods.NOTIFICATION:
        this.emit('notification', message.params);
        break;

      case JsonRpcMethods.SYSTEM_ALERT:
        this.emit('system-alert', message.params);
        break;

      case JsonRpcMethods.CHAIN_STATS_UPDATE:
        this.emit('chain_stats_update', message.params);
        break;

      case JsonRpcMethods.BRIDGE_STATS_UPDATE:
        this.emit('bridge_stats_update', message.params);
        break;

      case JsonRpcMethods.STATS_OVERVIEW_UPDATE:
        this.emit('stats_overview_update', message.params);
        break;

      default:
        console.log('📩 Unknown JSON-RPC method:', message.method);
    }
  }

  // Handle Kafka messages
  private handleKafkaMessage(message: any): void {
    console.log('📨 Processing Kafka message:', message);
    
    switch (message.type) {
      case 'chain_stats_update':
        this.emit('chain_stats_update', message.data);
        break;
        
      case 'bridge_stats_update':
        this.emit('bridge_stats_update', message.data);
        break;
        
      case 'stats_overview_update':
        this.emit('stats_overview_update', message.data);
        break;
        
      case 'price_update':
        this.handlePriceUpdate(message.data);
        break;
        
      case 'trade_update':
        this.handleTradeUpdate(message.data);
        break;
        
      case 'portfolio_update':
        this.emit('portfolio-update', message.data);
        break;
        
      case 'order_update':
        this.emit('order-update', message.data);
        break;
        
      default:
        console.log('📩 Unknown Kafka message type:', message.type);
    }
  }

  // Handle JSON-RPC responses
  private handleResponse(message: JsonRpcMessage): void {
    if (JsonRpcValidator.isResponse(message)) {
      console.log('✅ Received successful response:', message.result);
      
      if (message.result?.message === 'Authentication successful') {
        this.emit('auth-success', message.result);
      } else if (message.result?.subscribed !== undefined) {
        this.emit('subscription-response', message.id, message.result);
      } else {
        this.emit('response', message.id, message.result);
      }
    } else if (JsonRpcValidator.isErrorResponse(message)) {
      console.error('❌ Received error response:', message.error);
      
      if (message.error?.message?.includes('Authentication failed')) {
        this.emit('auth-failed', message.error.message);
      } else {
        this.emit('error', message.error);
      }
    }
  }

  // Handle price update messages
  private handlePriceUpdate(params: any): void {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      console.warn('⚠️ Invalid price update params:', params);
      return;
    }

    const priceUpdate: PriceUpdate = {
      symbol: params.symbol || params.token || 'UNKNOWN',
      price: parseFloat(params.price || params.priceUsd || '0'),
      change: parseFloat(params.change24h || '0'),
      volume: parseFloat(params.volume24h || '0'),
      timestamp: params.timestamp || Date.now()
    };

    console.log('📈 Price update processed:', priceUpdate);
    this.emit('price-update', priceUpdate);
  }

  // Handle trade update messages
  private handleTradeUpdate(params: any): void {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      console.warn('⚠️ Invalid trade update params:', params);
      return;
    }

    const amountIn = parseFloat(params.amountIn || '0');
    const amountOut = parseFloat(params.amountOut || '0');
    
    const tradeNotification: TradeNotification = {
      id: params.tradeId || uuidv4(),
      symbol: `${params.tokenIn || 'UNKNOWN'}/${params.tokenOut || 'UNKNOWN'}`,
      type: this.determineTradeType(params),
      amount: amountIn,
      price: amountIn > 0 ? amountOut / amountIn : 0,
      value: amountOut,
      status: params.status || 'completed',
      timestamp: params.timestamp || Date.now()
    };

    console.log('💱 Trade update processed:', tradeNotification);
    this.emit('trade-notification', tradeNotification);
  }

  // Helper methods
  private determineTradeType(params: any): 'buy' | 'sell' {
    return 'buy'; // Default to buy for now
  }

  // Cleanup
  public cleanup(): void {
    console.log('🧹 Cleaning up message handler...');
    this.removeAllListeners();
  }
} 