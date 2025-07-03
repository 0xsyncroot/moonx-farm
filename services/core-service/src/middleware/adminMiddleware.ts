import { FastifyRequest, FastifyReply } from 'fastify';
import { createCoreServiceConfig } from '@moonx-farm/configs';
import { createLogger } from '@moonx-farm/common';

const logger = createLogger('core-service');

export class AdminMiddleware {
  private adminApiKey: string;

  constructor() {
    // Get admin API key from environment variables
    const apiKey = process.env.ADMIN_API_KEY;
    
    if (!apiKey) {
      throw new Error('ADMIN_API_KEY environment variable is required but not configured');
    }
    
    this.adminApiKey = apiKey;
  }

  async authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const apiKey = request.headers['x-api-key'] as string;
      
      if (!apiKey) {
        logger.warn('Admin API access attempted without API key', {
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          url: request.url
        });
        
        return reply.code(401).send({
          success: false,
          error: 'Missing x-api-key header'
        });
      }

      if (apiKey !== this.adminApiKey) {
        logger.warn('Admin API access attempted with invalid API key', {
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          url: request.url,
          providedKey: apiKey.substring(0, 8) + '...' // Log partial key for debugging
        });
        
        return reply.code(401).send({
          success: false,
          error: 'Invalid API key'
        });
      }

      logger.info('Admin API access granted', {
        ip: request.ip,
        url: request.url,
        method: request.method
      });

    } catch (error) {
      logger.error('Admin middleware error', { 
        error: error instanceof Error ? error.message : String(error),
        ip: request.ip,
        url: request.url
      });

      return reply.code(500).send({
        success: false,
        error: 'Admin authentication failed'
      });
    }
  }

  // Helper method to validate admin API key without middleware context
  validateApiKey(apiKey: string): boolean {
    return apiKey === this.adminApiKey;
  }

  // Helper method to get admin API key for testing/validation
  getApiKeyHash(): string {
    // Return a hash or partial key for debugging purposes
    return this.adminApiKey.substring(0, 8) + '...';
  }
} 