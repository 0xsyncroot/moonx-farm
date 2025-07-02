import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createLogger, LogContext } from '@moonx-farm/common';
import { authenticate } from '../middleware/authMiddleware';

const logger = createLogger('session-controller');

// Input validation schemas
const sessionListSchema = {
  querystring: {
    type: 'object',
    properties: {
      limit: { 
        type: 'number', 
        minimum: 1, 
        maximum: 100, 
        default: 10 
      },
      offset: { 
        type: 'number', 
        minimum: 0, 
        default: 0 
      },
    },
    additionalProperties: false,
  },
};

const sessionParamsSchema = {
  params: {
    type: 'object',
    required: ['sessionId'],
    properties: {
      sessionId: { 
        type: 'string',
        pattern: '^[a-zA-Z0-9-_]+$',
        minLength: 1,
        maxLength: 100
      },
    },
    additionalProperties: false,
  },
};

// Types
interface SessionListRequest {
  Querystring: {
    limit?: number;
    offset?: number;
  };
}

interface SessionRevokeRequest {
  Params: { 
    sessionId: string;
  };
}

interface SafeSession {
  id: string;
  sessionToken: string; // Masked
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
}

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    userId: string;
    privyId: string;
    email?: string;
  };
}

export async function sessionRoutes(fastify: FastifyInstance) {
  /**
   * Get user sessions with pagination
   * GET /api/v1/session/list
   */
  fastify.get<SessionListRequest>('/list', {
    preHandler: [
      authenticate,
      // Rate limiting for session listing
      async (request: FastifyRequest, reply: FastifyReply) => {
        const userId = (request as AuthenticatedRequest).user?.userId;
        const key = `session_list:${userId}`;
        
        try {
          const attempts = await fastify.redisService.incrementRateLimit(key, 60000, 10);
          
          if (attempts.exceeded) {
            logger.warn('Session list rate limit exceeded', { userId, attempts: attempts.count });
            return reply.code(429).send({
              success: false,
              message: 'Too many requests. Please try again later.',
            });
          }
        } catch (error) {
          // Continue without rate limiting if Redis fails
        }
      }
    ],
    schema: sessionListSchema,
  }, async (request: FastifyRequest<SessionListRequest>, reply: FastifyReply) => {
    const startTime = Date.now();
    const logContext: LogContext = {
      userId: (request as AuthenticatedRequest).user?.userId,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      endpoint: 'GET /session/list',
    };

    try {
      const user = (request as AuthenticatedRequest).user;
      const { limit = 10, offset = 0 } = request.query;

      logger.info('Getting user sessions', { 
        ...logContext,
        limit, 
        offset 
      });

      // Get user sessions from database with proper SQL injection protection
      const query = `
        SELECT 
          id,
          session_token,
          created_at,
          updated_at,
          expires_at,
          ip_address,
          user_agent,
          CASE WHEN expires_at > NOW() THEN true ELSE false END as is_active
        FROM user_sessions 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
      `;

      const [sessionResult, countResult] = await Promise.all([
        fastify.db.query(query, [user.userId, limit, offset]),
        fastify.db.query(
          'SELECT COUNT(*) as total FROM user_sessions WHERE user_id = $1',
          [user.userId]
        )
      ]);

      const sessions: SafeSession[] = sessionResult.rows.map((session: any) => ({
        id: session.id,
        sessionToken: session.session_token.substring(0, 8) + '...', // Mask for security
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        expiresAt: session.expires_at,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        isActive: session.is_active,
      }));

      const total = parseInt(countResult.rows[0].total);
      const duration = Date.now() - startTime;

      logger.info('Sessions retrieved successfully', {
        ...logContext,
        sessionCount: sessions.length,
        total,
        duration,
      });

      return reply.send({
        success: true,
        data: {
          sessions,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
          },
        },
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to get user sessions', { 
        ...logContext,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
      
      return reply.code(500).send({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  /**
   * Revoke a specific session
   * DELETE /api/v1/session/:sessionId
   */
  fastify.delete<SessionRevokeRequest>('/revoke/:sessionId', {
    preHandler: [
      authenticate,
      // Rate limiting for session revocation
      async (request: FastifyRequest, reply: FastifyReply) => {
        const userId = (request as AuthenticatedRequest).user?.userId;
        const key = `session_revoke:${userId}`;
        
        try {
          const attempts = await fastify.redisService.incrementRateLimit(key, 300000, 20);
          
          if (attempts.exceeded) {
            logger.warn('Session revoke rate limit exceeded', { userId, attempts: attempts.count });
            return reply.code(429).send({
              success: false,
              message: 'Too many session revocations. Please try again later.',
            });
          }
        } catch (error) {
          // Continue without rate limiting if Redis fails
        }
      }
    ],
    schema: sessionParamsSchema,
  }, async (request: FastifyRequest<SessionRevokeRequest>, reply: FastifyReply) => {
    const startTime = Date.now();
    const logContext: LogContext = {
      userId: (request as AuthenticatedRequest).user?.userId,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      endpoint: 'DELETE /session/revoke',
      sessionId: request.params.sessionId,
    };

    try {
      const user = (request as AuthenticatedRequest).user;
      const { sessionId } = request.params;

      logger.info('Revoking session', logContext);

      // Check if session belongs to user and get session data
      const sessionResult = await fastify.db.query(
        'SELECT * FROM user_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, user.userId]
      );

      if (sessionResult.rows.length === 0) {
        logger.warn('Session not found or unauthorized access', logContext);
        return reply.code(404).send({
          success: false,
          message: 'Session not found',
        });
      }

      const session = sessionResult.rows[0];

      // Parallel operations for better performance
      const operations = [
        // Delete session from database
        fastify.db.query('DELETE FROM user_sessions WHERE id = $1', [sessionId])
      ];

      // Blacklist the session token if it's still valid
      if (new Date(session.expires_at) > new Date()) {
        const ttl = Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000);
        if (ttl > 0) {
          operations.push(
            fastify.redisService.blacklistToken(session.session_token, ttl)
          );
        }
      }

      // Delete refresh token from Redis if exists
      if (session.refresh_token) {
        operations.push(
          fastify.redisService.deleteRefreshToken(user.userId, session.refresh_token)
        );
      }

      await Promise.all(operations);

      const duration = Date.now() - startTime;
      logger.info('Session revoked successfully', { 
        ...logContext,
        duration,
      });

      return reply.send({
        success: true,
        message: 'Session revoked successfully',
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to revoke session', { 
        ...logContext,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
      
      return reply.code(500).send({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  /**
   * Revoke all other sessions (except current)
   * POST /api/v1/session/revoke-others
   */
  fastify.post('/revoke-others', {
    preHandler: [
      authenticate,
      // Rate limiting for revoke-others (more strict)
      async (request: FastifyRequest, reply: FastifyReply) => {
        const userId = (request as AuthenticatedRequest).user?.userId;
        const key = `session_revoke_others:${userId}`;
        
        try {
          const attempts = await fastify.redisService.incrementRateLimit(key, 3600000, 5);
          
          if (attempts.exceeded) {
            logger.warn('Revoke-others rate limit exceeded', { userId, attempts: attempts.count });
            return reply.code(429).send({
              success: false,
              message: 'Too many bulk session revocations. Please try again later.',
            });
          }
        } catch (error) {
          // Continue without rate limiting if Redis fails
        }
      }
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const logContext: LogContext = {
      userId: (request as AuthenticatedRequest).user?.userId,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      endpoint: 'POST /session/revoke-others',
    };

    try {
      const user = (request as AuthenticatedRequest).user;
      const authorization = request.headers.authorization;
      
      if (!authorization) {
        logger.warn('No authorization header provided', logContext);
        return reply.code(401).send({
          success: false,
          message: 'No authorization header',
        });
      }

      const currentToken = authorization.replace('Bearer ', '');
      const decoded = (fastify as any).jwt.decode(currentToken);

      if (!decoded || !decoded.jti) {
        logger.warn('Invalid current token', logContext);
        return reply.code(401).send({
          success: false,
          message: 'Invalid current token',
        });
      }

      const currentTokenId = decoded.jti;
      logger.info('Revoking all other sessions', { 
        ...logContext,
        currentTokenId: currentTokenId.substring(0, 8) + '...' // Mask for security
      });

      // Get all sessions except current
      const sessionsResult = await fastify.db.query(
        'SELECT * FROM user_sessions WHERE user_id = $1 AND session_token != $2',
        [user.userId, currentTokenId]
      );

      const sessions = sessionsResult.rows;

      if (sessions.length === 0) {
        logger.info('No other sessions to revoke', logContext);
        return reply.send({
          success: true,
          message: 'No other sessions to revoke',
          data: {
            revokedCount: 0,
          },
        });
      }

      // Parallel operations for better performance
      const operations = [
        // Delete all other sessions from database
        fastify.db.query(
          'DELETE FROM user_sessions WHERE user_id = $1 AND session_token != $2',
          [user.userId, currentTokenId]
        )
      ];

      // Blacklist all other access tokens that are still valid
      for (const session of sessions) {
        if (new Date(session.expires_at) > new Date()) {
          const ttl = Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000);
          if (ttl > 0) {
            operations.push(
              fastify.redisService.blacklistToken(session.session_token, ttl)
            );
          }
        }
      }

      // Delete all other refresh tokens from Redis (keeping current)
      // First get current session to find its refresh token
      const currentSessionResult = await fastify.db.query(
        'SELECT refresh_token FROM user_sessions WHERE session_token = $1 AND user_id = $2',
        [currentTokenId, user.userId]
      );
      
      const currentRefreshTokenId = currentSessionResult.rows[0]?.refresh_token;
      
      // Delete all other refresh tokens except current
      for (const session of sessions) {
        if (session.refresh_token !== currentRefreshTokenId) {
          operations.push(
            fastify.redisService.deleteRefreshToken(user.userId, session.refresh_token)
          );
        }
      }

      await Promise.all(operations);

      const duration = Date.now() - startTime;
      logger.info('All other sessions revoked successfully', { 
        ...logContext,
        revokedCount: sessions.length,
        duration,
      });

      return reply.send({
        success: true,
        message: `${sessions.length} other sessions revoked successfully`,
        data: {
          revokedCount: sessions.length,
        },
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to revoke other sessions', { 
        ...logContext,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
      
      return reply.code(500).send({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  /**
   * Get current session info
   * GET /api/v1/session/current
   */
  fastify.get('/current', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const logContext: LogContext = {
      userId: (request as AuthenticatedRequest).user?.userId,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      endpoint: 'GET /session/current',
    };

    try {
      const user = (request as AuthenticatedRequest).user;
      const authorization = request.headers.authorization;
      
      if (!authorization) {
        logger.warn('No authorization header provided', logContext);
        return reply.code(401).send({
          success: false,
          message: 'No authorization header',
        });
      }

      const currentToken = authorization.replace('Bearer ', '');
      const decoded = (fastify as any).jwt.decode(currentToken);

      if (!decoded || !decoded.jti) {
        logger.warn('Invalid token provided', logContext);
        return reply.code(401).send({
          success: false,
          message: 'Invalid token',
        });
      }

      logger.info('Getting current session info', logContext);

      // Get current session from database
      const sessionResult = await fastify.db.query(
        'SELECT * FROM user_sessions WHERE session_token = $1 AND user_id = $2',
        [decoded.jti, user.userId]
      );

      if (sessionResult.rows.length === 0) {
        logger.warn('Session not found in database', logContext);
        return reply.code(404).send({
          success: false,
          message: 'Session not found',
        });
      }

      const session = sessionResult.rows[0];
      const duration = Date.now() - startTime;

      logger.info('Current session retrieved successfully', {
        ...logContext,
        duration,
      });

      return reply.send({
        success: true,
        data: {
          session: {
            id: session.id,
            createdAt: session.created_at,
            updatedAt: session.updated_at,
            expiresAt: session.expires_at,
            ipAddress: session.ip_address,
            userAgent: session.user_agent,
            isActive: new Date(session.expires_at) > new Date(),
          },
          token: {
            issuedAt: new Date(decoded.iat * 1000),
            expiresAt: new Date(decoded.exp * 1000),
            tokenId: decoded.jti.substring(0, 8) + '...', // Mask for security
          },
        },
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to get current session', { 
        ...logContext,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
      
      return reply.code(500).send({
        success: false,
        message: 'Internal server error',
      });
    }
  });
}