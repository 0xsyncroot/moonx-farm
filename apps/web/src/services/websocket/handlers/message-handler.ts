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
  public processMessage(message: JsonRpcMessage): void {
    console.log('📥 Processing WebSocket message:', message);

    // Handle notifications and requests (have method property)
    if (JsonRpcValidator.isNotification(message) || JsonRpcValidator.isRequest(message)) {
      this.handleNotification(message);
    }
    
    // Handle successful responses
    else if (JsonRpcValidator.isResponse(message)) {
      this.handleResponse(message);
    }
    
    // Handle error responses
    else if (JsonRpcValidator.isErrorResponse(message)) {
      this.handleErrorResponse(message);
    }
    
    else {
      console.log('📩 Unknown message format:', message);
    }
  }

  // Handle notification messages
  private handleNotification(message: JsonRpcMessage): void {
    if (!JsonRpcValidator.isNotification(message) && !JsonRpcValidator.isRequest(message)) return;
    if (!message.method) return;

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
        this.handlePortfolioUpdate(message.params);
        break;

      case JsonRpcMethods.ORDER_UPDATE:
        this.handleOrderUpdate(message.params);
        break;

      case JsonRpcMethods.STATS_CHAIN_PERFORMANCE_UPDATED:
        this.handleStatsChainPerformance(message.params);
        break;

      case JsonRpcMethods.STATS_BRIDGE_LATENCY_UPDATED:
        this.handleStatsBridgeLatency(message.params);
        break;

      case JsonRpcMethods.STATS_OVERVIEW_UPDATED:
        this.handleStatsOverview(message.params);
        break;

      case JsonRpcMethods.NOTIFICATION:
        this.handleNotificationMessage(message.params);
        break;

      case JsonRpcMethods.SYSTEM_ALERT:
        this.handleSystemAlert(message.params);
        break;

      default:
        console.log('📩 Unknown notification method:', message.method, message);
    }
  }

  // Handle response messages
  private handleResponse(message: JsonRpcMessage): void {
    if (!JsonRpcValidator.isResponse(message)) return;
    
    console.log('✅ Received successful response:', message.result);
    
    // Handle authentication success response
    if (message.result?.message === 'Authentication successful') {
      this.emit('auth-success', message.result);
    }
    
    // Handle subscription confirmations
    else if (message.result?.subscribed !== undefined) {
      this.emit('subscription-response', message.id, message.result);
    }
    
    // Handle generic successful responses
    else {
      this.emit('response', message.id, message.result);
    }
  }

  // Handle error responses
  private handleErrorResponse(message: JsonRpcMessage): void {
    if (!JsonRpcValidator.isErrorResponse(message)) return;
    
    console.error('❌ Received error response:', message.error);
    
    // Handle authentication failures
    if (message.error?.message?.includes('Authentication failed')) {
      this.emit('auth-failed', message.error.message);
    } else {
      this.emit('error', message.error);
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

  // Handle portfolio update messages
  private handlePortfolioUpdate(params: any): void {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      console.warn('⚠️ Invalid portfolio update params:', params);
      return;
    }

    const portfolioUpdate: PortfolioUpdate = {
      totalValue: parseFloat(params.totalValueUsd || '0'),
      change24h: parseFloat(params.change24h || '0'),
      tokens: Array.isArray(params.tokens) ? params.tokens : [],
      timestamp: params.timestamp || Date.now()
    };

    console.log('💼 Portfolio update processed:', portfolioUpdate);
    this.emit('portfolio-update', portfolioUpdate);
  }

  // Handle order update messages
  private handleOrderUpdate(params: any): void {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      console.warn('⚠️ Invalid order update params:', params);
      return;
    }

    const orderUpdate: OrderUpdate = {
      orderId: params.orderId || uuidv4(),
      symbol: `${params.tokenIn || 'UNKNOWN'}/${params.tokenOut || 'UNKNOWN'}`,
      type: params.orderType || 'limit',
      side: this.determineOrderSide(params),
      amount: parseFloat(params.amountIn || '0'),
      price: this.calculateOrderPrice(params),
      status: params.status || 'pending',
      timestamp: params.timestamp || Date.now()
    };

    console.log('📋 Order update processed:', orderUpdate);
    this.emit('order-update', orderUpdate);
  }

  // Handle stats chain performance messages
  private handleStatsChainPerformance(params: any): void {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      console.warn('⚠️ Invalid chain performance params:', params);
      return;
    }

    console.log('📊 Chain performance stats processed:', params);
    this.emit('stats-chain-performance', params);
  }

  // Handle stats bridge latency messages
  private handleStatsBridgeLatency(params: any): void {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      console.warn('⚠️ Invalid bridge latency params:', params);
      return;
    }

    console.log('🌉 Bridge latency stats processed:', params);
    this.emit('stats-bridge-latency', params);
  }

  // Handle stats overview messages
  private handleStatsOverview(params: any): void {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      console.warn('⚠️ Invalid stats overview params:', params);
      return;
    }

    console.log('📈 Stats overview processed:', params);
    this.emit('stats-overview', params);
  }

  // Handle notification messages
  private handleNotificationMessage(params: any): void {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      console.warn('⚠️ Invalid notification params:', params);
      return;
    }

    console.log('🔔 Notification processed:', params);
    this.emit('notification', params);
  }

  // Handle system alert messages
  private handleSystemAlert(params: any): void {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      console.warn('⚠️ Invalid system alert params:', params);
      return;
    }

    console.log('🚨 System alert processed:', params);
    this.emit('system-alert', params);
  }

  // Helper methods

  // Determine trade type based on params
  private determineTradeType(params: any): 'buy' | 'sell' {
    // Logic to determine if it's a buy or sell
    // This would depend on your business logic
    return 'buy'; // Default to buy for now
  }

  // Determine order side based on params
  private determineOrderSide(params: any): 'buy' | 'sell' {
    // Logic to determine if it's a buy or sell order
    // This would depend on your business logic
    return 'buy'; // Default to buy for now
  }

  // Calculate order price from params
  private calculateOrderPrice(params: any): number {
    const amountIn = parseFloat(params.amountIn || '0');
    const amountOut = parseFloat(params.amountOut || '0');
    
    if (amountIn > 0 && amountOut > 0) {
      return amountOut / amountIn;
    }
    
    return parseFloat(params.price || '0');
  }

  // Cleanup
  public cleanup(): void {
    console.log('🧹 Cleaning up message handler...');
    this.removeAllListeners();
  }
} 