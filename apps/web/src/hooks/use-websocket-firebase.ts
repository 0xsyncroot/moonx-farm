import { useState, useEffect, useCallback, useRef } from 'react';
import { WebSocketFirebaseService, PriceUpdate, TradeNotification, PortfolioUpdate, SystemAlert, ConnectionStatus, NotificationConfig, OrderUpdate } from '@/services/websocket';

interface UseWebSocketFirebaseProps {
  websocketUrl: string;
  firebaseConfig: any;
  jwtToken: string;
  userId?: string | null;  // ✅ FIX: Add userId parameter
  enabled?: boolean;
}

interface WebSocketFirebaseState {
  connectionStatus: ConnectionStatus;
  config: NotificationConfig;
  priceUpdates: Map<string, PriceUpdate>;
  tradeNotifications: TradeNotification[];
  portfolioUpdate: PortfolioUpdate | null;
  systemAlerts: SystemAlert[];
  orderUpdates: OrderUpdate[];
  isInitialized: boolean;
  error: string | null;
}

// ✅ FIX: Singleton pattern to prevent multiple service instances
let globalServiceInstance: WebSocketFirebaseService | null = null;
let globalServiceUsers = new Set<number>(); // Track which hooks are using the service
let pendingCleanupTimeout: NodeJS.Timeout | null = null;
let hookInstanceCount = 0;

