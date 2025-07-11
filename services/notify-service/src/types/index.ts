import { z } from '@moonx-farm/common';

// ==================== Enums ====================
export enum NotificationChannel {
  WEBSOCKET = 'websocket',
  FCM = 'fcm',
  EMAIL = 'email',
  TELEGRAM = 'telegram'
}

export enum NotificationType {
  TRADING = 'trading',
  PRICE_ALERT = 'price_alert',
  PORTFOLIO = 'portfolio',
  SECURITY = 'security',
  SYSTEM = 'system'
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum DeliveryStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

export enum QueueStatus {
  SCHEDULED = 'scheduled',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed'
}

// ==================== Database Models ====================
export interface UserNotificationPreferences {
  id: number;
  userId: string;
  websocketEnabled: boolean;
  fcmEnabled: boolean;
  emailEnabled: boolean;
  telegramEnabled: boolean;
  emailAddress?: string;
  telegramChatId?: string;
  telegramUsername?: string;
  fcmToken?: string;
  preferences: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationTemplate {
  id: number;
  templateKey: string;
  templateName: string;
  channel: NotificationChannel;
  subjectTemplate?: string;
  contentTemplate: string;
  htmlTemplate?: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: number;
  userId: string;
  notificationType: NotificationType;
  templateKey?: string;
  title: string;
  content: string;
  data: Record<string, any>;
  priority: NotificationPriority;
  isRead: boolean;
  readAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationDelivery {
  id: number;
  notificationId: number;
  channel: NotificationChannel;
  status: DeliveryStatus;
  recipient?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  responseData?: Record<string, any>;
  retryCount: number;
  nextRetryAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationQueue {
  id: number;
  notificationId: number;
  channel: NotificationChannel;
  priority: number;
  scheduledAt: Date;
  processingAt?: Date;
  processedAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  retryCount: number;
  createdAt: Date;
}

export interface NotificationMetrics {
  id: number;
  date: Date;
  channel: NotificationChannel;
  notificationType: NotificationType;
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  avgDeliveryTimeMs: number;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== API Request/Response Types ====================
export interface CreateNotificationRequest {
  userId: string;
  notificationType: NotificationType;
  templateKey?: string;
  title: string;
  content: string;
  data?: Record<string, any>;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  expiresAt?: Date;
  scheduledAt?: Date;
}

export interface UpdatePreferencesRequest {
  websocketEnabled?: boolean;
  fcmEnabled?: boolean;
  emailEnabled?: boolean;
  telegramEnabled?: boolean;
  emailAddress?: string;
  fcmToken?: string;
  preferences?: Record<string, any>;
}

export interface LinkTelegramRequest {
  telegramChatId: string;
  telegramUsername?: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface MetricsResponse {
  metrics: {
    totalNotifications: number;
    deliveryRates: Record<NotificationChannel, number>;
    channelStats: Record<NotificationChannel, {
      sent: number;
      delivered: number;
      failed: number;
      deliveryRate: number;
    }>;
    typeStats: Record<NotificationType, {
      sent: number;
      delivered: number;
      failed: number;
    }>;
  };
}

// ==================== Zod Schemas ====================
export const CreateNotificationSchema = z.object({
  userId: z.string().min(1),
  notificationType: z.nativeEnum(NotificationType),
  templateKey: z.string().optional(),
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  data: z.record(z.any()).optional(),
  priority: z.nativeEnum(NotificationPriority).optional(),
  channels: z.array(z.nativeEnum(NotificationChannel)).optional(),
  expiresAt: z.coerce.date().optional(),
  scheduledAt: z.coerce.date().optional(),
});

export const UpdatePreferencesSchema = z.object({
  websocketEnabled: z.boolean().optional(),
  fcmEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  telegramEnabled: z.boolean().optional(),
  emailAddress: z.string().email().optional(),
  fcmToken: z.string().optional(),
  preferences: z.record(z.any()).optional(),
});

export const LinkTelegramSchema = z.object({
  telegramChatId: z.string().min(1),
  telegramUsername: z.string().optional(),
});

export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

export const NotificationQuerySchema = z.object({
  type: z.nativeEnum(NotificationType).optional(),
  isRead: z.coerce.boolean().optional(),
  priority: z.nativeEnum(NotificationPriority).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
}).merge(PaginationSchema);

// ==================== Event Types ====================
export interface NotificationEvent {
  id: string;
  timestamp: Date;
  version: string;
  source: string;
  type: string;
  data: {
    userId: string;
    notificationId?: number;
    notification?: Notification;
  };
}

export interface OrderEvent {
  id: string;
  timestamp: Date;
  version: string;
  source: string;
  type: 'order.created' | 'order.filled' | 'order.cancelled' | 'order.expired';
  data: {
    userId: string;
    orderId: string;
    orderType: string;
    tokenSymbol: string;
    amount: string;
    price?: string;
    transactionHash?: string;
    explorerUrl?: string;
  };
}

export interface PriceEvent {
  id: string;
  timestamp: Date;
  version: string;
  source: string;
  type: 'price.alert' | 'price.threshold_crossed';
  data: {
    userId: string;
    tokenSymbol: string;
    currentPrice: string;
    previousPrice: string;
    changePercent: string;
    direction: 'up' | 'down';
    threshold?: string;
  };
}

export interface PortfolioEvent {
  id: string;
  timestamp: Date;
  version: string;
  source: string;
  type: 'portfolio.updated' | 'portfolio.pnl_changed';
  data: {
    userId: string;
    currentValue: string;
    previousValue: string;
    changePercent: string;
    direction: 'up' | 'down';
    pnl?: string;
  };
}

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  version: string;
  source: string;
  type: 'security.login' | 'security.wallet_connected' | 'security.suspicious_activity';
  data: {
    userId: string;
    action: string;
    ipAddress?: string;
    userAgent?: string;
    location?: string;
  };
}

// ==================== Configuration Types ====================
export interface ChannelConfig {
  websocket: {
    enabled: boolean;
    endpoint: string;
    fallbackToQueue: boolean;
  };
  fcm: {
    enabled: boolean;
    serverKey: string;
    fallbackToQueue: boolean;
  };
  email: {
    enabled: boolean;
    provider: 'sendgrid';
    apiKey: string;
    fromEmail: string;
    fromName: string;
    retryAttempts: number;
  };
  telegram: {
    enabled: boolean;
    botToken: string;
    webhookUrl: string;
    retryAttempts: number;
  };
}

export interface DeliveryResult {
  success: boolean;
  channel: NotificationChannel;
  recipient?: string;
  messageId?: string;
  error?: string;
  deliveryTime?: number;
}

export interface BatchDeliveryResult {
  results: DeliveryResult[];
  successCount: number;
  failureCount: number;
  totalDeliveryTime: number;
}

export interface TemplateVariables {
  // Common variables
  userId: string;
  timestamp: string;
  appUrl: string;
  
  // Trading variables
  orderType?: string;
  amount?: string;
  tokenSymbol?: string;
  price?: string;
  transactionHash?: string;
  explorerUrl?: string;
  
  // Price alert variables
  currentPrice?: string;
  previousPrice?: string;
  changePercent?: string;
  direction?: 'up' | 'down';
  
  // Portfolio variables
  currentValue?: string;
  previousValue?: string;
  pnl?: string;
  
  // Security variables
  action?: string;
  ipAddress?: string;
  location?: string;
  
  // System variables
  maintenanceStart?: string;
  maintenanceEnd?: string;
  version?: string;
}

// ==================== Service Interfaces ====================
export interface INotificationService {
  createNotification(request: CreateNotificationRequest): Promise<Notification>;
  sendNotification(notificationId: number, channels?: NotificationChannel[]): Promise<BatchDeliveryResult>;
  getUserNotifications(userId: string, query: any): Promise<NotificationListResponse>;
  markAsRead(notificationId: number, userId: string): Promise<void>;
  deleteNotification(notificationId: number, userId: string): Promise<void>;
  getHealthStatus(): Promise<{
    healthy: boolean;
    services: Record<string, boolean>;
    timestamp: Date;
  }>;
}

export interface IChannelProvider {
  send(notification: Notification, recipient: string, template: NotificationTemplate): Promise<DeliveryResult>;
  isAvailable(): Promise<boolean>;
  getRecipient(preferences: UserNotificationPreferences): string | null;
}

export interface ITemplateService {
  renderTemplate(templateKey: string, channel: NotificationChannel, variables: TemplateVariables): Promise<{
    subject?: string;
    content: string;
    html?: string;
  }>;
  getTemplate(templateKey: string, channel: NotificationChannel): Promise<NotificationTemplate | null>;
}

export interface IPreferencesService {
  getUserPreferences(userId: string): Promise<UserNotificationPreferences>;
  updatePreferences(userId: string, updates: UpdatePreferencesRequest): Promise<UserNotificationPreferences>;
  linkTelegram(userId: string, telegramData: LinkTelegramRequest): Promise<void>;
  unlinkTelegram(userId: string): Promise<void>;
  getChannelStatuses(userId: string): Promise<{
    websocket: { enabled: boolean; configured: boolean };
    fcm: { enabled: boolean; configured: boolean };
    email: { enabled: boolean; configured: boolean };
    telegram: { enabled: boolean; configured: boolean };
  }>;
  enableChannel(userId: string, channel: string): Promise<UserNotificationPreferences>;
  disableChannel(userId: string, channel: string): Promise<UserNotificationPreferences>;
}

// ==================== Module Augmentation ====================
declare module 'fastify' {
  interface FastifyInstance {
    notificationService: INotificationService;
    preferencesService: IPreferencesService;
    templateService: ITemplateService;
  }
}

 