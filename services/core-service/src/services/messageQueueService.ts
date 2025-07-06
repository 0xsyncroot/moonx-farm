import { RedisManager } from '@moonx-farm/infrastructure';
import { createLoggerForAnyService } from '@moonx-farm/common';

const logger = createLoggerForAnyService('message-queue');

export interface SyncJobRequest {
  jobId: string;
  userId: string;
  walletAddress: string;
  priority: 'high' | 'medium' | 'low';
  syncType: 'portfolio' | 'trades' | 'full';
  forceRefresh?: boolean;
  triggeredAt: Date;
  metadata?: Record<string, any>;
}

export interface SyncJobResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export interface SyncStatusRequest {
  userId: string;
  walletAddress: string;
}

export interface SyncStatusResponse {
  userId: string;
  walletAddress: string;
  lastSyncAt: Date | null;
  syncStatus: 'current' | 'recent' | 'stale' | 'never';
  isRunning: boolean;
  activeSyncOperations: number;
  totalTokens: number;
  totalValueUsd: number;
  syncFrequency: number;
  nextScheduledSync: Date | null;
}

export class MessageQueueService {
  private redis: RedisManager;
  private isConnected: boolean = false;
  private responseTimeout: number = 30000; // 30 seconds

  // Queue names
  private readonly SYNC_REQUEST_QUEUE = 'sync:requests';
  private readonly SYNC_RESPONSE_QUEUE = 'sync:responses';
  private readonly SYNC_STATUS_QUEUE = 'sync:status';
  private readonly SYNC_OPERATIONS_QUEUE = 'sync:operations';

  constructor(redis: RedisManager) {
    this.redis = redis;
  }

