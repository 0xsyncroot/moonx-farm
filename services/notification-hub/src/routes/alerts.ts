import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '@moonx-farm/common';
import { requireAuth, AuthenticatedRequest, AuthService } from '../middleware/auth';

const logger = createLogger('AlertsRoutes');

interface AlertConfig {
  id: string;
  userId: string;
  name: string;
  type: 'price_alert' | 'volume_alert' | 'whale_alert' | 'position_health' | 'yield_farming' | 'governance';
  parameters: {
    symbol?: string;
    targetPrice?: number;
    priceDirection?: 'above' | 'below';
    volumeThreshold?: number;
    transactionAmount?: number;
    walletAddress?: string;
    positionId?: string;
    poolId?: string;
    proposalId?: string;
    [key: string]: any;
  };
  channels: string[];
  priority: 'high' | 'medium' | 'low';
  active: boolean;
  triggerCount: number;
  lastTriggered?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export async function alertsRoutes(fastify: FastifyInstance, options: any) {
  const { databaseService, schedulerService, authService } = options;

  // Require authentication for all routes in this plugin
  requireAuth(fastify, authService);

  // Get user alerts
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user.id;
      const { type, active } = request.query as { type?: string; active?: boolean };
      
      const alerts = await databaseService.getUserAlerts(userId, { type, active });
      
      reply.send({
        success: true,
        alerts: alerts
      });
    } catch (error) {
      logger.error(`Error getting alerts: ${error}`);
      reply.status(500).send({
        error: 'Failed to retrieve alerts'
      });
    }
  });

  // Create price alert
  fastify.post('/price', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user.id;
      const alertData = request.body as {
        name: string;
        symbol: string;
        targetPrice: number;
        direction: 'above' | 'below';
        channels?: string[];
        priority?: 'high' | 'medium' | 'low';
      };
      
      // Validate required fields
      if (!alertData.name || !alertData.symbol || !alertData.targetPrice || !alertData.direction) {
        reply.status(400).send({
          error: 'Missing required fields: name, symbol, targetPrice, direction'
        });
        return;
      }

      // Create price alert
      const alert = await databaseService.createPriceAlert({
        userId: userId,
        symbol: alertData.symbol,
        targetPrice: alertData.targetPrice,
        direction: alertData.direction,
        name: alertData.name,
        channels: alertData.channels || ['websocket', 'push'],
        priority: alertData.priority || 'medium',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      logger.info(`Created price alert for user ${userId}: ${alert.id}`);
      reply.status(201).send({
        success: true,
        alert: alert
      });
    } catch (error) {
      logger.error(`Error creating price alert: ${error}`);
      reply.status(500).send({
        error: 'Failed to create price alert'
      });
    }
  });

  // Create volume alert
  fastify.post('/volume', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user.id;
      const alertData = request.body as {
        name: string;
        symbol: string;
        threshold: number;
        timeframe?: string;
        channels?: string[];
        priority?: 'high' | 'medium' | 'low';
      };
      
      // Validate required fields
      if (!alertData.name || !alertData.symbol || !alertData.threshold) {
        reply.status(400).send({
          error: 'Missing required fields: name, symbol, threshold'
        });
        return;
      }

      // Create volume alert
      const alert = await databaseService.createVolumeAlert({
        userId: userId,
        symbol: alertData.symbol,
        threshold: alertData.threshold,
        timeframe: alertData.timeframe || '1h',
        name: alertData.name,
        channels: alertData.channels || ['websocket', 'push'],
        priority: alertData.priority || 'medium',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      logger.info(`Created volume alert for user ${userId}: ${alert.id}`);
      reply.status(201).send({
        success: true,
        alert: alert
      });
    } catch (error) {
      logger.error(`Error creating volume alert: ${error}`);
      reply.status(500).send({
        error: 'Failed to create volume alert'
      });
    }
  });

  // Create whale alert
  fastify.post('/whale', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user.id;
      const alertData = request.body as {
        name: string;
        symbol: string;
        minAmount: number;
        walletAddress?: string;
        channels?: string[];
        priority?: 'high' | 'medium' | 'low';
      };
      
      // Validate required fields
      if (!alertData.name || !alertData.symbol || !alertData.minAmount) {
        reply.status(400).send({
          error: 'Missing required fields: name, symbol, minAmount'
        });
        return;
      }

      // Create whale alert
      const alert = await databaseService.createWhaleAlert({
        userId: userId,
        symbol: alertData.symbol,
        minAmount: alertData.minAmount,
        walletAddress: alertData.walletAddress,
        name: alertData.name,
        channels: alertData.channels || ['websocket', 'push'],
        priority: alertData.priority || 'medium',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      logger.info(`Created whale alert for user ${userId}: ${alert.id}`);
      reply.status(201).send({
        success: true,
        alert: alert
      });
    } catch (error) {
      logger.error(`Error creating whale alert: ${error}`);
      reply.status(500).send({
        error: 'Failed to create whale alert'
      });
    }
  });

  // Update alert
  fastify.put('/:alertId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user.id;
      const { alertId } = request.params as { alertId: string };
      const updateData = request.body as Partial<AlertConfig>;
      
      // Verify alert belongs to user
      const alert = await databaseService.getAlert(alertId);
      if (!alert || alert.userId !== userId) {
        reply.status(404).send({
          error: 'Alert not found'
        });
        return;
      }

      // Update alert
      const updatedAlert = await databaseService.updateAlert(alertId, {
        ...updateData,
        updatedAt: new Date()
      });

      logger.info(`Updated alert for user ${userId}: ${alertId}`);
      reply.send({
        success: true,
        alert: updatedAlert
      });
    } catch (error) {
      logger.error(`Error updating alert: ${error}`);
      reply.status(500).send({
        error: 'Failed to update alert'
      });
    }
  });

  // Delete alert
  fastify.delete('/:alertId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user.id;
      const { alertId } = request.params as { alertId: string };
      
      // Verify alert belongs to user
      const alert = await databaseService.getAlert(alertId);
      if (!alert || alert.userId !== userId) {
        reply.status(404).send({
          error: 'Alert not found'
        });
        return;
      }

      // Delete alert
      await databaseService.deleteAlert(alertId);

      logger.info(`Deleted alert for user ${userId}: ${alertId}`);
      reply.send({
        success: true,
        message: 'Alert deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting alert: ${error}`);
      reply.status(500).send({
        error: 'Failed to delete alert'
      });
    }
  });

  // Toggle alert active status
  fastify.patch('/:alertId/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user.id;
      const { alertId } = request.params as { alertId: string };
      
      // Verify alert belongs to user
      const alert = await databaseService.getAlert(alertId);
      if (!alert || alert.userId !== userId) {
        reply.status(404).send({
          error: 'Alert not found'
        });
        return;
      }

      // Toggle active status
      const updatedAlert = await databaseService.updateAlert(alertId, {
        active: !alert.active,
        updatedAt: new Date()
      });

      logger.info(`Toggled alert for user ${userId}: ${alertId} (${updatedAlert.active ? 'active' : 'inactive'})`);
      reply.send({
        success: true,
        alert: updatedAlert
      });
    } catch (error) {
      logger.error(`Error toggling alert: ${error}`);
      reply.status(500).send({
        error: 'Failed to toggle alert'
      });
    }
  });

  // Get alert statistics
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user.id;
      
      const stats = await databaseService.getUserAlertStats(userId);
      
      reply.send({
        success: true,
        stats: stats
      });
    } catch (error) {
      logger.error(`Error getting alert stats: ${error}`);
      reply.status(500).send({
        error: 'Failed to retrieve alert statistics'
      });
    }
  });

  // Test alert (manually trigger)
  fastify.post('/:alertId/test', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user.id;
      const { alertId } = request.params as { alertId: string };
      
      // Verify alert belongs to user
      const alert = await databaseService.getAlert(alertId);
      if (!alert || alert.userId !== userId) {
        reply.status(404).send({
          error: 'Alert not found'
        });
        return;
      }

      // Create test notification
      await schedulerService.scheduleNotification({
        scheduledAt: new Date(),
        notification: {
          userId: userId,
          type: `test_${alert.type}`,
          title: `Test Alert: ${alert.name}`,
          body: `This is a test notification for your ${alert.type} alert.`,
          priority: alert.priority,
          channels: alert.channels,
          data: {
            test: true,
            alertId: alertId,
            alertType: alert.type
          }
        },
        createdBy: 'system'
      });

      logger.info(`Test alert triggered for user ${userId}: ${alertId}`);
      reply.send({
        success: true,
        message: 'Test alert notification sent'
      });
    } catch (error) {
      logger.error(`Error testing alert: ${error}`);
      reply.status(500).send({
        error: 'Failed to test alert'
      });
    }
  });
} 