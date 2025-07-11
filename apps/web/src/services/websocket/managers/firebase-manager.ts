import { EventEmitter } from 'events';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, MessagePayload } from 'firebase/messaging';
import { FirebaseConfig, ConnectionStatus } from '../types';

export class FirebaseManager extends EventEmitter {
  private messaging: any = null;
  private fcmToken: string | null = null;
  private config: FirebaseConfig;
  private connectionStatus: ConnectionStatus['firebase'] = 'requesting-permission';
  private jwtToken: string;

  constructor(config: FirebaseConfig, jwtToken: string) {
    super();
    this.config = config;
    this.jwtToken = jwtToken;
  }

  // Initialize Firebase messaging
  public async initialize(): Promise<void> {
    try {
      const SKIP_FIREBASE = process.env.NEXT_PUBLIC_SKIP_FIREBASE === 'true';
      
      if (SKIP_FIREBASE) {
        console.log('⏸️ Firebase disabled by configuration');
        this.connectionStatus = 'error';
        this.emit('error', 'Firebase disabled by configuration');
        return;
      }
      
      // Check if Firebase config is properly set
      if (!this.config?.apiKey || !this.config?.projectId) {
        console.warn('⚠️ Firebase config incomplete');
        this.connectionStatus = 'error';
        this.emit('error', 'Firebase config incomplete');
        return;
      }
      
      // Initialize Firebase app
      const app = initializeApp(this.config);
      this.messaging = getMessaging(app);
      
      // Request permission for notifications
      const permission = await this.requestPermission();
      
      if (permission === 'granted') {
        await this.setupMessaging();
        this.connectionStatus = 'ready';
        this.emit('ready', this.fcmToken);
      } else {
        console.warn('⚠️ Notification permission denied');
        this.connectionStatus = 'error';
        this.emit('error', 'Notification permission denied');
      }
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error);
      this.connectionStatus = 'error';
      this.emit('error', error);
    }
  }

  // Request notification permission
  private async requestPermission(): Promise<NotificationPermission> {
    try {
      const permission = await Notification.requestPermission();
      console.log('🔔 Notification permission:', permission);
      return permission;
    } catch (error) {
      console.error('❌ Failed to request notification permission:', error);
      return 'denied';
    }
  }

  // Setup Firebase messaging
  private async setupMessaging(): Promise<void> {
    try {
      // Get FCM token
      this.fcmToken = await getToken(this.messaging, {
        vapidKey: process.env['NEXT_PUBLIC_FIREBASE_VAPID_KEY']
      });
      
      if (this.fcmToken) {
        console.log('✅ Firebase FCM token obtained');
        
        // Listen for foreground messages
        onMessage(this.messaging, (payload: MessagePayload) => {
          this.handleForegroundMessage(payload);
        });
        
        // Register FCM token with backend
        await this.registerToken();
      } else {
        throw new Error('Failed to get FCM token');
      }
    } catch (error) {
      console.error('❌ Firebase messaging setup failed:', error);
      throw error;
    }
  }

  // Handle foreground message (push notification)
  private handleForegroundMessage(payload: MessagePayload): void {
    console.log('🔔 Firebase foreground message received:', payload);
    
    // Emit the message for the main service to handle
    this.emit('message', payload);
    
    // Show local notification if notification data is available
    if (payload.notification) {
      this.showLocalNotification(
        payload.notification.title || 'Notification',
        payload.notification.body || 'New notification received'
      );
    }
  }

  // Register FCM token with backend
  private async registerToken(): Promise<void> {
    if (!this.fcmToken) return;

    try {
      console.log('📝 Registering FCM token with backend...');
      
      const response = await fetch('/api/v1/notifications/register-fcm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.jwtToken}`
        },
        body: JSON.stringify({
          fcmToken: this.fcmToken,
          deviceType: 'web'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log('✅ FCM token registered successfully');
      this.emit('token-registered', this.fcmToken);
      
    } catch (error) {
      console.warn('⚠️ FCM token registration failed (optional):', error);
      // Registration is optional - don't throw error
      this.emit('token-registration-failed', error);
    }
  }

  // Show local browser notification
  private showLocalNotification(title: string, body: string): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }

  // Send test notification
  public async sendTestNotification(): Promise<void> {
    if (this.connectionStatus !== 'ready') {
      console.warn('⚠️ Firebase not ready for test notification');
      return;
    }

    try {
      console.log('🧪 Sending test notification...');
      
      const response = await fetch('/api/v1/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.jwtToken}`
        },
        body: JSON.stringify({
          message: 'Test notification from Firebase Manager'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log('✅ Test notification sent');
      this.emit('test-notification-sent');
      
    } catch (error) {
      console.warn('⚠️ Test notification failed:', error);
      this.emit('test-notification-failed', error);
    }
  }

  // Update JWT token
  public updateJwtToken(newToken: string): void {
    this.jwtToken = newToken;
    console.log('🔐 Firebase JWT token updated');
  }

  // Get FCM token
  public getFcmToken(): string | null {
    return this.fcmToken;
  }

  // Get connection status
  public getConnectionStatus(): ConnectionStatus['firebase'] {
    return this.connectionStatus;
  }

  // Check if Firebase is ready
  public isReady(): boolean {
    return this.connectionStatus === 'ready';
  }

  // Check if Firebase is available
  public isAvailable(): boolean {
    return this.connectionStatus !== 'error';
  }

  // Refresh FCM token
  public async refreshToken(): Promise<void> {
    if (!this.messaging) {
      console.warn('⚠️ Firebase messaging not initialized');
      return;
    }

    try {
      const newToken = await getToken(this.messaging, {
        vapidKey: process.env['NEXT_PUBLIC_FIREBASE_VAPID_KEY']
      });
      
      if (newToken && newToken !== this.fcmToken) {
        this.fcmToken = newToken;
        console.log('✅ FCM token refreshed');
        await this.registerToken();
        this.emit('token-refreshed', this.fcmToken);
      }
    } catch (error) {
      console.error('❌ Failed to refresh FCM token:', error);
      this.emit('token-refresh-failed', error);
    }
  }

  // Clean up Firebase resources
  public cleanup(): void {
    console.log('🧹 Cleaning up Firebase resources...');
    
    this.messaging = null;
    this.fcmToken = null;
    this.connectionStatus = 'requesting-permission';
    this.removeAllListeners();
  }
} 