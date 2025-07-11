import { EventEmitter } from 'eventemitter3';
import { createRedis, createRedisConfig } from '@moonx-farm/infrastructure';
import { createLogger } from '@moonx-farm/common';
import { websocketConfig } from '../config';
import { 
  WebSocketClient, 
  WebSocketMessage, 
  ConnectionManager, 
  SubscriptionChannel,
  WebSocketMetrics,
  WebSocketEvents
} from '../types';

const logger = createLogger('connection-manager');

export class WebSocketConnectionManager extends EventEmitter<WebSocketEvents> implements ConnectionManager {
  private readonly redis;
  private readonly connections = new Map<string, WebSocketClient>();
  private readonly userConnections = new Map<string, Set<string>>();
  private readonly subscriptions = new Map<string, Set<string>>();
  private readonly metrics: WebSocketMetrics;
  private readonly keyPrefix = websocketConfig.redis.keyPrefix;
  private readonly startTime = Date.now();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    const config = createRedisConfig();
    this.redis = createRedis(config);

    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      authenticationAttempts: 0,
      authenticationFailures: 0,
      subscriptions: {},
      uptime: 0
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.redis.connect();
      logger.info('Connection manager initialized with Redis');
      
      // Start cleanup interval
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 60000); // Cleanup every minute
      
    } catch (error) {
      logger.error('Failed to initialize connection manager', { error });
      throw error;
    }
  }

  /**
   * Add a new WebSocket connection
   */
  async addConnection(client: WebSocketClient): Promise<void> {
    try {
      // Store connection locally
      this.connections.set(client.id, client);
      
      // Track user connections
      if (!this.userConnections.has(client.userId)) {
        this.userConnections.set(client.userId, new Set());
      }
      this.userConnections.get(client.userId)!.add(client.id);
      
      // Store connection in Redis for cluster support
      const connectionKey = `connections:${client.id}`;
      await Promise.all([
        this.redis.hset(connectionKey, 'userId', client.userId),
        this.redis.hset(connectionKey, 'userAddress', client.userAddress),
        this.redis.hset(connectionKey, 'connectedAt', client.connectedAt.toString()),
        this.redis.hset(connectionKey, 'lastPing', client.lastPing.toString()),
        this.redis.hset(connectionKey, 'metadata', JSON.stringify(client.metadata))
      ]);
      
      // Set expiration for connection data
      await this.redis.expire(`connections:${client.id}`, 3600); // 1 hour
      
      // Add to user's connection set
      await this.redis.sadd(`user:${client.userId}:connections`, client.id);
      await this.redis.expire(`user:${client.userId}:connections`, 3600);
      
      // Update metrics
      this.metrics.totalConnections++;
      this.metrics.activeConnections++;
      
      logger.info('Connection added', {
        clientId: client.id,
        userId: client.userId,
        userAddress: client.userAddress,
        totalConnections: this.metrics.activeConnections
      });
      
      this.emit('client:connected', client);
      
    } catch (error) {
      logger.error('Failed to add connection', { error, clientId: client.id });
      throw error;
    }
  }

  /**
   * Remove a WebSocket connection
   */
  async removeConnection(clientId: string): Promise<void> {
    try {
      const client = this.connections.get(clientId);
      if (!client) {
        logger.warn('Attempted to remove non-existent connection', { clientId });
        return;
      }
      
      // Remove from local storage
      this.connections.delete(clientId);
      
      // Remove from user connections
      const userConns = this.userConnections.get(client.userId);
      if (userConns) {
        userConns.delete(clientId);
        if (userConns.size === 0) {
          this.userConnections.delete(client.userId);
        }
      }
      
      // Remove from subscriptions
      client.subscriptions.forEach(channel => {
        this.removeFromSubscription(clientId, channel as SubscriptionChannel);
      });
      
      // Remove from Redis
      await this.redis.del(`connections:${clientId}`);
      await this.redis.srem(`user:${client.userId}:connections`, clientId);
      
      // Update metrics
      this.metrics.activeConnections--;
      
      logger.info('Connection removed', {
        clientId,
        userId: client.userId,
        totalConnections: this.metrics.activeConnections
      });
      
      this.emit('client:disconnected', clientId);
      
    } catch (error) {
      logger.error('Failed to remove connection', { error, clientId });
    }
  }

  /**
   * Get connection by ID
   */
  getConnection(clientId: string): WebSocketClient | null {
    return this.connections.get(clientId) || null;
  }

  /**
   * Get all connections for a user
   */
  getConnectionsByUserId(userId: string): WebSocketClient[] {
    const connectionIds = this.userConnections.get(userId);
    if (!connectionIds) {
      return [];
    }
    
    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter(client => client !== undefined) as WebSocketClient[];
  }

  /**
   * Alias for getConnectionsByUserId - for compatibility
   */
  getClientsByUserId(userId: string): WebSocketClient[] {
    return this.getConnectionsByUserId(userId);
  }

  /**
   * Get all active connections
   */
  getAllClients(): WebSocketClient[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get total connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Broadcast message to all connections or filtered connections
   */
  async broadcast(
    message: WebSocketMessage, 
    filter?: (client: WebSocketClient) => boolean
  ): Promise<void> {
    try {
      const clients = filter 
        ? Array.from(this.connections.values()).filter(filter)
        : Array.from(this.connections.values());
      
      const promises = clients.map(client => this.sendToClient(client, message));
      await Promise.allSettled(promises);
      
      logger.debug('Broadcast message sent', {
        messageType: message.type,
        clientCount: clients.length
      });
      
    } catch (error) {
      logger.error('Failed to broadcast message', { error, messageType: message.type });
    }
  }

  /**
   * Send message to specific user (all their connections)
   */
  async sendToUser(userId: string, message: WebSocketMessage): Promise<void> {
    try {
      const connections = this.getConnectionsByUserId(userId);
      if (connections.length === 0) {
        logger.warn('No active connections for user', { userId });
        return;
      }
      
      const promises = connections.map(client => this.sendToClient(client, message));
      await Promise.allSettled(promises);
      
      logger.debug('Message sent to user', {
        userId,
        messageType: message.type,
        connectionCount: connections.length
      });
      
    } catch (error) {
      logger.error('Failed to send message to user', { error, userId, messageType: message.type });
    }
  }

  /**
   * Send message to all subscribers of a channel
   */
  async sendToSubscribers(channel: SubscriptionChannel, message: WebSocketMessage): Promise<void> {
    try {
      const subscriberIds = this.subscriptions.get(channel) || new Set();
      
      logger.info('📢 [CONNECTION MGR DEBUG] sendToSubscribers called', {
        channel,
        messageType: message.type,
        messageId: message.id,
        subscriberIdsCount: subscriberIds.size,
        subscriberIds: Array.from(subscriberIds),
        allChannels: Array.from(this.subscriptions.keys())
      });
      
      if (subscriberIds.size === 0) {
        logger.warn('❌ [CONNECTION MGR DEBUG] No subscribers for channel', { 
          channel,
          allChannels: Array.from(this.subscriptions.keys()),
          totalConnections: this.connections.size
        });
        return;
      }
      
      const clients = Array.from(subscriberIds)
        .map(id => this.connections.get(id))
        .filter(client => client !== undefined) as WebSocketClient[];
      
      logger.info('📤 [CONNECTION MGR DEBUG] Sending to clients', {
        channel,
        messageType: message.type,
        messageId: message.id,
        validClients: clients.length,
        invalidConnections: subscriberIds.size - clients.length
      });
      
      const promises = clients.map(async (client) => {
        try {
          await this.sendToClient(client, message);
          logger.debug('✅ [CONNECTION MGR DEBUG] Message sent to client', {
            clientId: client.id,
            userId: client.userId,
            messageType: message.type
          });
        } catch (error) {
          logger.error('❌ [CONNECTION MGR DEBUG] Failed to send to client', {
            clientId: client.id,
            userId: client.userId,
            error
          });
        }
      });
      
      await Promise.allSettled(promises);
      
      logger.info('✅ [CONNECTION MGR DEBUG] Message sent to subscribers completed', {
        channel,
        messageType: message.type,
        subscriberCount: clients.length
      });
      
    } catch (error) {
      logger.error('❌ [CONNECTION MGR DEBUG] Failed to send message to subscribers', { 
        error, 
        channel, 
        messageType: message.type 
      });
    }
  }

  /**
   * Add client to subscription channel
   */
  async addToSubscription(clientId: string, channel: SubscriptionChannel): Promise<void> {
    try {
      const client = this.connections.get(clientId);
      if (!client) {
        logger.warn('Attempted to subscribe non-existent connection', { clientId, channel });
        return;
      }
      
      // Add to local subscription
      if (!this.subscriptions.has(channel)) {
        this.subscriptions.set(channel, new Set());
      }
      this.subscriptions.get(channel)!.add(clientId);
      
      // Add to client's subscription set
      client.subscriptions.add(channel);
      
      // Store in Redis
      await this.redis.sadd(`subscription:${channel}`, clientId);
      await this.redis.expire(`subscription:${channel}`, 3600);
      
      // Update metrics
      this.metrics.subscriptions[channel] = (this.metrics.subscriptions[channel] || 0) + 1;
      
      logger.info('Client subscribed to channel', { clientId, channel, userId: client.userId });
      this.emit('subscription:added', clientId, channel);
      
    } catch (error) {
      logger.error('Failed to add subscription', { error, clientId, channel });
    }
  }

  /**
   * Remove client from subscription channel
   */
  async removeFromSubscription(clientId: string, channel: SubscriptionChannel): Promise<void> {
    try {
      const client = this.connections.get(clientId);
      
      // Remove from local subscription
      const subscribers = this.subscriptions.get(channel);
      if (subscribers) {
        subscribers.delete(clientId);
        if (subscribers.size === 0) {
          this.subscriptions.delete(channel);
        }
      }
      
      // Remove from client's subscription set
      if (client) {
        client.subscriptions.delete(channel);
      }
      
      // Remove from Redis
      await this.redis.srem(`subscription:${channel}`, clientId);
      
      // Update metrics
      if (this.metrics.subscriptions[channel]) {
        this.metrics.subscriptions[channel]--;
        if (this.metrics.subscriptions[channel] === 0) {
          delete this.metrics.subscriptions[channel];
        }
      }
      
      logger.info('Client unsubscribed from channel', { clientId, channel });
      this.emit('subscription:removed', clientId, channel);
      
    } catch (error) {
      logger.error('Failed to remove subscription', { error, clientId, channel });
    }
  }

  /**
   * Send message to individual client
   */
  private async sendToClient(client: WebSocketClient, message: WebSocketMessage): Promise<void> {
    try {
      if (client.socket.readyState === 1) { // WebSocket.OPEN
        const payload = JSON.stringify(message);
        client.socket.send(payload);
        
        this.metrics.messagesSent++;
        this.emit('message:sent', message, client.id);
      } else {
        logger.warn('Cannot send message to closed connection', { 
          clientId: client.id, 
          state: client.socket.readyState 
        });
      }
    } catch (error) {
      logger.error('Failed to send message to client', { 
        error, 
        clientId: client.id, 
        messageType: message.type 
      });
    }
  }

  /**
   * Update client's last ping time
   */
  async updateClientPing(clientId: string): Promise<void> {
    try {
      const client = this.connections.get(clientId);
      if (client) {
        client.lastPing = Date.now();
        await this.redis.hset(`connections:${clientId}`, 'lastPing', client.lastPing.toString());
      }
    } catch (error) {
      logger.error('Failed to update client ping', { error, clientId });
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): WebSocketMetrics {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
      activeConnections: this.connections.size
    };
  }

  /**
   * Cleanup stale connections
   */
  private async cleanup(): Promise<void> {
    try {
      const now = Date.now();
      const staleConnections: string[] = [];
      
      // Find stale connections (no ping for 2 minutes)
      for (const [clientId, client] of this.connections) {
        if (now - client.lastPing > 120000) { // 2 minutes
          staleConnections.push(clientId);
        }
      }
      
      // Remove stale connections
      for (const clientId of staleConnections) {
        await this.removeConnection(clientId);
      }
      
      if (staleConnections.length > 0) {
        logger.info('Cleaned up stale connections', { count: staleConnections.length });
      }
      
    } catch (error) {
      logger.error('Failed to cleanup connections', { error });
    }
  }

  /**
   * Shutdown the connection manager
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down connection manager');
      
      // Clear cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      // Close all connections
      for (const [clientId, client] of this.connections) {
        try {
          client.socket.close();
        } catch (error) {
          logger.error('Failed to close connection', { error, clientId });
        }
      }
      
      // Clear local state
      this.connections.clear();
      this.userConnections.clear();
      this.subscriptions.clear();
      
      // Safely disconnect Redis
      try {
        await this.redis.disconnect();
        logger.debug('Connection manager Redis disconnected');
      } catch (error) {
        logger.warn('Connection manager Redis disconnect failed', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
      
      logger.info('Connection manager shutdown complete');
      
    } catch (error) {
      logger.error('Failed to shutdown connection manager', { error });
    }
  }
}

// Export singleton instance
export const connectionManager = new WebSocketConnectionManager(); 