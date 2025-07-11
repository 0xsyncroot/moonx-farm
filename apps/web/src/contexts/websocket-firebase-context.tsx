import React, { createContext, useContext, ReactNode } from 'react';
import { useWebSocketFirebase } from '@/hooks/use-websocket-firebase';
import { 
  PriceUpdate, 
  TradeNotification, 
  PortfolioUpdate, 
  SystemAlert, 
  ConnectionStatus, 
  NotificationConfig, 
  OrderUpdate
} from '@/services/websocket';

interface WebSocketFirebaseContextType {
  // State
  connectionStatus: ConnectionStatus;
  config: NotificationConfig;
  priceUpdates: Map<string, PriceUpdate>;
  tradeNotifications: TradeNotification[];
  portfolioUpdate: PortfolioUpdate | null;
  systemAlerts: SystemAlert[];
  orderUpdates?: OrderUpdate[];
  isInitialized: boolean;
  error: string | null;
  
  // Connection status helpers
  isWebSocketConnected: boolean;
  isFirebaseReady: boolean;
  isOnline: boolean;
  
  // JSON-RPC 2.0 Methods
  subscribeToPrice: (symbol: string) => void;
  subscribeToTrades: (symbol: string) => void;
  subscribeToPortfolio: () => void;
  subscribeToUserNotifications: () => void;
  subscribeToOrderUpdates?: () => void;
  
  // Room subscription methods for stats
  subscribeToRoom: (room: string) => void;
  unsubscribeFromRoom: (room: string) => void;
  
  // Message handling
  onMessage: (messageType: string, handler: (data: any) => void) => () => void;
  
  unsubscribeFromPrice?: (symbol: string) => void;
  updateConfig: (config: Partial<NotificationConfig>) => void;
  sendTestNotification: () => Promise<void>;
  showNotification?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  clearTradeNotifications: () => void;
  clearSystemAlerts: () => void;
  clearOrderUpdates?: () => void;
  getPriceForSymbol: (symbol: string) => PriceUpdate | null;
  getLatestTradeNotifications: (count?: number) => TradeNotification[];
  getLatestSystemAlerts: (count?: number) => SystemAlert[];
  getLatestOrderUpdates?: (count?: number) => OrderUpdate[];
}

const WebSocketFirebaseContext = createContext<WebSocketFirebaseContextType | undefined>(undefined);

interface WebSocketFirebaseProviderProps {
  children: ReactNode;
  websocketUrl: string;
  firebaseConfig: any;
  jwtToken: string;
  userId?: string | null;
  enabled?: boolean;
}

export function WebSocketFirebaseProvider({
  children,
  websocketUrl,
  firebaseConfig,
  jwtToken,
  userId,
  enabled = true
}: WebSocketFirebaseProviderProps) {
  const websocketFirebase = useWebSocketFirebase({
    websocketUrl,
    firebaseConfig,
    jwtToken,
    userId,
    enabled
  });

  return (
    <WebSocketFirebaseContext.Provider value={websocketFirebase}>
      {children}
    </WebSocketFirebaseContext.Provider>
  );
}

export function useWebSocketFirebaseContext() {
  const context = useContext(WebSocketFirebaseContext);
  if (context === undefined) {
    // Return a safe default context instead of throwing
    console.warn('useWebSocketFirebaseContext used outside of WebSocketFirebaseProvider. Returning default values.');
    return {
      connectionStatus: {
        websocket: 'disconnected' as const,
        firebase: 'requesting-permission' as const,
        online: true
      },
      config: {
        enablePriceAlerts: true,
        enableTradeNotifications: true,
        enablePortfolioUpdates: true,
        enableSystemAlerts: true,
        offlineNotifications: true
      },
      priceUpdates: new Map(),
      tradeNotifications: [],
      portfolioUpdate: null,
      systemAlerts: [],
      orderUpdates: [],
      isInitialized: false,
      error: null,
      isWebSocketConnected: false,
      isFirebaseReady: false,
      isOnline: true,
      subscribeToPrice: () => {},
      subscribeToTrades: () => {},
      subscribeToPortfolio: () => {},
      subscribeToUserNotifications: () => {},
      subscribeToOrderUpdates: () => {},
      subscribeToRoom: () => {},
      unsubscribeFromRoom: () => {},
      onMessage: () => () => {},
      unsubscribeFromPrice: () => {},
      updateConfig: () => {},
      sendTestNotification: async () => {},
      showNotification: () => {},
      clearTradeNotifications: () => {},
      clearSystemAlerts: () => {},
      clearOrderUpdates: () => {},
      getPriceForSymbol: () => null,
      getLatestTradeNotifications: () => [],
      getLatestSystemAlerts: () => [],
      getLatestOrderUpdates: () => []
    };
  }
  return context;
}

// Hook để sử dụng trong trading components
export function useTradingData() {
  const context = useWebSocketFirebaseContext();
  
  return {
    priceUpdates: context.priceUpdates,
    orderUpdates: context.orderUpdates || [],
    connectionStatus: context.connectionStatus,
    subscribeToOrderUpdates: context.subscribeToOrderUpdates || (() => {}),
    subscribeToPrice: context.subscribeToPrice,
    unsubscribeFromPrice: context.unsubscribeFromPrice || (() => {}),
    showNotification: context.showNotification || (() => {}),
    getPriceForSymbol: context.getPriceForSymbol
  };
}

// Hook để sử dụng trong notification components
export function useNotifications() {
  const { 
    tradeNotifications, 
    systemAlerts, 
    clearTradeNotifications, 
    clearSystemAlerts,
    getLatestTradeNotifications,
    getLatestSystemAlerts
  } = useWebSocketFirebaseContext();
  
  return {
    tradeNotifications,
    systemAlerts,
    clearTradeNotifications,
    clearSystemAlerts,
    getLatestTradeNotifications,
    getLatestSystemAlerts
  };
}

// Hook để sử dụng trong portfolio components
export function usePortfolioData() {
  const { portfolioUpdate, subscribeToPortfolio } = useWebSocketFirebaseContext();
  
  return {
    portfolioUpdate,
    subscribeToPortfolio
  };
}

// Hook để kiểm tra connection status
export function useConnectionStatus() {
  const { 
    connectionStatus, 
    isWebSocketConnected, 
    isFirebaseReady, 
    isOnline, 
    error 
  } = useWebSocketFirebaseContext();
  
  return {
    connectionStatus,
    isWebSocketConnected,
    isFirebaseReady,
    isOnline,
    error
  };
}

// Hook để sử dụng cho stats components
export function useStatsSubscription() {
  const { 
    subscribeToRoom, 
    unsubscribeFromRoom, 
    onMessage, 
    isWebSocketConnected 
  } = useWebSocketFirebaseContext();
  
  return {
    subscribeToRoom,
    unsubscribeFromRoom,
    onMessage,
    isWebSocketConnected
  };
}

