import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '@moonx-farm/common';

const logger = createLogger('SystemRoutes');

export async function systemRoutes(fastify: FastifyInstance, options: any) {
  const { 
    redisService, 
    kafkaService, 
    databaseService, 
    kafkaConsumerPool, 
    prometheusService, 
    analyticsService 
  } = options;

  // Health check endpoint
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          redis: await redisService.healthCheck(),
          database: await databaseService.healthCheck(),
          kafka: await kafkaService.healthCheck(),
          kafkaConsumerPool: await kafkaConsumerPool.isHealthy()
        }
      };

      const allHealthy = Object.values(health.services).every(status => status);
      health.status = allHealthy ? 'healthy' : 'unhealthy';

      reply.status(allHealthy ? 200 : 503).send(health);
    } catch (error) {
      logger.error(`Health check error: ${error}`);
      reply.status(500).send({
        status: 'error',
        error: 'Health check failed'
      });
    }
  });

  // Metrics endpoint
  fastify.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = await prometheusService.getMetrics();
      reply.type('text/plain').send(metrics);
    } catch (error) {
      logger.error(`Metrics error: ${error}`);
      reply.status(500).send({
        error: 'Failed to retrieve metrics'
      });
    }
  });

  // Analytics endpoint
  fastify.get('/analytics', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { period = '24h' } = request.query as { period?: string };
      const analytics = await analyticsService.getAnalytics(period);
      reply.send(analytics);
    } catch (error) {
      logger.error(`Analytics error: ${error}`);
      reply.status(500).send({
        error: 'Failed to retrieve analytics'
      });
    }
  });

  // System status endpoint
  fastify.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        timestamp: new Date().toISOString()
      };
      reply.send(status);
    } catch (error) {
      logger.error(`Status error: ${error}`);
      reply.status(500).send({
        error: 'Failed to retrieve system status'
      });
    }
  });
} 