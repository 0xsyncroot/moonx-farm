import { EventEmitter } from 'events';
import { WebSocketManager } from './managers/websocket-manager';
import { FirebaseManager } from './managers/firebase-manager';
import { SubscriptionManager } from './managers/subscription-manager';
import { AuthManager } from './managers/auth-manager';
import { MessageHandler } from './handlers/message-handler';
import { 
  ConnectionStatus, 
  NotificationConfig, 
  WebSocketConfig, 
  FirebaseConfig,
  JsonRpcMethods,
  StatsSubscriptionOptions,
  ChainPerformanceStats,
  BridgeLatencyStats,
  StatsOverview
} from './types';

export class WebSocketService extends EventEmitter {
  private wsManager: WebSocketManager;
  private firebaseManager: FirebaseManager;
  private subscriptionManager: SubscriptionManager;
  private authManager: AuthManager;
  private messageHandler: MessageHandler;
  
  private connectionStatus: ConnectionStatus = {
    websocket: 'disconnected',
    firebase: 'requesting-permission',
    online: true
  };
  
  private config: NotificationConfig = {
    enablePriceAlerts: true,
    enableTradeNotifications: true,
    enablePortfolioUpdates: true,
    enableSystemAlerts: true,
    enableStatsUpdates: true,
    enableChainPerformanceAlerts: true,
    enableBridgeLatencyAlerts: true,
    offlineNotifications: true
  };

  constructor(
    websocketUrl: string,
    firebaseConfig: FirebaseConfig,
    jwtToken: string,
    userId?: string | null
  ) {
    super();
    
    // Initialize managers
    this.wsManager = new WebSocketManager({
      websocketUrl,
      jwtToken,
      userId
    });
    
    this.firebaseManager = new FirebaseManager(firebaseConfig, jwtToken);
    this.subscriptionManager = new SubscriptionManager();
    this.authManager = new AuthManager(jwtToken, userId);
    this.messageHandler = new MessageHandler();
    
    // Setup event listeners
    this.setupEventListeners();
    this.setupSystemEventListeners();
  }

  // Setup event listeners between managers
  private setupEventListeners(): void {
    // WebSocket Manager events
    this.wsManager.on('connecting', () => {
      this.connectionStatus.websocket = 'connecting';
      this.emit('websocket-connecting');
    });

    this.wsManager.on('connected', () => {
      this.emit('websocket-connected');
    });

    this.wsManager.on('disconnected', (data) => {
      this.connectionStatus.websocket = 'disconnected';
      this.emit('websocket-disconnected', data);
    });

    this.wsManager.on('authenticated', () => {
      this.connectionStatus.websocket = 'connected';
      this.subscriptionManager.resubscribeAll();
      this.wsManager.processOfflineQueue();
      this.wsManager.startHeartbeat();
      this.emit('websocket-authenticated');
    });

    this.wsManager.on('message', (message) => {
      this.messageHandler.processMessage(message);
    });

    this.wsManager.on('error', (error) => {
      this.emit('websocket-error', error);
    });

    // Firebase Manager events
    this.firebaseManager.on('ready', (fcmToken) => {
      this.connectionStatus.firebase = 'ready';
      this.emit('firebase-ready', fcmToken);
    });

    this.firebaseManager.on('error', (error) => {
      this.connectionStatus.firebase = 'error';
      this.emit('firebase-error', error);
    });

    this.firebaseManager.on('message', (payload) => {
      this.emit('firebase-message', payload);
    });

    // Subscription Manager events
    this.subscriptionManager.on('send-message', (message) => {
      this.wsManager.send(message);
    });

    // Auth Manager events
    this.authManager.on('send-auth-message', (message) => {
      this.wsManager.send(message);
    });

    this.authManager.on('authenticated', (result) => {
      this.wsManager.markAsAuthenticated();
    });

    this.authManager.on('authentication-failed', (error) => {
      this.emit('websocket-auth-failed', error);
    });

    // Message Handler events
    this.messageHandler.on('auth-required', () => {
      this.authManager.handleAuthRequired();
    });

    this.messageHandler.on('auth-success', (result) => {
      this.authManager.emit('auth-success', result);
    });

    this.messageHandler.on('auth-failed', (error) => {
      this.authManager.emit('auth-failed', error);
    });

    this.messageHandler.on('pong', () => {
      this.wsManager.updateLastHeartbeat();
    });

    this.messageHandler.on('auto-subscribed', (params) => {
      this.subscriptionManager.handleAutoSubscription(params);
    });

    this.messageHandler.on('subscription-response', (messageId, result) => {
      this.subscriptionManager.handleSubscriptionResponse(messageId, result);
    });

    // Forward all data events from message handler
    this.messageHandler.on('price-update', (data) => this.emit('price-update', data));
    this.messageHandler.on('trade-notification', (data) => this.emit('trade-notification', data));
    this.messageHandler.on('portfolio-update', (data) => this.emit('portfolio-update', data));
    this.messageHandler.on('order-update', (data) => this.emit('order-update', data));
    this.messageHandler.on('stats-chain-performance', (data) => this.emit('stats-chain-performance', data));
    this.messageHandler.on('stats-bridge-latency', (data) => this.emit('stats-bridge-latency', data));
    this.messageHandler.on('stats-overview', (data) => this.emit('stats-overview', data));
    this.messageHandler.on('notification', (data) => this.emit('notification', data));
    this.messageHandler.on('system-alert', (data) => this.emit('system-alert', data));
  }

