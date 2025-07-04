// Minimal Connection Manager for WebSocket Gateway
import { logger } from '@moonx-farm/common';

interface ConnectionInfo {
  id: string;
  userId: string;
  connectionTime: Date;
  lastActivity: Date;
  rooms: Set<string>;
  subscriptions: Set<string>;
  clientIP?: string;
}

export class ConnectionManager {
  private connections: Map<string, ConnectionInfo> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();

  async addConnection(socket: any): Promise<void> {
    const connectionInfo: ConnectionInfo = {
      id: socket.id,
      userId: socket.userId,
      connectionTime: new Date(),
      lastActivity: new Date(),
      rooms: new Set(),
      subscriptions: new Set(),
      clientIP: socket.clientIP
    };

    this.connections.set(socket.id, connectionInfo);

    // Track user connections
    if (!this.userConnections.has(socket.userId)) {
      this.userConnections.set(socket.userId, new Set());
    }
    this.userConnections.get(socket.userId)!.add(socket.id);

    logger.debug('Connection added', {
      connectionId: socket.id,
      userId: socket.userId,
      totalConnections: this.connections.size
    });
  }

  async removeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from user connections
    const userConnections = this.userConnections.get(connection.userId);
    if (userConnections) {
      userConnections.delete(connectionId);
      if (userConnections.size === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

    this.connections.delete(connectionId);

    logger.debug('Connection removed', {
      connectionId,
      userId: connection.userId,
      totalConnections: this.connections.size
    });
  }

  async updateLastActivity(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = new Date();
    }
  }

  async addToRoom(connectionId: string, room: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.rooms.add(room);
    }
  }

  async removeFromRoom(connectionId: string, room: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.rooms.delete(room);
    }
  }

  async updateSubscriptions(connectionId: string, subscriptions: string[]): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.subscriptions = new Set(subscriptions);
    }
  }

  async getUserConnectionCount(userId: string): Promise<number> {
    const userConnections = this.userConnections.get(userId);
    return userConnections ? userConnections.size : 0;
  }

  async getDetailedStats(): Promise<any> {
    return {
      totalConnections: this.connections.size,
      uniqueUsers: this.userConnections.size,
      connectionsPerUser: Array.from(this.userConnections.entries()).map(([userId, connections]) => ({
        userId,
        connectionCount: connections.size
      })),
      timestamp: new Date().toISOString()
    };
  }

  // Cleanup inactive connections
  async cleanupInactiveConnections(maxIdleTime: number = 300000): Promise<void> {
    const now = new Date();
    const toRemove: string[] = [];

    for (const [connectionId, connection] of this.connections.entries()) {
      const idleTime = now.getTime() - connection.lastActivity.getTime();
      if (idleTime > maxIdleTime) {
        toRemove.push(connectionId);
      }
    }

    for (const connectionId of toRemove) {
      await this.removeConnection(connectionId);
    }

    if (toRemove.length > 0) {
      logger.info(`Cleaned up ${toRemove.length} inactive connections`);
    }
  }
} 