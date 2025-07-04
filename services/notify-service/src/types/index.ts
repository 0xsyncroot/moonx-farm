import { Socket } from 'socket.io';
import { RedisClientType } from 'redis';

// Notification Types
export interface NotificationMessage {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  userId: string;
  data?: Record<string, any>;
  timestamp: Date;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  metadata?: NotificationMetadata;
}

export enum NotificationType {
  // Trading notifications
  SWAP_COMPLETED = 'swap_completed',
  SWAP_FAILED = 'swap_failed',
  ORDER_FILLED = 'order_filled',
  ORDER_EXPIRED = 'order_expired',
  ORDER_CANCELLED = 'order_cancelled',
  
  // Price alerts
  PRICE_ALERT = 'price_alert',
  PRICE_TARGET_HIT = 'price_target_hit',
  PRICE_DROP_ALERT = 'price_drop_alert',
  
  // Portfolio updates
  PORTFOLIO_SYNC = 'portfolio_sync',
  PNL_UPDATE = 'pnl_update',
  BALANCE_UPDATE = 'balance_update',
  
  // Chart data
  CHART_UPDATE = 'chart_update',
  LIQUIDITY_UPDATE = 'liquidity_update',
  VOLUME_UPDATE = 'volume_update',
  
  // System notifications
  SYSTEM_MAINTENANCE = 'system_maintenance',
  FEATURE_ANNOUNCEMENT = 'feature_announcement',
  SECURITY_ALERT = 'security_alert'
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum NotificationChannel {
  WEBSOCKET = 'websocket',
  EMAIL = 'email',
  PUSH = 'push',
  SMS = 'sms'
}

export interface NotificationMetadata {
  source: string;
  version: string;
  retryCount?: number;
  scheduledFor?: Date;
  expiresAt?: Date;
}

// Socket Events
export interface SocketEvents {
  // Client to Server
  join_room: (data: { room: string }) => void;
  leave_room: (data: { room: string }) => void;
  subscribe_notifications: (data: { types: NotificationType[] }) => void;
  unsubscribe_notifications: (data: { types: NotificationType[] }) => void;
  get_offline_messages: () => void;
  
  // Server to Client
  notification: (data: NotificationMessage) => void;
  chart_update: (data: ChartUpdateData) => void;
  price_update: (data: PriceUpdateData) => void;
  portfolio_update: (data: PortfolioUpdateData) => void;
  system_message: (data: SystemMessage) => void;
  error: (data: ErrorMessage) => void;
}

export interface ChartUpdateData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  change24h: number;
  high24h: number;
  low24h: number;
}

export interface PriceUpdateData {
  symbol: string;
  price: number;
  timestamp: number;
  source: string;
}

export interface PortfolioUpdateData {
  userId: string;
  totalValue: number;
  pnl: number;
  pnlPercentage: number;
  timestamp: number;
}

export interface SystemMessage {
  type: 'info' | 'warning' | 'error';
  message: string;
  timestamp: number;
}

export interface ErrorMessage {
  code: string;
  message: string;
  timestamp: number;
}

// User Connection Management
export interface UserConnection {
  socketId: string;
  userId: string;
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: NotificationType[];
  rooms: string[];
}

export interface UserPreferences {
  userId: string;
  enabledNotifications: NotificationType[];
  channels: NotificationChannel[];
  quietHours?: {
    start: string;
    end: string;
    timezone: string;
  };
  emailFrequency: 'immediate' | 'hourly' | 'daily';
  pushEnabled: boolean;
  emailEnabled: boolean;
}

// Service Interfaces
export interface ISocketManager {
  joinRoom(socket: Socket, room: string): Promise<void>;
  leaveRoom(socket: Socket, room: string): Promise<void>;
  subscribeToNotifications(socket: Socket, types: NotificationType[]): Promise<void>;
  unsubscribeFromNotifications(socket: Socket, types: NotificationType[]): Promise<void>;
  sendToUser(userId: string, message: NotificationMessage): Promise<void>;
  sendToRoom(room: string, message: NotificationMessage): Promise<void>;
  broadcast(message: NotificationMessage): Promise<void>;
  handleDisconnect(socket: Socket): Promise<void>;
  getConnectionCount(): number;
  getUserConnections(userId: string): UserConnection[];
}

export interface INotificationService {
  sendNotification(message: NotificationMessage): Promise<void>;
  sendToUser(userId: string, message: NotificationMessage): Promise<void>;
  sendBatch(messages: NotificationMessage[]): Promise<void>;
  scheduleNotification(message: NotificationMessage, scheduleTime: Date): Promise<void>;
  cancelScheduledNotification(notificationId: string): Promise<void>;
  getOfflineMessages(userId: string): Promise<NotificationMessage[]>;
  markAsRead(userId: string, notificationId: string): Promise<void>;
}

export interface IRedisManager {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<void>;
  hdel(key: string, field: string): Promise<void>;
  sadd(key: string, members: string[]): Promise<void>;
  srem(key: string, members: string[]): Promise<void>;
  smembers(key: string): Promise<string[]>;
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, callback: (message: string) => void): Promise<void>;
}

export interface IEmailService {
  sendEmail(to: string, subject: string, body: string): Promise<void>;
  sendNotificationEmail(notification: NotificationMessage): Promise<void>;
  sendBatchEmails(emails: EmailMessage[]): Promise<void>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface IPushService {
  sendPushNotification(deviceToken: string, notification: NotificationMessage): Promise<void>;
  sendBatchPushNotifications(notifications: PushNotificationBatch[]): Promise<void>;
  registerDevice(userId: string, deviceToken: string, platform: 'ios' | 'android'): Promise<void>;
  unregisterDevice(userId: string, deviceToken: string): Promise<void>;
}

export interface PushNotificationBatch {
  deviceToken: string;
  notification: NotificationMessage;
}

// Kafka Message Types
export interface KafkaMessage {
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
  value: string;
  headers?: Record<string, string>;
}

export interface ProcessedKafkaMessage {
  type: NotificationType;
  userId: string;
  data: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface NotificationStats {
  totalSent: number;
  totalFailed: number;
  byType: Record<NotificationType, number>;
  byChannel: Record<NotificationChannel, number>;
  averageLatency: number;
  activeConnections: number;
}

// Configuration Types
export interface NotifyServiceConfig {
  port: number;
  host: string;
  redis: {
    url: string;
    password?: string;
    db: number;
  };
  kafka: {
    brokers: string[];
    groupId: string;
    clientId: string;
  };
  socket: {
    pingTimeout: number;
    pingInterval: number;
    maxBufferSize: number;
  };
  email: {
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    from: string;
  };
  push: {
    firebase: {
      projectId: string;
      privateKey: string;
      clientEmail: string;
    };
  };
  rateLimit: {
    maxConnections: number;
    windowMs: number;
    maxRequests: number;
  };
}

export default {
  NotificationMessage,
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  SocketEvents,
  UserConnection,
  UserPreferences
}; 