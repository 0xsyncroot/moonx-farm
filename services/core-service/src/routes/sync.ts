import { FastifyInstance } from 'fastify';
import { SyncController } from '../controllers/syncController';
import { AutoSyncService } from '../services/autoSyncService';
import { AuthMiddleware } from '../middleware/authMiddleware';
import { AdminMiddleware } from '../middleware/adminMiddleware';
import { CacheService } from '../services/cacheService';
import { DatabaseService } from '../services/databaseService';
import { PortfolioService } from '../services/portfolioService';

interface SyncRoutesOptions {
  databaseService: DatabaseService;
  cacheService: CacheService;
  portfolioService: PortfolioService;
}

export async function syncRoutes(
  fastify: FastifyInstance,
  options: SyncRoutesOptions
) {
  // Initialize services
  const autoSyncService = new AutoSyncService(
    options.portfolioService,
    options.cacheService,
    options.databaseService
  );
  
  const authMiddleware = new AuthMiddleware();
  const adminMiddleware = new AdminMiddleware();
  
  const syncController = new SyncController(autoSyncService, authMiddleware);

  // USER SYNC ROUTES (Require authentication)

  // POST /sync/trigger - Manual sync for current user
  fastify.post('/trigger', {
    preHandler: authMiddleware.authenticate.bind(authMiddleware),
    schema: {
      body: {
        type: 'object',
        properties: {
          priority: { type: 'string', enum: ['high', 'normal', 'low'] },
          syncType: { type: 'string', enum: ['portfolio', 'trades', 'full'] },
          forceRefresh: { type: 'boolean' }
        }
      },
      response: {
        202: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                syncTriggered: { type: 'boolean' },
                userId: { type: 'string' },
                walletAddress: { type: 'string' },
                priority: { type: 'string' },
                syncType: { type: 'string' },
                forceRefresh: { type: 'boolean' },
                message: { type: 'string' }
              }
            },
            message: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      },
      tags: ['Sync'],
      summary: 'Trigger manual sync for current user',
      description: 'Manually trigger portfolio sync for the authenticated user with specified priority'
    }
  }, syncController.triggerUserSync.bind(syncController));

  // GET /sync/status - Get sync status for current user
  fastify.get('/status', {
    preHandler: authMiddleware.authenticate.bind(authMiddleware),
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                userId: { type: 'string' },
                walletAddress: { type: 'string' },
                lastSyncAt: { type: 'string', format: 'date-time' },
                syncStatus: { type: 'string', enum: ['current', 'recent', 'stale', 'never'] },
                isRunning: { type: 'boolean' },
                activeSyncOperations: { type: 'integer' },
                totalTokens: { type: 'integer' },
                totalValueUsd: { type: 'number' },
                syncFrequency: { type: 'integer' },
                nextScheduledSync: { type: 'string', format: 'date-time' }
              }
            },
            message: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      },
      tags: ['Sync'],
      summary: 'Get sync status for current user',
      description: 'Get detailed sync status information for the authenticated user'
    }
  }, syncController.getUserSyncStatus.bind(syncController));

  // GET /sync/operations - Get sync operations history
  fastify.get('/operations', {
    preHandler: authMiddleware.authenticate.bind(authMiddleware),
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
          status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed'] },
          type: { type: 'string', enum: ['portfolio', 'trades', 'full'] },
          days: { type: 'integer', default: 7, minimum: 1, maximum: 90 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                operations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      type: { type: 'string' },
                      status: { type: 'string' },
                      priority: { type: 'string' },
                      startedAt: { type: 'string', format: 'date-time' },
                      completedAt: { type: 'string', format: 'date-time' },
                      duration: { type: 'integer' },
                      tokensLynced: { type: 'integer' },
                      chainsLynced: { type: 'integer' },
                      totalValueUsd: { type: 'number' },
                      error: { type: 'string' },
                      retryCount: { type: 'integer' }
                    }
                  }
                },
                count: { type: 'integer' },
                filters: { type: 'object' }
              }
            },
            message: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      },
      tags: ['Sync'],
      summary: 'Get sync operations history',
      description: 'Get sync operations history for the authenticated user with optional filtering'
    }
  }, syncController.getUserSyncOperations.bind(syncController));

  // DELETE /sync/operations/:operationId - Cancel sync operation
  fastify.delete('/operations/:operationId', {
    preHandler: authMiddleware.authenticate.bind(authMiddleware),
    schema: {
      params: {
        type: 'object',
        required: ['operationId'],
        properties: {
          operationId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                operationId: { type: 'string' },
                cancelled: { type: 'boolean' },
                previousStatus: { type: 'string' },
                cancelledAt: { type: 'string', format: 'date-time' }
              }
            },
            message: { type: 'string' },
            timestamp: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      },
      tags: ['Sync'],
      summary: 'Cancel sync operation',
      description: 'Cancel a pending sync operation for the authenticated user'
    }
  }, syncController.cancelSyncOperation.bind(syncController));

  // ADMIN SYNC ROUTES (Require admin authentication)

  // GET /sync/queue - Get sync queue status (admin only)
  fastify.get('/queue', {
    preHandler: adminMiddleware.authenticate.bind(adminMiddleware),
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totalUsers: { type: 'integer' },
                usersNeedingSync: { type: 'integer' },
                stalePortfolios: { type: 'integer' },
                isRunning: { type: 'boolean' },
                lastProcessedAt: { type: 'string', format: 'date-time' },
                syncErrors: { type: 'integer' }
              }
            },
            message: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      },
      tags: ['Admin', 'Sync'],
      summary: 'Get sync queue status',
      description: 'Get current sync queue status and statistics (admin only)'
    }
  }, syncController.getSyncQueue.bind(syncController));

  // POST /sync/bulk - Trigger bulk sync (admin only)
  fastify.post('/bulk', {
    preHandler: adminMiddleware.authenticate.bind(adminMiddleware),
    schema: {
      body: {
        type: 'object',
        properties: {
          userIds: { type: 'array', items: { type: 'string' } },
          walletAddresses: { type: 'array', items: { type: 'string' } },
          priority: { type: 'string', enum: ['high', 'normal', 'low'] },
          syncType: { type: 'string', enum: ['portfolio', 'trades', 'full'] },
          batchSize: { type: 'integer', default: 10, minimum: 1, maximum: 50 }
        }
      },
      response: {
        202: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                bulkSyncTriggered: { type: 'boolean' },
                totalRequests: { type: 'integer' },
                successfulTriggers: { type: 'integer' },
                failedTriggers: { type: 'integer' },
                priority: { type: 'string' },
                syncType: { type: 'string' },
                batchSize: { type: 'integer' }
              }
            },
            message: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      },
      tags: ['Admin', 'Sync'],
      summary: 'Trigger bulk sync',
      description: 'Trigger sync for multiple users or wallets (admin only)'
    }
  }, syncController.triggerBulkSync.bind(syncController));

  // PUT /sync/pause - Pause/resume sync service (admin only)
  fastify.put('/pause', {
    preHandler: adminMiddleware.authenticate.bind(adminMiddleware),
    schema: {
      body: {
        type: 'object',
        required: ['action'],
        properties: {
          action: { type: 'string', enum: ['pause', 'resume'] },
          reason: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                action: { type: 'string' },
                success: { type: 'boolean' },
                previousState: { type: 'boolean' },
                currentState: { type: 'boolean' },
                reason: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' }
              }
            },
            message: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      },
      tags: ['Admin', 'Sync'],
      summary: 'Pause or resume sync service',
      description: 'Pause or resume the automatic sync service (admin only)'
    }
  }, syncController.pauseResumeSync.bind(syncController));

  // GET /sync/stats - Get detailed sync statistics (admin only)
  fastify.get('/stats', {
    preHandler: adminMiddleware.authenticate.bind(adminMiddleware),
    schema: {
      querystring: {
        type: 'object',
        properties: {
          timeframe: { type: 'string', enum: ['24h', '7d', '30d'] },
          breakdown: { type: 'string', enum: ['user', 'chain', 'type'] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                timeframe: { type: 'string' },
                breakdown: { type: 'string' },
                summary: {
                  type: 'object',
                  properties: {
                    totalSyncs: { type: 'integer' },
                    successfulSyncs: { type: 'integer' },
                    failedSyncs: { type: 'integer' },
                    averageDuration: { type: 'number' },
                    totalTokensSynced: { type: 'integer' },
                    totalValueSynced: { type: 'number' }
                  }
                },
                breakdownData: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      category: { type: 'string' },
                      count: { type: 'integer' },
                      successRate: { type: 'number' },
                      avgDuration: { type: 'number' },
                      totalValue: { type: 'number' }
                    }
                  }
                },
                serviceStatus: {
                  type: 'object',
                  properties: {
                    isRunning: { type: 'boolean' },
                    lastProcessedAt: { type: 'string', format: 'date-time' },
                    queueLength: { type: 'integer' }
                  }
                }
              }
            },
            message: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      },
      tags: ['Admin', 'Sync'],
      summary: 'Get comprehensive sync statistics',
      description: 'Get detailed sync statistics with breakdown by user, chain, or type (admin only)'
    }
  }, syncController.getSyncStats.bind(syncController));
} 