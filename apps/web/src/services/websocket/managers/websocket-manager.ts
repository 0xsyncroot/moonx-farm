import { EventEmitter } from 'events';
import { JsonRpcMessageHelper } from '@moonx-farm/shared';
import { 
  ConnectionStatus, 
  QueuedMessage, 
  WebSocketConfig,
  JsonRpcMethods
} from '../types';

export class WebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private connectionStatus: ConnectionStatus['websocket'] = 'disconnected';
  private reconnectAttempts = 0;
  private offlineQueue: QueuedMessage[] = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat = 0;

  constructor(config: WebSocketConfig) {
    super();
    this.config = {
      maxReconnectAttempts: 5,
      reconnectInterval: 1000,
      heartbeatInterval: 30000,
      ...config
    };
  }

  // Initialize WebSocket connection
  public async connect(): Promise<void> {
    try {
      console.log('🔌 Connecting to WebSocket...', { url: this.config.websocketUrl });
      
      this.connectionStatus = 'connecting';
      this.emit('connecting');
      
      // Create WebSocket connection
      const wsUrl = this.config.websocketUrl.replace(/^http/, 'ws');
      
      // Add WebSocket endpoint if not present
      const urlWithPath = new URL(wsUrl);
      if (!urlWithPath.pathname.endsWith('/ws')) {
        urlWithPath.pathname = urlWithPath.pathname.replace(/\/$/, '') + '/ws';
      }
      
      this.ws = new WebSocket(urlWithPath.toString());
      this.setupEventHandlers();
      
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      this.connectionStatus = 'disconnected';
      this.emit('error', error);
      throw error;
    }
  }

  // Setup WebSocket event handlers
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('✅ WebSocket connected, waiting for authentication');
      this.connectionStatus = 'connecting'; // Still connecting until authenticated
      this.emit('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.emit('message', message);
      } catch (error) {
        console.error('❌ Failed to parse WebSocket message:', error);
        this.emit('error', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('🔌 WebSocket disconnected:', { code: event.code, reason: event.reason });
      this.connectionStatus = 'disconnected';
      this.stopHeartbeat();
      this.emit('disconnected', { code: event.code, reason: event.reason });
      
      // Handle reconnection if it wasn't a normal closure
      if (event.code !== 1000 && event.code !== 1001) {
        this.handleReconnection();
      }
    };

    this.ws.onerror = (event) => {
      console.error('❌ WebSocket error:', event);
      this.connectionStatus = 'disconnected';
      this.emit('error', event);
    };
  }

  // Handle reconnection with exponential backoff
  private handleReconnection(): void {
    const maxAttempts = this.config.maxReconnectAttempts || 5;
    const baseInterval = this.config.reconnectInterval || 1000;
    
    if (this.reconnectAttempts < maxAttempts) {
      this.reconnectAttempts++;
      const delay = baseInterval * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${maxAttempts})`);
      
      setTimeout(() => {
        this.connect().catch(error => {
          console.error('❌ Reconnection failed:', error);
        });
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached');
      this.emit('max-reconnects-reached');
    }
  }

  // Send message to WebSocket
  public send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      console.log('📤 WebSocket message sent:', message.method || 'unknown');
    } else {
      console.warn('⚠️ WebSocket not connected, queuing message');
      this.offlineQueue.push({ type: message.method || 'unknown', data: message });
    }
  }

  // Process offline queue when connection is restored
  public processOfflineQueue(): void {
    if (this.offlineQueue.length > 0) {
      console.log(`🔄 Processing ${this.offlineQueue.length} queued messages`);
      
      this.offlineQueue.forEach(({ data }) => {
        this.send(data);
      });
      
      this.offlineQueue = [];
    }
  }

  // Start heartbeat ping
  public startHeartbeat(): void {
    this.stopHeartbeat();
    
    const interval = this.config.heartbeatInterval || 30000;
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendHeartbeat();
      }
    }, interval);
  }

  // Send heartbeat ping using JSON-RPC format
  private sendHeartbeat(): void {
    const heartbeatMessage = JsonRpcMessageHelper.createRequest(
      JsonRpcMethods.HEARTBEAT,
      {},
      this.generateMessageId()
    );
    
    this.send(heartbeatMessage);
    console.log('💓 Heartbeat sent');
  }

  // Manually send heartbeat ping (public method)
  public ping(): void {
    if (this.isReady()) {
      this.sendHeartbeat();
    } else {
      console.warn('⚠️ Cannot send ping: WebSocket not ready');
    }
  }

  // Generate unique message ID
  private generateMessageId(): string {
    return `heartbeat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Stop heartbeat ping
  public stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Update last heartbeat time
  public updateLastHeartbeat(): void {
    this.lastHeartbeat = Date.now();
  }

  // Mark connection as fully authenticated
  public markAsAuthenticated(): void {
    this.connectionStatus = 'connected';
    this.reconnectAttempts = 0;
    this.emit('authenticated');
  }

  // Get connection status
  public getConnectionStatus(): ConnectionStatus['websocket'] {
    return this.connectionStatus;
  }

  // Check if connected
  public isConnected(): boolean {
    return this.connectionStatus === 'connected';
  }

  // Check if ready to send messages
  public isReady(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // Get offline queue length
  public getOfflineQueueLength(): number {
    return this.offlineQueue.length;
  }

  // Disconnect WebSocket
  public disconnect(): void {
    console.log('🔌 Disconnecting WebSocket...');
    
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.connectionStatus = 'disconnected';
    this.offlineQueue = [];
    this.removeAllListeners();
  }

  // Update JWT token
  public updateToken(newToken: string): void {
    this.config.jwtToken = newToken;
    console.log('🔐 JWT token updated');
  }

  // Get current JWT token
  public getToken(): string {
    return this.config.jwtToken;
  }
} 