  async connect(): Promise<void> {
    try {
      await this.redis.connect();
      this.isConnected = true;
      logger.info('Message queue service connected');
    } catch (error) {
      logger.error('Failed to connect message queue service', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.redis.disconnect();
      this.isConnected = false;
      logger.info('Message queue service disconnected');
    } catch (error) {
      logger.error('Failed to disconnect message queue service', { error });
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      return this.isConnected && await this.redis.isHealthy();
    } catch (error) {
      logger.error('Health check failed', { error });
      return false;
    }
  }

  /**
   * Send sync job request to sync worker
   */
  async sendSyncRequest(request: SyncJobRequest): Promise<SyncJobResponse> {
    try {
      if (!this.isConnected) {
        throw new Error('Message queue service not connected');
      }

      const message = {
        type: 'sync_request',
        data: request,
        timestamp: new Date().toISOString(),
        responseQueue: `${this.SYNC_RESPONSE_QUEUE}:${request.jobId}`
      };

      // Send request to sync worker
      await this.redis.lpush(this.SYNC_REQUEST_QUEUE, JSON.stringify(message));

      // Wait for response
      const response = await this.waitForResponse(request.jobId);
      
      logger.info('Sync request sent successfully', {
        jobId: request.jobId,
        userId: request.userId,
        priority: request.priority,
        responseStatus: response.status
      });

      return response;

    } catch (error) {
      logger.error('Failed to send sync request', {
        jobId: request.jobId,
        userId: request.userId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return error response
      return {
        jobId: request.jobId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      };
    }
  }

  /**
   * Get user sync status from sync worker
   */
  async getSyncStatus(request: SyncStatusRequest): Promise<SyncStatusResponse> {
    try {
      if (!this.isConnected) {
        throw new Error('Message queue service not connected');
      }

      const requestId = `status_${request.userId}_${Date.now()}`;
      const message = {
        type: 'sync_status',
        data: request,
        requestId,
        timestamp: new Date().toISOString(),
        responseQueue: `${this.SYNC_STATUS_QUEUE}:${requestId}`
      };

      // Send status request to sync worker
      await this.redis.lpush(this.SYNC_STATUS_QUEUE, JSON.stringify(message));

      // Wait for response
      const response = await this.waitForStatusResponse(requestId);
      
      logger.info('Sync status retrieved successfully', {
        userId: request.userId,
        syncStatus: response.syncStatus
      });

      return response;

    } catch (error) {
      logger.error('Failed to get sync status', {
        userId: request.userId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return default response
      return {
        userId: request.userId,
        walletAddress: request.walletAddress,
        lastSyncAt: null,
        syncStatus: 'never',
        isRunning: false,
        activeSyncOperations: 0,
        totalTokens: 0,
        totalValueUsd: 0,
        syncFrequency: 15,
        nextScheduledSync: null
      };
    }
  }

  /**
   * Get user sync operations from sync worker
   */
  async getSyncOperations(userId: string, walletAddress: string, filters: any): Promise<any[]> {
    try {
      if (!this.isConnected) {
        throw new Error('Message queue service not connected');
      }

      const requestId = `operations_${userId}_${Date.now()}`;
      const message = {
        type: 'sync_operations',
        data: {
          userId,
          walletAddress,
          filters
        },
        requestId,
        timestamp: new Date().toISOString(),
        responseQueue: `${this.SYNC_OPERATIONS_QUEUE}:${requestId}`
      };

      // Send operations request to sync worker
      await this.redis.lpush(this.SYNC_OPERATIONS_QUEUE, JSON.stringify(message));

      // Wait for response
      const response = await this.waitForOperationsResponse(requestId);
      
      logger.info('Sync operations retrieved successfully', {
        userId,
        operationsCount: response.length
      });

      return response;

    } catch (error) {
      logger.error('Failed to get sync operations', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return [];
    }
  }

  /**
   * Cancel sync operation
   */
  async cancelSyncOperation(operationId: string, userId: string): Promise<{ found: boolean; cancelled: boolean; previousStatus?: string }> {
    try {
      if (!this.isConnected) {
        throw new Error('Message queue service not connected');
      }

      const requestId = `cancel_${operationId}_${Date.now()}`;
      const message = {
        type: 'cancel_operation',
        data: {
          operationId,
          userId
        },
        requestId,
        timestamp: new Date().toISOString(),
        responseQueue: `sync:cancel:${requestId}`
      };

      // Send cancel request to sync worker
      await this.redis.lpush('sync:cancel', JSON.stringify(message));

      // Wait for response
      const response = await this.waitForCancelResponse(requestId);
      
      logger.info('Sync operation cancel request sent', {
        operationId,
        userId,
        result: response
      });

      return response;

    } catch (error) {
      logger.error('Failed to cancel sync operation', {
        operationId,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return { found: false, cancelled: false };
    }
  }

  /**
   * Wait for sync job response
   */
  private async waitForResponse(jobId: string): Promise<SyncJobResponse> {
    return new Promise((resolve, reject) => {
      const responseQueue = `${this.SYNC_RESPONSE_QUEUE}:${jobId}`;
      const timeout = setTimeout(() => {
        reject(new Error('Response timeout'));
      }, this.responseTimeout);

      const checkResponse = async () => {
        try {
          const response = await this.redis.getClient().brpop(responseQueue, 1);
          if (response) {
            clearTimeout(timeout);
            const data = JSON.parse(response[1]);
            resolve(data);
          } else {
            // Continue polling
            setTimeout(checkResponse, 100);
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      checkResponse();
    });
  }

  /**
   * Wait for sync status response
   */
  private async waitForStatusResponse(requestId: string): Promise<SyncStatusResponse> {
    return new Promise((resolve, reject) => {
      const responseQueue = `${this.SYNC_STATUS_QUEUE}:${requestId}`;
      const timeout = setTimeout(() => {
        reject(new Error('Status response timeout'));
      }, this.responseTimeout);

      const checkResponse = async () => {
        try {
          const response = await this.redis.getClient().brpop(responseQueue, 1);
          if (response) {
            clearTimeout(timeout);
            const data = JSON.parse(response[1]);
            resolve(data);
          } else {
            // Continue polling
            setTimeout(checkResponse, 100);
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      checkResponse();
    });
  }

  /**
   * Wait for sync operations response
   */
  private async waitForOperationsResponse(requestId: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const responseQueue = `${this.SYNC_OPERATIONS_QUEUE}:${requestId}`;
      const timeout = setTimeout(() => {
        reject(new Error('Operations response timeout'));
      }, this.responseTimeout);

      const checkResponse = async () => {
        try {
          const response = await this.redis.getClient().brpop(responseQueue, 1);
          if (response) {
            clearTimeout(timeout);
            const data = JSON.parse(response[1]);
            resolve(data);
          } else {
            // Continue polling
            setTimeout(checkResponse, 100);
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      checkResponse();
    });
  }

  /**
   * Wait for cancel operation response
   */
  private async waitForCancelResponse(requestId: string): Promise<{ found: boolean; cancelled: boolean; previousStatus?: string }> {
    return new Promise((resolve, reject) => {
      const responseQueue = `sync:cancel:${requestId}`;
      const timeout = setTimeout(() => {
        reject(new Error('Cancel response timeout'));
      }, this.responseTimeout);

      const checkResponse = async () => {
        try {
          const response = await this.redis.getClient().brpop(responseQueue, 1);
          if (response) {
            clearTimeout(timeout);
            const data = JSON.parse(response[1]);
            resolve(data);
          } else {
            // Continue polling
            setTimeout(checkResponse, 100);
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      checkResponse();
    });
  }
} 