  // Setup system event listeners
  private setupSystemEventListeners(): void {
    if (typeof window === 'undefined') return;

    // Online/offline detection
    window.addEventListener('online', () => {
      console.log('🌐 Browser back online');
      this.connectionStatus.online = true;
      this.initializeServices();
    });

    window.addEventListener('offline', () => {
      console.log('📡 Browser went offline');
      this.connectionStatus.online = false;
    });

    // Page visibility change
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.connectionStatus.online) {
          if (this.connectionStatus.websocket === 'disconnected') {
            this.initializeServices();
          }
        }
      });
    }
  }

  // Initialize services
  public async initializeServices(): Promise<void> {
    try {
      console.log('🚀 Initializing WebSocket services...');
      
      // Initialize WebSocket and Firebase in parallel (don't let Firebase block WebSocket)
      const initPromises: Promise<any>[] = [];
      
      // WebSocket is critical - always initialize
      if (this.connectionStatus.online) {
        console.log('🔌 Starting WebSocket connection...');
        initPromises.push(this.wsManager.connect());
      }
      
      // Firebase is optional - initialize in background
      console.log('🔥 Starting Firebase initialization...');
      initPromises.push(
        this.firebaseManager.initialize().catch(error => {
          console.warn('⚠️ Firebase initialization failed (optional):', error);
          // Don't fail the entire initialization if Firebase fails
        })
      );
      
      // Wait for WebSocket (and optionally Firebase)
      await Promise.allSettled(initPromises);
      
      console.log('✅ WebSocket services initialization completed');
      this.emit('initialized', this.connectionStatus);
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket services:', error);
      this.emit('error', error);
    }
  }



  // Public API methods

  // Price subscription methods
  public async subscribeToPrice(symbol: string): Promise<void> {
    return this.subscriptionManager.subscribeToPrice(symbol);
  }

  public async unsubscribeFromPrice(symbol: string): Promise<void> {
    return this.subscriptionManager.unsubscribeFromPrice(symbol);
  }

  // Trade subscription methods
  public async subscribeToTrades(symbol?: string): Promise<void> {
    return this.subscriptionManager.subscribeToTrades(symbol);
  }

  public async unsubscribeFromTrades(symbol?: string): Promise<void> {
    return this.subscriptionManager.unsubscribeFromTrades(symbol);
  }

  // Portfolio subscription methods
  public async subscribeToPortfolio(): Promise<void> {
    return this.subscriptionManager.subscribeToPortfolio();
  }

  public async unsubscribeFromPortfolio(): Promise<void> {
    return this.subscriptionManager.unsubscribeFromPortfolio();
  }

  // Order subscription methods
  public async subscribeToOrders(): Promise<void> {
    return this.subscriptionManager.subscribeToOrders();
  }

  public async unsubscribeFromOrders(): Promise<void> {
    return this.subscriptionManager.unsubscribeFromOrders();
  }

  // DCA subscription methods
  public async subscribeToUserDCA(): Promise<void> {
    return this.subscriptionManager.subscribeToUserDCA();
  }

  public async unsubscribeFromUserDCA(): Promise<void> {
    return this.subscriptionManager.unsubscribeFromUserDCA();
  }

  // User notification methods
  public async subscribeToUserNotifications(): Promise<void> {
    return this.subscriptionManager.subscribeToUserNotifications();
  }

  public async unsubscribeFromUserNotifications(): Promise<void> {
    return this.subscriptionManager.unsubscribeFromUserNotifications();
  }

  // Stats subscription methods
  public async subscribeToStats(options?: StatsSubscriptionOptions): Promise<void> {
    return this.subscriptionManager.subscribeToStats(options);
  }

  public async unsubscribeFromStats(): Promise<void> {
    return this.subscriptionManager.unsubscribeFromStats();
  }

  public async subscribeToChainPerformance(chainIds?: number[]): Promise<void> {
    return this.subscriptionManager.subscribeToChainPerformance(chainIds);
  }

  public async unsubscribeFromChainPerformance(): Promise<void> {
    return this.subscriptionManager.unsubscribeFromChainPerformance();
  }

  public async subscribeToBridgeLatency(providers?: Array<'LI.FI' | 'Relay.link' | '1inch'>): Promise<void> {
    return this.subscriptionManager.subscribeToBridgeLatency(providers);
  }

  public async unsubscribeFromBridgeLatency(): Promise<void> {
    return this.subscriptionManager.unsubscribeFromBridgeLatency();
  }

  // Generic room methods
  public async subscribeToRoom(room: string): Promise<void> {
    return this.subscriptionManager.subscribeToRoom(room);
  }

  public async unsubscribeFromRoom(room: string): Promise<void> {
    return this.subscriptionManager.unsubscribeFromRoom(room);
  }

  // Promise-based wait methods for stats
  public waitForChainPerformanceUpdate(timeout: number = 30000): Promise<ChainPerformanceStats> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener('stats-chain-performance', handler);
        reject(new Error('Timeout waiting for chain performance update'));
      }, timeout);

      const handler = (data: ChainPerformanceStats) => {
        clearTimeout(timer);
        this.removeListener('stats-chain-performance', handler);
        resolve(data);
      };

      this.once('stats-chain-performance', handler);
    });
  }

  public waitForBridgeLatencyUpdate(timeout: number = 30000): Promise<BridgeLatencyStats> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener('stats-bridge-latency', handler);
        reject(new Error('Timeout waiting for bridge latency update'));
      }, timeout);

      const handler = (data: BridgeLatencyStats) => {
        clearTimeout(timer);
        this.removeListener('stats-bridge-latency', handler);
        resolve(data);
      };

      this.once('stats-bridge-latency', handler);
    });
  }

  public waitForStatsOverviewUpdate(timeout: number = 30000): Promise<StatsOverview> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener('stats-overview', handler);
        reject(new Error('Timeout waiting for stats overview update'));
      }, timeout);

      const handler = (data: StatsOverview) => {
        clearTimeout(timer);
        this.removeListener('stats-overview', handler);
        resolve(data);
      };

      this.once('stats-overview', handler);
    });
  }

  // Configuration methods
  public updateConfig(newConfig: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config-updated', this.config);
  }

  public getConfig(): NotificationConfig {
    return { ...this.config };
  }

  // Status methods
  public getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  public isUserRoomJoined(): boolean {
    return this.subscriptionManager.isUserRoomJoined();
  }

  public isStatsSubscribed(): boolean {
    return this.subscriptionManager.isStatsSubscribed();
  }

  public getStatsSubscriptions(): string[] {
    return this.subscriptionManager.getStatsSubscriptions();
  }

  // Test methods
  public async sendTestNotification(): Promise<void> {
    return this.firebaseManager.sendTestNotification();
  }

  public ping(): void {
    this.wsManager.ping();
  }

  // Update methods
  public updateToken(newToken: string): void {
    this.wsManager.updateToken(newToken);
    this.authManager.updateToken(newToken);
    this.firebaseManager.updateJwtToken(newToken);
  }

  public updateUserId(newUserId: string | null): void {
    this.authManager.updateUserId(newUserId);
  }

  // Disconnect and cleanup
  public disconnect(): void {
    console.log('🔌 Disconnecting WebSocket service...');
    
    this.wsManager.disconnect();
    this.firebaseManager.cleanup();
    this.subscriptionManager.cleanup();
    this.authManager.cleanup();
    this.messageHandler.cleanup();
    
    this.removeAllListeners();
    
    console.log('✅ WebSocket service disconnected');
  }
} 