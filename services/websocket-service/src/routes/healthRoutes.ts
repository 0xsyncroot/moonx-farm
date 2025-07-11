import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { serviceRegistry } from '../services/serviceRegistry';
import { connectionManager } from '../services/connectionManager';
import { connectionHandler } from '../handlers/connectionHandler';
import { createLogger } from '@moonx-farm/common';
import { websocketConfig } from '../config';

const logger = createLogger('health-routes');

export default async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  // Health check endpoint
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    const healthResult = await serviceRegistry.getHealthStatus();
    
    if (healthResult.overall === 'healthy') {
      return reply.code(200).send({
        status: 'healthy',
        timestamp: Date.now(),
        services: healthResult.services
      });
    } else {
      return reply.code(503).send({
        status: healthResult.overall,
        timestamp: Date.now(),
        services: healthResult.services
      });
    }
  });

  // Metrics endpoint
  fastify.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    const metrics = {
      services: serviceRegistry.getMetrics(),
      serviceCount: serviceRegistry.getServiceCount(),
      uptime: process.uptime(),
      pendingAuthentications: connectionHandler.getPendingConnectionsCount(),
      timestamp: new Date().toISOString()
    };
    
    return reply.send(metrics);
  });

  // Connection status endpoint
  fastify.get('/connections', async (request: FastifyRequest, reply: FastifyReply) => {
    const status = {
      totalConnections: connectionManager.getConnectionCount(),
      pendingAuthentications: connectionHandler.getPendingConnectionsCount(),
      services: serviceRegistry.getServiceCount(),
      timestamp: new Date().toISOString()
    };
    
    return reply.send(status);
  });

  // Root endpoint
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      service: 'MoonX Farm WebSocket Service',
      version: '1.0.0',
      status: 'running',
      authentication: 'post-connection',
      endpoints: {
        websocket: '/ws',
        health: '/health',
        metrics: '/metrics',
        connections: '/connections',
        docs: websocketConfig.swagger.enabled ? websocketConfig.swagger.path : null
      }
    });
  });
}

 