import { FastifyInstance } from 'fastify';
import healthRoutes from './healthRoutes';
import websocketRoutes, { WebSocketHandlers } from './websocketRoutes';

export async function registerRoutes(
  fastify: FastifyInstance,
  websocketHandlers?: WebSocketHandlers
): Promise<void> {
  // Register health routes
  await fastify.register(healthRoutes);
  
  // Register WebSocket routes if handlers provided
  if (websocketHandlers) {
    await fastify.register(websocketRoutes, websocketHandlers);
  }
}

export { default as healthRoutes } from './healthRoutes';
export { default as websocketRoutes } from './websocketRoutes'; 