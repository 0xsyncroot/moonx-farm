// Main service
export { WebSocketService } from './websocket-service';

// Types
export * from './types';

// Managers
export { WebSocketManager } from './managers/websocket-manager';
export { FirebaseManager } from './managers/firebase-manager';
export { SubscriptionManager } from './managers/subscription-manager';
export { AuthManager } from './managers/auth-manager';

// Handlers
export { MessageHandler } from './handlers/message-handler';

// Legacy export for backward compatibility
export { WebSocketService as WebSocketFirebaseService } from './websocket-service'; 