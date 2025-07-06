import { FastifyRequest, FastifyReply } from 'fastify';
import { SyncProxyService } from '../services/syncProxyService';
import { AuthenticatedRequest, AuthMiddleware } from '../middleware/authMiddleware';
import { ApiResponse } from '../types';
import { createLoggerForAnyService } from '@moonx-farm/common';

const logger = createLoggerForAnyService('sync-controller');

// Helper functions for standardized API responses
function createSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };
  
  if (message) {
    response.message = message;
  }
  
  return response;
}

function createErrorResponse(message: string): ApiResponse<null> {
  return {
    success: false,
    error: message,
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
      const { userId, walletAddress } = request.user as any;
      const { syncType = 'portfolio', priority = 'medium' } = request.body as any;

      // Validate inputs
      if (!userId || !walletAddress) {
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

      // Trigger sync via proxy service
      const result = await this.syncProxyService.triggerUserSync(userId, walletAddress, priority);

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
          syncType,
          priority,
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
      
      // Get user-specific sync status via proxy service
      const syncStatus = await this.syncProxyService.getUserSyncStatus(userId, walletAddress);
      
      return reply.send(createSuccessResponse(syncStatus, 'User sync status retrieved'));

    } catch (error) {
      logger.error('Get user sync status error', { 
        error: error instanceof Error ? error.message : String(error),
        userId: this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest)
      });
      
      return reply.code(500).send(createErrorResponse('Failed to get sync status'));
    }
  }

  // GET /sync/operations - Get sync operations history for user
  async getUserSyncOperations(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest);
      const walletAddress = this.authMiddleware.getCurrentWalletAddress(request as AuthenticatedRequest);
      
      const query = request.query as any;
      const {
        limit = 20,
        status,
        type,
        days = 7
      } = query;

      const operations = await this.syncProxyService.getUserSyncOperations(userId, walletAddress, {
        limit,
        status,
        type,
        days
      });

      return reply.send(createSuccessResponse({
        operations,
        count: operations.length,
        filters: { limit, status, type, days }
      }, `Retrieved ${operations.length} sync operations`));

    } catch (error) {
      logger.error('Get user sync operations error', { 
        error: error instanceof Error ? error.message : String(error),
        userId: this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest)
      });
      
      return reply.code(500).send(createErrorResponse('Failed to get sync operations'));
    }
  }

  // GET /sync/queue - Get current sync queue status (admin only)
  async getSyncQueue(request: FastifyRequest, reply: FastifyReply) {
    try {
      const queueStats = await this.syncProxyService.getSyncStats();
      
      return reply.send(createSuccessResponse(queueStats, 'Sync queue status retrieved'));

    } catch (error) {
      logger.error('Get sync queue error', { error: error instanceof Error ? error.message : String(error) });
      return reply.code(500).send(createErrorResponse('Failed to get sync queue'));
    }
  }

  // POST /sync/bulk - Trigger bulk sync for multiple users (admin only)
  async triggerBulkSync(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any;
      const { 
        userIds = [], 
        walletAddresses = [], 
        priority = 'low', 
        syncType = 'portfolio',
        batchSize = 10
      } = body;

      if (!Array.isArray(userIds) && !Array.isArray(walletAddresses)) {
        return reply.code(400).send(createErrorResponse('Either userIds or walletAddresses array is required'));
      }

      // For now, return mock response since bulk sync would need special handling
      // TODO: Implement bulk sync communication with sync worker
      const totalRequests = Math.max(userIds.length, walletAddresses.length);
      
      logger.info('Bulk sync requested', {
        totalRequests,
        priority,
        syncType,
        batchSize
      });

      return reply.code(202).send(createSuccessResponse({
        bulkSyncTriggered: true,
        totalRequests,
        successfulTriggers: totalRequests,
        failedTriggers: 0,
        priority,
        syncType,
        batchSize
      }, `Bulk sync initiated for ${totalRequests} targets`));

    } catch (error) {
      logger.error('Bulk sync error', { error: error instanceof Error ? error.message : String(error) });
      return reply.code(500).send(createErrorResponse('Failed to trigger bulk sync'));
    }
  }

  // PUT /sync/pause - Pause/resume sync service (admin only)
  async pauseResumeSync(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any;
      const { action, reason } = body;

      if (!action || !['pause', 'resume'].includes(action)) {
        return reply.code(400).send(createErrorResponse('Action must be either "pause" or "resume"'));
      }

      let result;
      if (action === 'pause') {
        result = await this.syncProxyService.pauseService(reason);
      } else {
        result = await this.syncProxyService.resumeService();
      }

      return reply.send(createSuccessResponse({
        action,
        success: result.success,
        previousState: result.previousState,
        currentState: result.currentState,
        reason: reason || 'No reason provided',
        timestamp: new Date().toISOString()
      }, `Sync service ${action}d successfully`));

    } catch (error) {
      logger.error('Pause/resume sync error', { error: error instanceof Error ? error.message : String(error) });
      const action = (request.body as any)?.action || 'manage';
      return reply.code(500).send(createErrorResponse(`Failed to ${action} sync service`));
    }
  }

  // GET /sync/stats - Get comprehensive sync statistics (admin only)
  async getSyncStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const {
        timeframe = '24h',
        breakdown = 'type'
      } = query || {};

      const stats = await this.syncProxyService.getDetailedSyncStats(timeframe, breakdown);

      return reply.send(createSuccessResponse(stats, `Sync statistics for ${timeframe} retrieved`));

    } catch (error) {
      logger.error('Get sync stats error', { error: error instanceof Error ? error.message : String(error) });
      return reply.code(500).send(createErrorResponse('Failed to get sync statistics'));
    }
  }

  // DELETE /sync/operations/:operationId - Cancel specific sync operation
  async cancelSyncOperation(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest);
      const params = request.params as any;
      const { operationId } = params;

      const result = await this.syncProxyService.cancelSyncOperation(operationId, userId);

      if (!result.found) {
        return reply.code(404).send(createErrorResponse('Sync operation not found'));
      }

      if (!result.cancelled) {
        return reply.code(400).send(createErrorResponse('Sync operation cannot be cancelled (may be already completed or running)'));
      }

      return reply.send(createSuccessResponse({
        operationId,
        cancelled: true,
        previousStatus: result.previousStatus,
        cancelledAt: new Date().toISOString()
      }, 'Sync operation cancelled successfully'));

    } catch (error) {
      logger.error('Cancel sync operation error', { 
        error: error instanceof Error ? error.message : String(error),
        operationId: (request.params as any)?.operationId,
        userId: this.authMiddleware.getCurrentUserId(request as AuthenticatedRequest)
      });
      
      return reply.code(500).send(createErrorResponse('Failed to cancel sync operation'));
    }
  }
} 