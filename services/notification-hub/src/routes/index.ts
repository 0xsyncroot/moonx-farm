import { FastifyInstance } from 'fastify';
import { systemRoutes } from './system';
import { rulesRoutes } from './rules';
import { preferencesRoutes } from './preferences';
import { subscriptionsRoutes } from './subscriptions';
import { alertsRoutes } from './alerts';

export async function registerRoutes(fastify: FastifyInstance, services: any) {
  // System routes (health, metrics, analytics)
  await fastify.register(systemRoutes, { prefix: '/api/v1/system', ...services });
  
  // Rules management routes
  await fastify.register(rulesRoutes, { prefix: '/api/v1/rules', ...services });
  
  // User preferences routes
  await fastify.register(preferencesRoutes, { prefix: '/api/v1/preferences', ...services });
  
  // Subscriptions management routes
  await fastify.register(subscriptionsRoutes, { prefix: '/api/v1/subscriptions', ...services });
  
  // Alerts configuration routes
  await fastify.register(alertsRoutes, { prefix: '/api/v1/alerts', ...services });
} 