import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '@moonx-farm/common';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const logger = createLogger('AuthMiddleware');

export interface AuthenticatedUser {
  id: string;
  privyId: string;
  walletAddress: string;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: AuthenticatedUser;
}

export interface AuthService {
  verifyToken(token: string): Promise<AuthenticatedUser | null>;
}

export class AuthService implements AuthService {
  private authServiceUrl: string;

  constructor(authServiceUrl: string) {
    this.authServiceUrl = authServiceUrl;
  }

  async verifyToken(token: string): Promise<AuthenticatedUser | null> {
    return new Promise((resolve) => {
      try {
        const url = new URL(`${this.authServiceUrl}/api/v1/auth/verify`);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const requestOptions = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        };

        const req = httpModule.request(requestOptions, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              if (res.statusCode === 401) {
                logger.warn('Token verification failed - unauthorized');
                resolve(null);
                return;
              }

              if (res.statusCode !== 200) {
                logger.error(`Auth service error: ${res.statusCode} ${res.statusMessage}`);
                resolve(null);
                return;
              }

              const jsonData = JSON.parse(data);
              
              if (!jsonData.success || !jsonData.data.user) {
                logger.warn('Invalid auth service response format');
                resolve(null);
                return;
              }

              resolve(jsonData.data.user);
            } catch (parseError) {
              logger.error(`Failed to parse auth service response: ${parseError}`);
              resolve(null);
            }
          });
        });

        req.on('error', (error) => {
          logger.error(`Auth service request failed: ${error}`);
          resolve(null);
        });

        req.on('timeout', () => {
          logger.error('Auth service request timeout');
          req.destroy();
          resolve(null);
        });

        req.end();
      } catch (error) {
        logger.error(`Auth service request setup failed: ${error}`);
        resolve(null);
      }
    });
  }
}

export function createAuthMiddleware(authService: AuthService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      reply.status(401).send({
        success: false,
        message: 'Authorization header is required'
      });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      reply.status(401).send({
        success: false,
        message: 'Invalid authorization format. Use Bearer token'
      });
      return;
    }

    const token = authHeader.substring(7);
    if (!token) {
      reply.status(401).send({
        success: false,
        message: 'Access token is required'
      });
      return;
    }

    try {
      const user = await authService.verifyToken(token);
      
      if (!user) {
        reply.status(401).send({
          success: false,
          message: 'Invalid or expired access token'
        });
        return;
      }

      if (!user.isActive) {
        reply.status(401).send({
          success: false,
          message: 'User account is deactivated'
        });
        return;
      }

      // Attach user to request
      (request as AuthenticatedRequest).user = user;
      
      logger.debug(`User authenticated: ${user.id}`);
    } catch (error) {
      logger.error(`Authentication error: ${error}`);
      reply.status(500).send({
        success: false,
        message: 'Authentication service error'
      });
      return;
    }
  };
}

export function createAdminAuthMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = request.headers['x-api-key'] as string;
    const adminApiKey = process.env['ADMIN_API_KEY'];
    
    if (!adminApiKey) {
      logger.error('ADMIN_API_KEY environment variable not configured');
      reply.status(500).send({
        success: false,
        message: 'Server configuration error'
      });
      return;
    }

    if (!apiKey) {
      reply.status(401).send({
        success: false,
        message: 'X-API-Key header is required for admin endpoints'
      });
      return;
    }

    if (apiKey !== adminApiKey) {
      logger.warn(`Invalid admin API key attempted: ${apiKey.substring(0, 4)}...`);
      reply.status(401).send({
        success: false,
        message: 'Invalid admin API key'
      });
      return;
    }

    logger.debug('Admin authenticated via API key');
  };
}

export function requireAuth(fastify: FastifyInstance, authService: AuthService) {
  const authMiddleware = createAuthMiddleware(authService);
  
  fastify.addHook('preHandler', authMiddleware);
}

export function requireAdminAuth(fastify: FastifyInstance) {
  const adminAuthMiddleware = createAdminAuthMiddleware();
  
  fastify.addHook('preHandler', adminAuthMiddleware);
} 