export function useWebSocketFirebase({
  websocketUrl,
  firebaseConfig,
  jwtToken,
  userId,  // ✅ FIX: Extract userId parameter
  enabled = true
}: UseWebSocketFirebaseProps) {
  // Track this specific hook instance
  const hookInstanceId = useRef(++hookInstanceCount);

  const serviceRef = useRef<WebSocketFirebaseService | null>(null);
  const [state, setState] = useState<WebSocketFirebaseState>({
    connectionStatus: {
      websocket: 'disconnected',
      firebase: 'requesting-permission',
      online: typeof navigator !== 'undefined' ? navigator.onLine : true
    },
    config: {
      enablePriceAlerts: true,
      enableTradeNotifications: true,
      enablePortfolioUpdates: true,
      enableSystemAlerts: true,
      enableStatsUpdates: true,
      enableChainPerformanceAlerts: true,
      enableBridgeLatencyAlerts: true,
      offlineNotifications: true
    },
    priceUpdates: new Map(),
    tradeNotifications: [],
    portfolioUpdate: null,
    systemAlerts: [],
    orderUpdates: [],
    isInitialized: false,
    error: null
  });

  // ✅ FIX: Cleanup function with proper timing
  const cleanupService = useCallback((hookId: number) => {
    console.log(`🧹 WebSocket Hook ${hookId}: Cleaning up service`);
    
    // Remove this hook from global users
    globalServiceUsers.delete(hookId);
    
    // If no more hooks are using the service, schedule cleanup
    if (globalServiceUsers.size === 0 && globalServiceInstance) {
      // Clear any pending cleanup
      if (pendingCleanupTimeout) {
        clearTimeout(pendingCleanupTimeout);
      }
      
      // Schedule cleanup with delay to allow for React dev mode remounting
      pendingCleanupTimeout = setTimeout(() => {
        if (globalServiceUsers.size === 0 && globalServiceInstance) {
          console.log('🧹 WebSocket Service: Disconnecting - no more users');
          globalServiceInstance.disconnect();
          globalServiceInstance = null;
        }
        pendingCleanupTimeout = null;
      }, 100); // Short delay to handle React dev mode double invocation
    }
    
    // Clear local reference
    serviceRef.current = null;
  }, []);

  // Initialize service
  useEffect(() => {
    if (!enabled || !jwtToken) {
      return;
    }

    // ✅ FIX: Cancel any pending cleanup since we're about to use the service
    if (pendingCleanupTimeout) {
      console.log('🚫 WebSocket Service: Canceling pending cleanup');
      clearTimeout(pendingCleanupTimeout);
      pendingCleanupTimeout = null;
    }

    // ✅ FIX: Check if we can reuse existing global service
    if (globalServiceInstance) {
      console.log('♻️ WebSocket Service: Reusing existing service');
      serviceRef.current = globalServiceInstance;
      globalServiceUsers.add(hookInstanceId.current);
      
      // Setup event listeners for this hook
      setupEventListeners(globalServiceInstance);
      
      return () => cleanupService(hookInstanceId.current);
    }

    try {
      console.log('🚀 WebSocket Service: Creating new service');

      // ✅ FIX: Create singleton service
      globalServiceInstance = new WebSocketFirebaseService(
        websocketUrl,
        firebaseConfig,
        jwtToken,
        userId  // ✅ FIX: Pass userId from useAuth
      );

      serviceRef.current = globalServiceInstance;
      globalServiceUsers.add(hookInstanceId.current);

      const service = globalServiceInstance;

      // Setup event listeners
      setupEventListeners(service);

      // 🚀 CRITICAL FIX: Initialize services immediately after creation
      console.log('⚡ WebSocket Service: Starting initialization immediately...');
      service.initializeServices().catch(error => {
        console.error('❌ WebSocket Service: Failed to initialize:', error);
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to initialize service'
        }));
      });

      // Cleanup function
      return () => cleanupService(hookInstanceId.current);
    } catch (error) {
      console.error('❌ WebSocket Service: Failed to create service:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create service'
      }));
    }
  }, [enabled, jwtToken, websocketUrl, firebaseConfig, userId, cleanupService]); // ✅ FIX: Add userId dependency

  // ✅ FIX: Extract event listener setup to avoid duplication
  const setupEventListeners = useCallback((service: WebSocketFirebaseService) => {
    const handleInitialized = (status: ConnectionStatus) => {
      console.log('✅ WebSocket Service: Initialized successfully');
      setState(prev => ({
        ...prev,
        connectionStatus: status,
        isInitialized: true,
        error: null
      }));
    };

    const handleError = (error: Error) => {
      console.error('❌ WebSocket Service: Error:', error);
      setState(prev => ({
        ...prev,
        error: error.message
      }));
    };

    const handleWebSocketConnected = () => {
      setState(prev => ({
        ...prev,
        connectionStatus: {
          ...prev.connectionStatus,
          websocket: 'connecting'  // ✅ Still connecting until authenticated
        }
      }));
    };

    const handleWebSocketAuthenticated = () => {
      setState(prev => ({
        ...prev,
        connectionStatus: {
          ...prev.connectionStatus,
          websocket: 'connected'  // ✅ Only connected after authentication
        }
      }));
    };

    const handleWebSocketDisconnected = () => {
      setState(prev => ({
        ...prev,
        connectionStatus: {
          ...prev.connectionStatus,
          websocket: 'disconnected'
        }
      }));
    };

    const handleFirebaseReady = () => {
      setState(prev => ({
        ...prev,
        connectionStatus: {
          ...prev.connectionStatus,
          firebase: 'ready'
        }
      }));
    };

    const handleFirebaseError = () => {
      setState(prev => ({
        ...prev,
        connectionStatus: {
          ...prev.connectionStatus,
          firebase: 'error'
        }
      }));
    };

    const handleOnline = () => {
      setState(prev => ({
        ...prev,
        connectionStatus: {
          ...prev.connectionStatus,
          online: true
        }
      }));
    };

    const handleOffline = () => {
      setState(prev => ({
        ...prev,
        connectionStatus: {
          ...prev.connectionStatus,
          online: false
        }
      }));
    };

    const handlePriceUpdate = (data: PriceUpdate) => {
      setState(prev => {
        const newPriceUpdates = new Map(prev.priceUpdates);
        newPriceUpdates.set(data.symbol, data);
        return {
          ...prev,
          priceUpdates: newPriceUpdates
        };
      });
    };

    const handleTradeNotification = (data: TradeNotification) => {
      setState(prev => ({
        ...prev,
        tradeNotifications: [data, ...prev.tradeNotifications.slice(0, 99)] // Keep last 100
      }));
    };

    const handlePortfolioUpdate = (data: PortfolioUpdate) => {
      setState(prev => ({
        ...prev,
        portfolioUpdate: data
      }));
    };

    const handleSystemAlert = (data: SystemAlert) => {
      setState(prev => ({
        ...prev,
        systemAlerts: [data, ...prev.systemAlerts.slice(0, 49)] // Keep last 50
      }));
    };

    const handleOrderUpdate = (data: OrderUpdate) => {
      setState(prev => ({
        ...prev,
        orderUpdates: [data, ...prev.orderUpdates.slice(0, 99)] // Keep last 100
      }));
    };

    const handleConfigUpdated = (config: NotificationConfig) => {
      setState(prev => ({
        ...prev,
        config
      }));
    };

    // Register event listeners
    service.on('initialized', handleInitialized);
    service.on('error', handleError);
    service.on('websocket-connected', handleWebSocketConnected);
    service.on('websocket-authenticated', handleWebSocketAuthenticated);  // ✅ Listen to authenticated event
    service.on('websocket-disconnected', handleWebSocketDisconnected);
    service.on('firebase-ready', handleFirebaseReady);
    service.on('firebase-error', handleFirebaseError);
    service.on('online', handleOnline);
    service.on('offline', handleOffline);
    service.on('price-update', handlePriceUpdate);
    service.on('trade-notification', handleTradeNotification);
    service.on('portfolio-update', handlePortfolioUpdate);
    service.on('system-alert', handleSystemAlert);
    service.on('order-update', handleOrderUpdate);
    service.on('config-updated', handleConfigUpdated);

    // Add listeners for stats events - Required for real-time stats functionality
    service.on('chain_stats_update', (data: any) => {
      console.log('📊 [useWebSocketFirebase] Chain stats update received:', data);
      // Just log - do NOT re-emit to prevent infinite recursion
    });

    service.on('bridge_stats_update', (data: any) => {
      console.log('🌉 [useWebSocketFirebase] Bridge stats update received:', data);
      // Just log - do NOT re-emit to prevent infinite recursion
    });

    service.on('stats_overview_update', (data: any) => {
      console.log('📈 [useWebSocketFirebase] Stats overview update received:', data);
      // Just log - do NOT re-emit to prevent infinite recursion
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupService(hookInstanceId.current);
    };
  }, [cleanupService]);

  // Memoized methods
  const subscribeToPrice = useCallback((symbol: string) => {
    serviceRef.current?.subscribeToPrice(symbol);
  }, []);

  const subscribeToTrades = useCallback((symbol: string) => {
    serviceRef.current?.subscribeToTrades(symbol);
  }, []);

  const subscribeToPortfolio = useCallback(() => {
    serviceRef.current?.subscribeToPortfolio();
  }, []);

  const subscribeToUserNotifications = useCallback(() => {
    serviceRef.current?.subscribeToUserNotifications();
  }, []);

  const subscribeToOrderUpdates = useCallback(() => {
    serviceRef.current?.subscribeToOrders();
  }, []);

  const subscribeToRoom = useCallback((room: string) => {
    serviceRef.current?.subscribeToRoom(room);
  }, []);

  const unsubscribeFromRoom = useCallback((room: string) => {
    serviceRef.current?.unsubscribeFromRoom(room);
  }, []);

  const onMessage = useCallback((messageType: string, handler: (data: any) => void) => {
    const service = serviceRef.current;
    if (!service) return () => {};
    
    service.on(messageType, handler);
    return () => service.off(messageType, handler);
  }, []);

  const unsubscribeFromPrice = useCallback((symbol: string) => {
    serviceRef.current?.unsubscribeFromPrice(symbol);
  }, []);

  const updateConfig = useCallback((config: Partial<NotificationConfig>) => {
    serviceRef.current?.updateConfig(config);
  }, []);

  const sendTestNotification = useCallback(async () => {
    await serviceRef.current?.sendTestNotification();
  }, []);

  // Helper methods for clearing data
  const clearTradeNotifications = useCallback(() => {
    setState(prev => ({ ...prev, tradeNotifications: [] }));
  }, []);

  const clearSystemAlerts = useCallback(() => {
    setState(prev => ({ ...prev, systemAlerts: [] }));
  }, []);

  const clearOrderUpdates = useCallback(() => {
    setState(prev => ({ ...prev, orderUpdates: [] }));
  }, []);

  // Helper methods for getting data
  const getPriceForSymbol = useCallback((symbol: string) => {
    return state.priceUpdates.get(symbol) || null;
  }, [state.priceUpdates]);

  const getLatestTradeNotifications = useCallback((count = 10) => {
    return state.tradeNotifications.slice(0, count);
  }, [state.tradeNotifications]);

  const getLatestSystemAlerts = useCallback((count = 10) => {
    return state.systemAlerts.slice(0, count);
  }, [state.systemAlerts]);

  const getLatestOrderUpdates = useCallback((count = 10) => {
    return state.orderUpdates.slice(0, count);
  }, [state.orderUpdates]);

  // Show notification method (placeholder for future implementation)
  const showNotification = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    console.log(`🔔 Notification (${type}):`, message);
    // TODO: Implement actual toast notification
  }, []);

  return {
    // Connection state
    connectionStatus: state.connectionStatus,
    isInitialized: state.isInitialized,
    error: state.error,

    // ✅ FIX: Add computed connection status properties
    isWebSocketConnected: state.connectionStatus.websocket === 'connected',
    isFirebaseReady: state.connectionStatus.firebase === 'ready',
    isOnline: state.connectionStatus.online,

    // Configuration
    config: state.config,
    updateConfig,

    // Data streams
    priceUpdates: state.priceUpdates,
    tradeNotifications: state.tradeNotifications,
    portfolioUpdate: state.portfolioUpdate,
    systemAlerts: state.systemAlerts,
    orderUpdates: state.orderUpdates,

    // Subscription methods
    subscribeToPrice,
    subscribeToTrades,
    subscribeToPortfolio,
    subscribeToUserNotifications,
    subscribeToOrderUpdates,
    subscribeToRoom,
    unsubscribeFromRoom,
    onMessage,
    unsubscribeFromPrice,

    // Utility methods
    sendTestNotification,

    // ✅ FIX: Add missing helper methods
    clearTradeNotifications,
    clearSystemAlerts,
    clearOrderUpdates,
    getPriceForSymbol,
    getLatestTradeNotifications,
    getLatestSystemAlerts,
    getLatestOrderUpdates,
    showNotification,
  };
} 