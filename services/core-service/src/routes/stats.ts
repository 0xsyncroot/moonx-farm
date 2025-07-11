import { FastifyInstance } from 'fastify';
import { DatabaseService } from '../services/databaseService';
import { CacheService } from '../services/cacheService';
import { StatsService } from '../services/statsService';
import { StatsController } from '../controllers/statsController';
import { createLoggerForAnyService } from '@moonx-farm/common';

const logger = createLoggerForAnyService('stats-routes');

export interface StatsRoutesOptions {
  databaseService: DatabaseService;
  cacheService: CacheService;
}

export async function statsRoutes(
  fastify: FastifyInstance,
  options: StatsRoutesOptions
) {
  const { cacheService } = options;
  
  // Initialize services
  const statsService = new StatsService(cacheService);
  const statsController = new StatsController(statsService);
  
  // Initialize MongoDB connection for stats service
  // This will create a separate connection for stats database
  try {
    await statsService.init();
    logger.info('Stats service initialized with MongoDB connection');
  } catch (error) {
    logger.warn('Failed to initialize Stats service MongoDB connection, continuing with fallback', { error });
    // Continue without MongoDB connection - service will handle gracefully
  }
  
  // Register all stats routes
  await statsController.registerRoutes(fastify);
  
  logger.info('Stats routes registered successfully');
} 