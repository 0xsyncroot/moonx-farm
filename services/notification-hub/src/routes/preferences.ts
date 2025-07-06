import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '@moonx-farm/common';
import { requireAuth, AuthenticatedRequest, AuthService } from '../middleware/auth';

const logger = createLogger('PreferencesRoutes');

interface UserPreferences {
  userId: string;
  channels: {
    websocket: boolean;
    email: boolean;
    push: boolean;
    telegram: boolean;
  };
  notifications: {
    priceAlerts: boolean;
    volumeAlerts: boolean;
    whaleAlerts: boolean;
    walletActivity: boolean;
    systemAlerts: boolean;
    tradingSignals: boolean;
    marketNews: boolean;
    portfolio: boolean;
  };
  frequency: {
    immediate: boolean;
    hourly: boolean;
    daily: boolean;
    weekly: boolean;
  };
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
    timezone: string;
  };
  filters: {
    minPriceChange: number;
    minVolumeThreshold: number;
    minTransactionAmount: number;
    watchedTokens: string[];
    ignoredTokens: string[];
  };
}

export async function preferencesRoutes(fastify: FastifyInstance, options: any) {
  const { databaseService, redisManager, authService } = options;

  // Require authentication for all routes in this plugin
  requireAuth(fastify, authService);

  // Get user preferences
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user.id;
      
      // Try to get from cache first
      const cachedPrefs = await redisManager.getUserPreferences(userId);
      if (cachedPrefs) {
        reply.send({
          success: true,
          preferences: cachedPrefs
        });
        return;
      }

      // Get from database
      const preferences = await databaseService.getUserPreferences(userId);
      if (!preferences) {
        // Return default preferences
        const defaultPrefs: UserPreferences = {
          userId: userId,
          channels: {
            websocket: true,
            email: false,
            push: false,
            telegram: false
          },
          notifications: {
            priceAlerts: true,
            volumeAlerts: true,
            whaleAlerts: true,
            walletActivity: true,
            systemAlerts: true,
            tradingSignals: false,
            marketNews: false,
            portfolio: true
          },
          frequency: {
            immediate: true,
            hourly: false,
            daily: false,
            weekly: false
          },
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00',
            timezone: 'UTC'
          },
          filters: {
            minPriceChange: 5,
            minVolumeThreshold: 100000,
            minTransactionAmount: 10000,
            watchedTokens: [],
            ignoredTokens: []
          }
        };

        reply.send({
          success: true,
          preferences: defaultPrefs
        });
        return;
      }

      // Cache preferences
      await redisManager.cacheUserPreferences(userId, preferences);

      reply.send({
        success: true,
        preferences: preferences
      });
    } catch (error) {
      logger.error(`Error getting preferences: ${error}`);
      reply.status(500).send({
        error: 'Failed to retrieve user preferences'
      });
    }
  });

  // Update user preferences
  fastify.put('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user.id;
      const preferences = request.body as UserPreferences;
      
      // Validate preferences
      if (!preferences.channels || !preferences.notifications) {
        reply.status(400).send({
          error: 'Invalid preferences format'
        });
        return;
      }

      // Update in database
      const updatedPrefs = await databaseService.updateUserPreferences(userId, preferences);
      
      // Update cache
      await redisManager.cacheUserPreferences(userId, updatedPrefs);

      logger.info(`Updated preferences for user: ${userId}`);
      reply.send({
        success: true,
        preferences: updatedPrefs
      });
    } catch (error) {
      logger.error(`Error updating preferences: ${error}`);
      reply.status(500).send({
        error: 'Failed to update user preferences'
      });
    }
  });

  // Update specific preference section
  fastify.patch('/:section', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user.id;
      const { section } = request.params as { section: string };
      const sectionData = request.body;
      
      const validSections = ['channels', 'notifications', 'frequency', 'quietHours', 'filters'];
      if (!validSections.includes(section)) {
        reply.status(400).send({
          error: 'Invalid preference section'
        });
        return;
      }

      // Get current preferences
      const currentPrefs = await databaseService.getUserPreferences(userId);
      if (!currentPrefs) {
        reply.status(404).send({
          error: 'User preferences not found'
        });
        return;
      }

      // Update specific section
      const currentSection = currentPrefs[section as keyof typeof currentPrefs];
      const updatedPrefs = {
        ...currentPrefs,
        [section]: typeof currentSection === 'object' && currentSection !== null
          ? Object.assign({}, currentSection, sectionData)
          : sectionData
      };

      // Save to database
      await databaseService.updateUserPreferences(userId, updatedPrefs);
      
      // Update cache
      await redisManager.cacheUserPreferences(userId, updatedPrefs);

      logger.info(`Updated ${section} preferences for user: ${userId}`);
      reply.send({
        success: true,
        preferences: updatedPrefs
      });
    } catch (error) {
      logger.error(`Error updating preference section: ${error}`);
      reply.status(500).send({
        error: 'Failed to update preference section'
      });
    }
  });

  // Reset preferences to default
  fastify.post('/reset', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user.id;
      
      // Delete current preferences
      await databaseService.deleteUserPreferences(userId);
      
      // Clear cache
      await redisManager.clearUserPreferences(userId);

      logger.info(`Reset preferences for user: ${userId}`);
      reply.send({
        success: true,
        message: 'Preferences reset to default'
      });
    } catch (error) {
      logger.error(`Error resetting preferences: ${error}`);
      reply.status(500).send({
        error: 'Failed to reset user preferences'
      });
    }
  });

  // Get preferences for multiple users (admin only - keep original with userIds in body)
  fastify.post('/bulk', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userIds } = request.body as { userIds: string[] };
      
      if (!Array.isArray(userIds) || userIds.length === 0) {
        reply.status(400).send({
          error: 'Invalid user IDs array'
        });
        return;
      }

      const preferences = await databaseService.getBulkUserPreferences(userIds);
      
      reply.send({
        success: true,
        preferences: preferences
      });
    } catch (error) {
      logger.error(`Error getting bulk preferences: ${error}`);
      reply.status(500).send({
        error: 'Failed to retrieve bulk preferences'
      });
    }
  });
} 