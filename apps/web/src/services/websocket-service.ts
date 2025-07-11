// Re-export from refactored modules
export { 
  WebSocketService as WebSocketFirebaseService,
  WebSocketService,
  // Managers
  WebSocketManager,
  FirebaseManager,
  SubscriptionManager,
  AuthManager,
  // Handlers
  MessageHandler
} from './websocket';

// Re-export types
export type { 
  PriceUpdate,
  TradeNotification, 
  PortfolioUpdate,
  SystemAlert,
  ChainPerformanceStats,
  BridgeLatencyStats,
  StatsOverview,
  OrderUpdate,
  NotificationConfig,
  ConnectionStatus,
  StatsSubscriptionOptions
} from './websocket';

// Re-export constants
export { JsonRpcMethods } from './websocket';

// Import for default export
import { WebSocketService } from './websocket';

// Legacy default export for backward compatibility
export default WebSocketService; 