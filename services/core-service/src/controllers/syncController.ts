import { FastifyRequest, FastifyReply } from 'fastify';
import { AutoSyncService } from '../services/autoSyncService';
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

function createErrorResponse(error: string): ApiResponse {
  return {
    success: false,
    error,
    timestamp: new Date().toISOString()
  };
}

export class SyncController {
  constructor(
    private autoSyncService: AutoSyncService,
    private authMiddleware: AuthMiddleware
  ) {}

  /**
   * Trigger sync for current user
   */
  async triggerUserSync(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { userId, walletAddress } = request.user as any;
      const { syncType = 'portfolio', priority = 'normal' } = request.body as any;

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
      if (!['high', 'normal', 'low'].includes(priority)) {
        reply.status(400).send({
          success: false,
          message: 'Invalid priority. Must be high, normal, or low'
        });
        return;
      }

      // Trigger sync with rate limiting
      const result = await this.autoSyncService.triggerUserSync(userId, walletAddress, priority);

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
      console.error('Error triggering sync:', error);
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
      
      // Get user-specific sync status
      const syncStatus = await this.autoSyncService.getUserSyncStatus(userId, walletAddress);
      
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

      const operations = await this.autoSyncService.getUserSyncOperations(userId, walletAddress, {
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
      const queueStats = await this.autoSyncService.getSyncStats();
      
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
      } = body || {};

      if (userIds.length === 0 && walletAddresses.length === 0) {
        return reply.code(400).send(createErrorResponse('Either userIds or walletAddresses must be provided'));
      }

      const results = await this.autoSyncService.triggerBulkSync({
        userIds,
        walletAddresses,
        priority,
        syncType,
        batchSize
      });

      return reply.code(202).send(createSuccessResponse({
        bulkSyncTriggered: true,
        totalRequests: results.totalRequests,
        successfulTriggers: results.successfulTriggers,
        failedTriggers: results.failedTriggers,
        priority,
        syncType,
        batchSize
      }, `Bulk sync initiated for ${results.totalRequests} targets`));

    } catch (error) {
      logger.error('Trigger bulk sync error', { error: error instanceof Error ? error.message : String(error) });
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
        result = await this.autoSyncService.pauseService(reason);
      } else {
        result = await this.autoSyncService.resumeService();
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

      const stats = await this.autoSyncService.getDetailedSyncStats(timeframe, breakdown);

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

      const result = await this.autoSyncService.cancelSyncOperation(operationId, userId);

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