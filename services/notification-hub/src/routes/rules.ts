import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '@moonx-farm/common';
import { requireAdminAuth } from '../middleware/auth';

const logger = createLogger('RulesRoutes');

interface RuleAction {
  type: 'notification' | 'webhook' | 'email' | 'push' | 'telegram';
  parameters: any;
}

interface CreateRuleRequest {
  name: string;
  description?: string;
  conditions: {
    type: 'price_change' | 'volume_spike' | 'whale_transaction' | 'wallet_activity' | 'custom';
    parameters: any;
  };
  actions: RuleAction[];
  priority: 'high' | 'medium' | 'low';
  enabled: boolean;
  userId?: string;
  targetUsers?: string[];
  schedule?: {
    type: 'immediate' | 'delayed' | 'recurring';
    parameters: any;
  };
}

interface UpdateRuleRequest extends Partial<CreateRuleRequest> {
  id: string;
}

export async function rulesRoutes(fastify: FastifyInstance, options: any) {
  const { databaseService, schedulerService, notificationProcessor } = options;

  // Require admin authentication for all routes in this plugin
  requireAdminAuth(fastify);

  // Create notification rule
  fastify.post('/create', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ruleData = request.body as CreateRuleRequest;
      
      // Validate rule data
      if (!ruleData.name || !ruleData.conditions || !ruleData.actions) {
        reply.status(400).send({
          error: 'Missing required fields: name, conditions, actions'
        });
        return;
      }

      // Create rule in database
      const rule = await databaseService.createNotificationRule({
        name: ruleData.name,
        description: ruleData.description || '',
        conditions: ruleData.conditions,
        actions: ruleData.actions,
        priority: ruleData.priority || 'medium',
        enabled: ruleData.enabled ?? true,
        userId: ruleData.userId,
        targetUsers: ruleData.targetUsers || [],
        schedule: ruleData.schedule,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      logger.info(`Created notification rule: ${rule.id}`);
      reply.status(201).send({
        success: true,
        rule: rule
      });
    } catch (error) {
      logger.error(`Error creating rule: ${error}`);
      reply.status(500).send({
        error: 'Failed to create notification rule'
      });
    }
  });

  // Get all rules
  fastify.get('/list', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId, enabled } = request.query as { userId?: string; enabled?: boolean };
      
      const filters: any = {};
      if (userId) filters.userId = userId;
      if (enabled !== undefined) filters.enabled = enabled;

      const rules = await databaseService.getNotificationRules(filters);
      reply.send({
        success: true,
        rules: rules
      });
    } catch (error) {
      logger.error(`Error getting rules: ${error}`);
      reply.status(500).send({
        error: 'Failed to retrieve notification rules'
      });
    }
  });

  // Get specific rule
  fastify.get('/:ruleId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { ruleId } = request.params as { ruleId: string };
      
      const rule = await databaseService.getNotificationRule(ruleId);
      if (!rule) {
        reply.status(404).send({
          error: 'Notification rule not found'
        });
        return;
      }

      reply.send({
        success: true,
        rule: rule
      });
    } catch (error) {
      logger.error(`Error getting rule: ${error}`);
      reply.status(500).send({
        error: 'Failed to retrieve notification rule'
      });
    }
  });

  // Update rule
  fastify.put('/:ruleId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { ruleId } = request.params as { ruleId: string };
      const updateData = request.body as UpdateRuleRequest;
      
      const updatedRule = await databaseService.updateNotificationRule(ruleId, {
        ...updateData,
        updatedAt: new Date()
      });

      if (!updatedRule) {
        reply.status(404).send({
          error: 'Notification rule not found'
        });
        return;
      }

      logger.info(`Updated notification rule: ${ruleId}`);
      reply.send({
        success: true,
        rule: updatedRule
      });
    } catch (error) {
      logger.error(`Error updating rule: ${error}`);
      reply.status(500).send({
        error: 'Failed to update notification rule'
      });
    }
  });

  // Delete rule
  fastify.delete('/:ruleId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { ruleId } = request.params as { ruleId: string };
      
      const deleted = await databaseService.deleteNotificationRule(ruleId);
      if (!deleted) {
        reply.status(404).send({
          error: 'Notification rule not found'
        });
        return;
      }

      logger.info(`Deleted notification rule: ${ruleId}`);
      reply.send({
        success: true,
        message: 'Notification rule deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting rule: ${error}`);
      reply.status(500).send({
        error: 'Failed to delete notification rule'
      });
    }
  });

  // Enable/disable rule
  fastify.patch('/:ruleId/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { ruleId } = request.params as { ruleId: string };
      const { enabled } = request.body as { enabled: boolean };
      
      const updatedRule = await databaseService.updateNotificationRule(ruleId, {
        enabled: enabled,
        updatedAt: new Date()
      });

      if (!updatedRule) {
        reply.status(404).send({
          error: 'Notification rule not found'
        });
        return;
      }

      logger.info(`${enabled ? 'Enabled' : 'Disabled'} notification rule: ${ruleId}`);
      reply.send({
        success: true,
        rule: updatedRule
      });
    } catch (error) {
      logger.error(`Error toggling rule: ${error}`);
      reply.status(500).send({
        error: 'Failed to toggle notification rule'
      });
    }
  });

  // Test rule (trigger manually)
  fastify.post('/:ruleId/test', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { ruleId } = request.params as { ruleId: string };
      const { testData } = request.body as { testData?: any };
      
      const rule = await databaseService.getNotificationRule(ruleId);
      if (!rule) {
        reply.status(404).send({
          error: 'Notification rule not found'
        });
        return;
      }

      // Create test notification based on rule
      const testNotification = {
        userId: rule.userId || 'test-user',
        type: `test_${rule.conditions.type}`,
        title: `Test: ${rule.name}`,
        body: `Testing notification rule: ${rule.description || rule.name}`,
        priority: rule.priority,
        channels: rule.actions.map((action: RuleAction) => action.type),
        data: {
          test: true,
          ruleId: ruleId,
          testData: testData || {}
        }
      };

      const notification = await notificationProcessor.createNotification(testNotification);
      
      logger.info(`Test notification created for rule: ${ruleId}`);
      reply.send({
        success: true,
        message: 'Test notification sent',
        notificationId: notification.id
      });
    } catch (error) {
      logger.error(`Error testing rule: ${error}`);
      reply.status(500).send({
        error: 'Failed to test notification rule'
      });
    }
  });
} 