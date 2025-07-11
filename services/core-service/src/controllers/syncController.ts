import { FastifyRequest, FastifyReply } from 'fastify';
import { SyncProxyService } from '../services/syncProxyService';
import { AuthMiddleware } from '../middleware/authMiddleware';
import { createLoggerForAnyService } from '@moonx-farm/common';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

const logger = createLoggerForAnyService('sync-controller');

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  timestamp: string;
}

function createSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message: message || 'Success',
    timestamp: new Date().toISOString()
  };
}

function createErrorResponse(message: string): ApiResponse<null> {
  return {
    success: false,
    data: null,
    message,
    timestamp: new Date().toISOString()
  };
}

export class SyncController {
  private syncProxyService: SyncProxyService;
  private authMiddleware: AuthMiddleware;

  constructor(syncProxyService: SyncProxyService, authMiddleware: AuthMiddleware) {
    this.syncProxyService = syncProxyService;
    this.authMiddleware = authMiddleware;
  }

  /**
   * Trigger sync for current user
   */
  async triggerUserSync(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { userId, walletAddress, aaWalletAddress } = request.user as any;
      const { syncType = 'portfolio', priority = 'medium', source = 'manual' } = request.body as any;

      // Use AA wallet address if available, otherwise fallback to EOA
      const targetWalletAddress = aaWalletAddress || walletAddress;

      // Validate inputs
      if (!userId || !targetWalletAddress) {
        reply.status(401).send({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Validate sync type
      if (!['portfolio', 'trades', 'full'].includes(syncType)) {
        reply.status(400).send({
          success: false,
          message: 'Invalid sync type. Must be portfolio, trades, or full'
        });
        return;
      }

      // Validate priority
      if (!['high', 'medium', 'low'].includes(priority)) {
        reply.status(400).send({
          success: false,
          message: 'Invalid priority. Must be high, medium, or low'
        });
        return;
      }

      // Trigger sync via proxy service (handles sync operations record creation)
      const result = await this.syncProxyService.triggerUserSync(userId, targetWalletAddress, priority, {
        source,
        bypassRateLimit: false, // Manual user triggers should respect rate limits
        metadata: {
          triggered_by: 'core-service',
          triggered_at: new Date().toISOString(),
          user_ip: request.ip || 'unknown',
          user_agent: request.headers['user-agent'] || 'unknown'
        }
      });

      if (!result.success) {
        const statusCode = result.message.includes('Rate limit') ? 429 : 409;
        reply.status(statusCode).send({
          success: false,
          message: result.message,
          data: result.rateLimitInfo || null
        });
        return;
      }

      reply.send({
        success: true,
        message: 'Sync triggered successfully',
        data: {
          syncOperationId: result.syncOperationId,
          syncType,
          priority,
          source,
          ...result.rateLimitInfo
        }
      });

    } catch (error) {
      logger.error('Error triggering sync', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      reply.status(500).send({
        success: false,
        message: 'Failed to trigger sync'
      });
    }
  }

  // GET /sync/status - Get current sync status for user
  async getUserSyncStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest);
      const walletAddress = this.authMiddleware.getCurrentWalletAddress(request as AuthenticatedRequest);
      const aaWalletAddress = this.authMiddleware.getCurrentAAWalletAddress(request as AuthenticatedRequest);
      
      // Use AA wallet address if available, otherwise fallback to EOA
      const targetWalletAddress = aaWalletAddress || walletAddress;
      
      // Get user-specific sync status via proxy service
      const syncStatus = await this.syncProxyService.getUserSyncStatus(userId, targetWalletAddress);
      
      return reply.send(createSuccessResponse(syncStatus, 'User sync status retrieved'));

    } catch (error) {
      logger.error('Get user sync status error', { 
        error: error instanceof Error ? error.message : String(error),
        userId: this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest)
      });
      return reply.status(500).send(createErrorResponse('Failed to get sync status'));
    }
  }

  // GET /sync/operations - Get user sync operations
  async getUserSyncOperations(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest);
      const walletAddress = this.authMiddleware.getCurrentWalletAddress(request as AuthenticatedRequest);
      const aaWalletAddress = this.authMiddleware.getCurrentAAWalletAddress(request as AuthenticatedRequest);
      
      // Use AA wallet address if available, otherwise fallback to EOA
      const targetWalletAddress = aaWalletAddress || walletAddress;
      
      const { 
        limit = 20,
        status,
        type,
        days = 30
      } = request.query as any;

      // Get user sync operations via proxy service
      const operations = await this.syncProxyService.getUserSyncOperations(
        userId, 
        targetWalletAddress, 
        {
          limit: parseInt(limit),
          status,
          type,
          days: parseInt(days)
        }
      );

      return reply.send(createSuccessResponse(operations, 
        `Retrieved ${operations.length} sync operations`));

    } catch (error) {
      logger.error('Get user sync operations error', { 
        error: error instanceof Error ? error.message : String(error),
        userId: this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest)
      });
      return reply.status(500).send(createErrorResponse('Failed to get sync operations'));
    }
  }

  // GET /sync/queue - Get sync queue (admin only)
  async getSyncQueue(request: FastifyRequest, reply: FastifyReply) {
    try {
      // This is handled by sync worker - return delegated response
      return reply.send(createSuccessResponse({
        message: 'Sync queue management is handled by the sync worker service',
        status: 'delegated'
      }, 'Sync queue delegated to sync worker'));

    } catch (error) {
      logger.error('Get sync queue error', { error: error instanceof Error ? error.message : String(error) });
      return reply.status(500).send(createErrorResponse('Failed to get sync queue'));
    }
  }

  // POST /sync/bulk - Trigger bulk sync (admin only)
  async triggerBulkSync(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { userIds, priority = 'medium', syncType = 'portfolio' } = request.body as any;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return reply.status(400).send(createErrorResponse('userIds must be a non-empty array'));
      }

      // This would be handled by sync worker - return placeholder response
      return reply.send(createSuccessResponse({
        message: 'Bulk sync operations are handled by the sync worker service',
        status: 'delegated',
        requestedUsers: userIds.length,
        priority,
        syncType
      }, 'Bulk sync delegated to sync worker'));

    } catch (error) {
      logger.error('Trigger bulk sync error', { error: error instanceof Error ? error.message : String(error) });
      return reply.status(500).send(createErrorResponse('Failed to trigger bulk sync'));
    }
  }

  // PUT /sync/pause - Pause/resume sync service (admin only)
  async pauseResumeSync(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { action, reason } = request.body as any;

      if (!['pause', 'resume'].includes(action)) {
        return reply.status(400).send(createErrorResponse('Action must be pause or resume'));
      }

      // Use sync proxy service for pause/resume
      const result = action === 'pause' 
        ? await this.syncProxyService.pauseService(reason)
        : await this.syncProxyService.resumeService();

      if (!result.success) {
        return reply.status(500).send(createErrorResponse(`Failed to ${action} sync service`));
      }

      return reply.send(createSuccessResponse({
        action,
        previousState: result.previousState,
        currentState: result.currentState,
        reason: action === 'pause' ? reason : undefined
      }, `Sync service ${action}d successfully`));

    } catch (error) {
      logger.error('Pause/resume sync error', { error: error instanceof Error ? error.message : String(error) });
      return reply.status(500).send(createErrorResponse('Failed to pause/resume sync service'));
    }
  }

  // GET /sync/stats - Get sync statistics (admin only)
  async getSyncStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { timeframe = '24h', breakdown = 'status' } = request.query as any;

      // Get stats via sync proxy service
      const stats = await this.syncProxyService.getDetailedSyncStats(timeframe, breakdown);

      return reply.send(createSuccessResponse(stats, 
        `Sync statistics retrieved for ${timeframe} timeframe`));

    } catch (error) {
      logger.error('Get sync stats error', { error: error instanceof Error ? error.message : String(error) });
      return reply.status(500).send(createErrorResponse('Failed to get sync statistics'));
    }
  }

  // DELETE /sync/operations/:operationId - Cancel sync operation
  async cancelSyncOperation(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest);
      const { operationId } = request.params as any;

      if (!operationId) {
        return reply.status(400).send(createErrorResponse('Operation ID is required'));
      }

      // Cancel via sync proxy service
      const result = await this.syncProxyService.cancelSyncOperation(operationId, userId);

      if (!result.found) {
        return reply.status(404).send(createErrorResponse('Sync operation not found'));
      }

      if (!result.cancelled) {
        return reply.status(409).send(createErrorResponse('Sync operation cannot be cancelled'));
      }

      return reply.send(createSuccessResponse({
        operationId,
        cancelled: true,
        previousStatus: result.previousStatus
      }, 'Sync operation cancelled successfully'));

    } catch (error) {
      logger.error('Cancel sync operation error', { 
        error: error instanceof Error ? error.message : String(error),
        userId: this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest)
      });
      return reply.status(500).send(createErrorResponse('Failed to cancel sync operation'));
    }
  }
} 