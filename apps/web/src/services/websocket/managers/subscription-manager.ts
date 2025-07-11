import { EventEmitter } from 'events';
import { JsonRpcMethods, StatsSubscriptionOptions } from '../types';
import { JsonRpcMessageHelper } from '@moonx-farm/shared';

export class SubscriptionManager extends EventEmitter {
  private subscriptions: Set<string> = new Set();
  private subscribedChannels: Set<string> = new Set();
  private pendingSubscriptions: Map<string, { resolve: Function; reject: Function }> = new Map();
  private messageIdCounter = 0;

  constructor() {
    super();
  }

  // Generate unique message ID
  private generateMessageId(): string {
    return `${Date.now()}-${++this.messageIdCounter}`;
  }

  // Subscribe to a channel
  public async subscribe(channel: string, params?: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const messageId = this.generateMessageId();
      this.pendingSubscriptions.set(messageId, { resolve, reject });
      
      // Track subscription
      this.subscriptions.add(channel);
      
      // Send subscription message
      const message = JsonRpcMessageHelper.createRequest(
        JsonRpcMethods.SUBSCRIBE,
        { channel, ...params },
        messageId
      );
      
      this.emit('send-message', message);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingSubscriptions.has(messageId)) {
          this.pendingSubscriptions.delete(messageId);
          reject(new Error(`Subscription to ${channel} timed out`));
        }
      }, 10000);
    });
  }

  // Unsubscribe from a channel
  public async unsubscribe(channel: string, params?: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const messageId = this.generateMessageId();
      this.pendingSubscriptions.set(messageId, { resolve, reject });
      
      // Remove from subscriptions
      this.subscriptions.delete(channel);
      this.subscribedChannels.delete(channel);
      
      // Send unsubscription message
      const message = JsonRpcMessageHelper.createRequest(
        JsonRpcMethods.UNSUBSCRIBE,
        { channel, ...params },
        messageId
      );
      
      this.emit('send-message', message);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingSubscriptions.has(messageId)) {
          this.pendingSubscriptions.delete(messageId);
          reject(new Error(`Unsubscription from ${channel} timed out`));
        }
      }, 10000);
    });
  }

  // Handle subscription confirmation
  public handleSubscriptionResponse(messageId: string, result: any): void {
    const pending = this.pendingSubscriptions.get(messageId);
    if (pending) {
      this.pendingSubscriptions.delete(messageId);
      
      if (result?.subscribed) {
        const channel = result.channel;
        if (channel) {
          this.subscribedChannels.add(channel);
        }
        pending.resolve(result);
      } else {
        pending.reject(new Error('Subscription failed'));
      }
    }
  }

  // Handle auto-subscription confirmation
  public handleAutoSubscription(params: any): void {
    if (params && typeof params === 'object' && !Array.isArray(params)) {
      if (params.globalChannels && Array.isArray(params.globalChannels)) {
        params.globalChannels.forEach((channel: string) => {
          this.subscribedChannels.add(channel);
        });
      }
      if (params.userChannels && Array.isArray(params.userChannels)) {
        params.userChannels.forEach((channel: string) => {
          this.subscribedChannels.add(channel);
        });
      }
    }
  }

  // Re-subscribe to all channels (for reconnection)
  public resubscribeAll(): void {
    console.log('🔄 Re-subscribing to channels:', Array.from(this.subscriptions));
    
    this.subscriptions.forEach(channel => {
      const message = JsonRpcMessageHelper.createRequest(
        JsonRpcMethods.SUBSCRIBE,
        { channel },
        this.generateMessageId()
      );
      
      this.emit('send-message', message);
    });
  }

  // Price subscription methods
  public async subscribeToPrice(symbol: string): Promise<void> {
    console.log('📈 Subscribing to price updates:', symbol);
    return this.subscribe('prices', { symbol });
  }

  public async unsubscribeFromPrice(symbol: string): Promise<void> {
    console.log('❌ Unsubscribing from price updates:', symbol);
    return this.unsubscribe('prices', { symbol });
  }

  // Trade subscription methods
  public async subscribeToTrades(symbol?: string): Promise<void> {
    console.log('💱 Subscribing to trades:', symbol || 'all');
    return this.subscribe('trades', symbol ? { symbol } : undefined);
  }

  public async unsubscribeFromTrades(symbol?: string): Promise<void> {
    console.log('❌ Unsubscribing from trades:', symbol || 'all');
    return this.unsubscribe('trades', symbol ? { symbol } : undefined);
  }

  // Portfolio subscription methods
  public async subscribeToPortfolio(): Promise<void> {
    console.log('💼 Subscribing to portfolio updates');
    return this.subscribe('portfolio');
  }

  public async unsubscribeFromPortfolio(): Promise<void> {
    console.log('❌ Unsubscribing from portfolio updates');
    return this.unsubscribe('portfolio');
  }

  // Order subscription methods
  public async subscribeToOrders(): Promise<void> {
    console.log('📋 Subscribing to order updates');
    return this.subscribe('orders');
  }

  public async unsubscribeFromOrders(): Promise<void> {
    console.log('❌ Unsubscribing from order updates');
    return this.unsubscribe('orders');
  }

  // DCA subscription methods
  public async subscribeToUserDCA(): Promise<void> {
    console.log('📊 Subscribing to DCA updates');
    return this.subscribe('dca');
  }

  public async unsubscribeFromUserDCA(): Promise<void> {
    console.log('❌ Unsubscribing from DCA updates');
    return this.unsubscribe('dca');
  }

  // User-specific subscription methods
  public async subscribeToUserNotifications(): Promise<void> {
    console.log('🔔 Subscribing to user notifications');
    return this.subscribe('user_specific');
  }

  public async unsubscribeFromUserNotifications(): Promise<void> {
    console.log('❌ Unsubscribing from user notifications');
    return this.unsubscribe('user_specific');
  }

  // Stats subscription methods
  public async subscribeToStats(options?: StatsSubscriptionOptions): Promise<void> {
    console.log('📈 Subscribing to stats updates', options);
    return this.subscribe('stats', options);
  }

  public async unsubscribeFromStats(): Promise<void> {
    console.log('❌ Unsubscribing from stats updates');
    return this.unsubscribe('stats');
  }

  public async subscribeToChainPerformance(chainIds?: number[]): Promise<void> {
    console.log('⛓️ Subscribing to chain performance updates', chainIds);
    return this.subscribe('chain_performance', chainIds ? { chainIds } : undefined);
  }

  public async unsubscribeFromChainPerformance(): Promise<void> {
    console.log('❌ Unsubscribing from chain performance updates');
    return this.unsubscribe('chain_performance');
  }

  public async subscribeToBridgeLatency(providers?: Array<'LI.FI' | 'Relay.link' | '1inch'>): Promise<void> {
    console.log('🌉 Subscribing to bridge latency updates', providers);
    return this.subscribe('bridge_latency', providers ? { providers } : undefined);
  }

  public async unsubscribeFromBridgeLatency(): Promise<void> {
    console.log('❌ Unsubscribing from bridge latency updates');
    return this.unsubscribe('bridge_latency');
  }

  // Room subscription methods (generic)
  public async subscribeToRoom(room: string): Promise<void> {
    console.log('🏠 Subscribing to room:', room);
    return this.subscribe(room);
  }

  public async unsubscribeFromRoom(room: string): Promise<void> {
    console.log('❌ Unsubscribing from room:', room);
    return this.unsubscribe(room);
  }

  // Status check methods
  public isSubscribed(channel: string): boolean {
    return this.subscriptions.has(channel);
  }

  public isChannelActive(channel: string): boolean {
    return this.subscribedChannels.has(channel);
  }

  public isUserRoomJoined(): boolean {
    return this.subscribedChannels.has('user_specific');
  }

  public isStatsSubscribed(): boolean {
    return this.subscriptions.has('stats') || 
           this.subscriptions.has('chain_performance') || 
           this.subscriptions.has('bridge_latency');
  }

  // Get subscription info
  public getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  public getActiveChannels(): string[] {
    return Array.from(this.subscribedChannels);
  }

  public getStatsSubscriptions(): string[] {
    return Array.from(this.subscriptions).filter(sub => 
      sub.includes('stats') || sub.includes('chain_performance') || sub.includes('bridge_latency')
    );
  }

  public getPendingSubscriptions(): string[] {
    return Array.from(this.pendingSubscriptions.keys());
  }

  // Clear all subscriptions
  public clearAll(): void {
    this.subscriptions.clear();
    this.subscribedChannels.clear();
    this.pendingSubscriptions.clear();
  }

  // Cleanup
  public cleanup(): void {
    console.log('🧹 Cleaning up subscription manager...');
    
    // Reject all pending subscriptions
    this.pendingSubscriptions.forEach(({ reject }) => {
      reject(new Error('Service shutting down'));
    });
    
    this.clearAll();
    this.removeAllListeners();
  }
} 