import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '@moonx-farm/common';
import { connectionRateLimitMiddleware } from '../middleware/rateLimitMiddleware';
import { WebSocketMessage } from '../types';

const logger = createLogger('websocket-routes');

export interface WebSocketHandlers {
  handleConnection: (socket: any, request: any) => void;
}

export default async function websocketRoutes(
  fastify: FastifyInstance,
  handlers: WebSocketHandlers
): Promise<void> {
  
  // WebSocket endpoint
  fastify.register(async (fastify) => {
    fastify.get('/ws', { websocket: true }, (connection, request) => {
      logger.info('New WebSocket connection attempt', {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        origin: request.headers.origin
      });

      // Delegate to handler
      handlers.handleConnection(connection.socket, request);
    });
  });

  logger.info('WebSocket routes registered');
} 