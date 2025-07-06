import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '@moonx-farm/common';
import { requireAuth, AuthenticatedRequest, AuthService } from '../middleware/auth';

const logger = createLogger('SubscriptionsRoutes');

interface Subscription {
  id: string;
  userId: string;
  type: 'price_alert' | 'volume_alert' | 'whale_alert' | 'wallet_tracking' | 'token_news' | 'portfolio_update';
  target: string; // token symbol, wallet address, etc.
  conditions: {
    threshold?: number;
    direction?: 'above' | 'below' | 'both';
    percentage?: number;
    timeframe?: string;
  };
  channels: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function subscriptionsRoutes(fastify: FastifyInstance, options: any) {
  const { databaseService, redisManager, authService } = options;

  // Require authentication for all routes in this plugin
  requireAuth(fastify, authService);

  // Get user subscriptions
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user.id;
      const { type, active } = request.query as { type?: string; active?: boolean };
      
      const filters: any = { userId };
      if (type) filters.type = type;
      if (active !== undefined) filters.active = active;

      const subscriptions = await databaseService.getUserSubscriptions(filters);
      
      reply.send({
        success: true,
        subscriptions: subscriptions
      });
    } catch (error) {
      logger.error(`Error getting subscriptions: ${error}`);
      reply.status(500).send({
        error: 'Failed to retrieve subscriptions'
      });
    }
  });

  // Create subscription
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user.id;
      const subscriptionData = request.body as Omit<Subscription, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
      
      // Validate subscription data
      if (!subscriptionData.type || !subscriptionData.target) {
        reply.status(400).send({
          error: 'Missing required fields: type, target'
        });
        return;
      }

      // Create subscription
      const subscription = await databaseService.createSubscription({
        userId: userId,
        type: subscriptionData.type,
        target: subscriptionData.target,
        conditions: subscriptionData.conditions || {},
        channels: subscriptionData.channels || ['websocket'],
        active: subscriptionData.active ?? true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      logger.info(`Created subscription for user ${userId}: ${subscription.id}`);
      reply.status(201).send({
        success: true,
        subscription: subscription
      });
    } catch (error) {
      logger.error(`Error creating subscription: ${error}`);
      reply.status(500).send({
        error: 'Failed to create subscription'
      });
    }
  });

  // Update subscription
  fastify.put('/:subscriptionId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user.id;
      const { subscriptionId } = request.params as { subscriptionId: string };
      const updateData = request.body as Partial<Subscription>;
      
      // Verify subscription belongs to user
      const subscription = await databaseService.getSubscription(subscriptionId);
      if (!subscription || subscription.userId !== userId) {
        reply.status(404).send({
          error: 'Subscription not found'
        });
        return;
      }

      // Update subscription
      const updatedSubscription = await databaseService.updateSubscription(subscriptionId, {
        ...updateData,
        updatedAt: new Date()
      });

      logger.info(`Updated subscription for user ${userId}: ${subscriptionId}`);
      reply.send({
        success: true,
        subscription: updatedSubscription
      });
    } catch (error) {
      logger.error(`Error updating subscription: ${error}`);
      reply.status(500).send({
        error: 'Failed to update subscription'
      });
    }
  });

  // Delete subscription
  fastify.delete('/:subscriptionId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user.id;
      const { subscriptionId } = request.params as { subscriptionId: string };
      
      // Verify subscription belongs to user
      const subscription = await databaseService.getSubscription(subscriptionId);
      if (!subscription || subscription.userId !== userId) {
        reply.status(404).send({
          error: 'Subscription not found'
        });
        return;
      }

      // Delete subscription
      await databaseService.deleteSubscription(subscriptionId);

      logger.info(`Deleted subscription for user ${userId}: ${subscriptionId}`);
      reply.send({
        success: true,
        message: 'Subscription deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting subscription: ${error}`);
      reply.status(500).send({
        error: 'Failed to delete subscription'
      });
    }
  });

  // Toggle subscription active status
  fastify.patch('/:subscriptionId/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user.id;
      const { subscriptionId } = request.params as { subscriptionId: string };
      
      // Verify subscription belongs to user
      const subscription = await databaseService.getSubscription(subscriptionId);
      if (!subscription || subscription.userId !== userId) {
        reply.status(404).send({
          error: 'Subscription not found'
        });
        return;
      }

      // Toggle active status
      const updatedSubscription = await databaseService.updateSubscription(subscriptionId, {
        active: !subscription.active,
        updatedAt: new Date()
      });

      logger.info(`Toggled subscription for user ${userId}: ${subscriptionId} (${updatedSubscription.active ? 'active' : 'inactive'})`);
      reply.send({
        success: true,
        subscription: updatedSubscription
      });
    } catch (error) {
      logger.error(`Error toggling subscription: ${error}`);
      reply.status(500).send({
        error: 'Failed to toggle subscription'
      });
    }
  });

  // Get subscription statistics
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user.id;
      
      const stats = await databaseService.getUserSubscriptionStats(userId);
      
      reply.send({
        success: true,
        stats: stats
      });
    } catch (error) {
      logger.error(`Error getting subscription stats: ${error}`);
      reply.status(500).send({
        error: 'Failed to retrieve subscription statistics'
      });
    }
  });

  // Bulk operations
  fastify.post('/bulk', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user.id;
      const { action, subscriptionIds } = request.body as { action: 'activate' | 'deactivate' | 'delete'; subscriptionIds: string[] };
      
      if (!Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
        reply.status(400).send({
          error: 'Invalid subscription IDs array'
        });
        return;
      }

      let result;
      switch (action) {
        case 'activate':
          result = await databaseService.bulkUpdateSubscriptions(userId, subscriptionIds, { active: true });
          break;
        case 'deactivate':
          result = await databaseService.bulkUpdateSubscriptions(userId, subscriptionIds, { active: false });
          break;
        case 'delete':
          result = await databaseService.bulkDeleteSubscriptions(userId, subscriptionIds);
          break;
        default:
          reply.status(400).send({
            error: 'Invalid action'
          });
          return;
      }

      logger.info(`Bulk ${action} operation for user ${userId}: ${subscriptionIds.length} subscriptions`);
      reply.send({
        success: true,
        result: result
      });
    } catch (error) {
      logger.error(`Error in bulk operation: ${error}`);
      reply.status(500).send({
        error: 'Failed to perform bulk operation'
      });
    }
  });
} 