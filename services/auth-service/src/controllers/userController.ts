import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createLogger, LogContext } from '@moonx/common';
import { PrivyService } from '../services/privyService';
import { authenticate } from '../middleware/authMiddleware';

const logger = createLogger('user-controller');

// Safe interfaces - chỉ expose thông tin cần thiết
interface SafeUserProfile {
  id: string;
  email?: string | undefined;
  hasWallet: boolean;
  hasSocialAccount: boolean;
  primarySocialProvider?: string | undefined;
  createdAt: Date;
  lastLoginAt?: Date | undefined;
  isActive: boolean;
}

interface UpdateProfileRequest {
  Body: {
    email?: string;
  };
}

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    userId: string;
    privyUserId: string;
    walletAddress?: string;
    email?: string;
  };
}

// Validation schemas
const updateProfileSchema = {
  body: {
    type: 'object',
    properties: {
      email: { 
        type: 'string', 
        format: 'email',
        maxLength: 255,
        nullable: true,
      },
    },
    additionalProperties: false,
  },
};

export async function userRoutes(fastify: FastifyInstance) {
  const privyService = new PrivyService(fastify.config);

  /**
   * Get user profile (minimal safe information only)
   * GET /api/v1/user/profile
   */
  fastify.get('/profile', {
    preHandler: [
      authenticate,
      // Rate limiting
      async (request: FastifyRequest, reply: FastifyReply) => {
        const userId = (request as AuthenticatedRequest).user?.userId;
        const key = `user_profile:${userId}`;
        
        try {
          const attempts = await fastify.redisService.incrementRateLimit(key, 60000, 30);
          
          if (attempts.exceeded) {
            logger.warn('Profile access rate limit exceeded', { userId, attempts: attempts.count });
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
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    hasWallet: { type: 'boolean' },
                    hasSocialAccount: { type: 'boolean' },
                    primarySocialProvider: { type: 'string' },
                    createdAt: { type: 'string' },
                    lastLoginAt: { type: 'string' },
                    isActive: { type: 'boolean' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const logContext: LogContext = {
      userId: (request as AuthenticatedRequest).user?.userId,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      endpoint: 'GET /user/profile',
    };

    try {
      const user = (request as AuthenticatedRequest).user;

      // Get user from database
      const dbUser = await fastify.db.getUserById(user.userId);
      
      if (!dbUser) {
        logger.warn('User not found in database', logContext);
        return reply.code(404).send({
          success: false,
          message: 'User not found',
        });
      }

      // Get minimal Privy data for social provider info
      let primarySocialProvider: string | undefined;
      let hasSocialAccount = false;

      try {
        const privyUser = await privyService.getUserById(dbUser.privy_user_id);
        const socialProfile = privyService.getPrimarySocialProfile(privyUser);
        
        if (socialProfile) {
          hasSocialAccount = true;
          primarySocialProvider = socialProfile.type.replace('_oauth', '');
        }
      } catch (privyError) {
        logger.warn('Failed to get Privy social data', {
          ...logContext,
          error: privyError instanceof Error ? privyError.message : 'Unknown error'
        });
        // Continue without social data
      }

      // Prepare safe response - chỉ thông tin cần thiết
      const safeProfile: SafeUserProfile = {
        id: dbUser.id,
        email: dbUser.email,
        hasWallet: !!dbUser.wallet_address,
        hasSocialAccount,
        primarySocialProvider,
        createdAt: dbUser.created_at,
        lastLoginAt: dbUser.last_login_at,
        isActive: dbUser.is_active,
      };

      const duration = Date.now() - startTime;
      logger.info('User profile retrieved', {
        ...logContext,
        duration,
      });

      return reply.send({
        success: true,
        data: {
          user: safeProfile,
        },
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to get user profile', { 
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
   * Update user profile (chỉ cho phép update email)
   * PUT /api/v1/user/profile
   */
  fastify.put<UpdateProfileRequest>('/profile', {
    preHandler: [
      authenticate,
      // Rate limiting for updates (stricter)
      async (request: FastifyRequest, reply: FastifyReply) => {
        const userId = (request as AuthenticatedRequest).user?.userId;
        const key = `user_update:${userId}`;
        
        try {
          const attempts = await fastify.redisService.incrementRateLimit(key, 300000, 5);
          
          if (attempts.exceeded) {
            logger.warn('Profile update rate limit exceeded', { userId, attempts: attempts.count });
            return reply.code(429).send({
              success: false,
              message: 'Too many update requests. Please try again later.',
            });
          }
        } catch (error) {
          // Continue without rate limiting if Redis fails
        }
      }
    ],
    schema: updateProfileSchema,
  }, async (request: FastifyRequest<UpdateProfileRequest>, reply: FastifyReply) => {
    const startTime = Date.now();
    const logContext: LogContext = {
      userId: (request as AuthenticatedRequest).user?.userId,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      endpoint: 'PUT /user/profile',
    };

    try {
      const user = (request as AuthenticatedRequest).user;
      const { email } = request.body;

      // Validate email if provided
      if (email && !privyService.isValidEmail(email)) {
        logger.warn('Invalid email format provided', logContext);
        return reply.code(400).send({
          success: false,
          message: 'Invalid email format',
        });
      }

      // Prepare updates - chỉ cho phép update email
      const updates: any = {};
      if (email !== undefined) {
        updates.email = email;
      }

      if (Object.keys(updates).length === 0) {
        return reply.code(400).send({
          success: false,
          message: 'No valid fields to update',
        });
      }

      // Update user in database
      const updatedUser = await fastify.db.updateUser(user.userId, updates);

      // Clear user cache
      try {
        await fastify.redisService.deleteUserCache(user.userId);
      } catch (cacheError) {
        logger.warn('Failed to clear user cache', {
          ...logContext,
          error: cacheError instanceof Error ? cacheError.message : 'Unknown error'
        });
      }

      const duration = Date.now() - startTime;
      logger.info('User profile updated', { 
        ...logContext,
        updatedFields: Object.keys(updates),
        duration,
      });

      // Return safe user data
      const safeProfile: SafeUserProfile = {
        id: updatedUser.id,
        email: updatedUser.email,
        hasWallet: !!updatedUser.wallet_address,
        hasSocialAccount: false, // Will be updated by separate call if needed
        createdAt: updatedUser.created_at,
        lastLoginAt: updatedUser.last_login_at,
        isActive: updatedUser.is_active,
      };

      return reply.send({
        success: true,
        data: {
          user: safeProfile,
        },
        message: 'Profile updated successfully',
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to update user profile', { 
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
   * Get user statistics (minimal safe stats only)
   * GET /api/v1/user/stats
   */
  fastify.get('/stats', {
    preHandler: [
      authenticate,
      // Rate limiting
      async (request: FastifyRequest, reply: FastifyReply) => {
        const userId = (request as AuthenticatedRequest).user?.userId;
        const key = `user_stats:${userId}`;
        
        try {
          const attempts = await fastify.redisService.incrementRateLimit(key, 300000, 10);
          
          if (attempts.exceeded) {
            logger.warn('Stats access rate limit exceeded', { userId, attempts: attempts.count });
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
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                stats: {
                  type: 'object',
                  properties: {
                    activeSessions: { type: 'number' },
                    accountAge: { type: 'number' },
                    lastLogin: { type: 'string' },
                    isActive: { type: 'boolean' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const logContext: LogContext = {
      userId: (request as AuthenticatedRequest).user?.userId,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      endpoint: 'GET /user/stats',
    };

    try {
      const user = (request as AuthenticatedRequest).user;

      // Parallel queries for better performance
      const [activeSessionCountResult, dbUser] = await Promise.all([
        fastify.db.query(
          'SELECT COUNT(*) as total FROM user_sessions WHERE user_id = $1 AND expires_at > NOW()',
          [user.userId]
        ),
        fastify.db.getUserById(user.userId)
      ]);

      const activeSessionCount = parseInt(activeSessionCountResult.rows[0].total);

      if (!dbUser) {
        logger.warn('User not found for stats', logContext);
        return reply.code(404).send({
          success: false,
          message: 'User not found',
        });
      }

      const duration = Date.now() - startTime;
      logger.info('User stats retrieved', {
        ...logContext,
        duration,
      });

      return reply.send({
        success: true,
        data: {
          stats: {
            activeSessions: activeSessionCount,
            accountAge: Math.floor((Date.now() - new Date(dbUser.created_at).getTime()) / (1000 * 60 * 60 * 24)),
            lastLogin: dbUser.last_login_at,
            isActive: dbUser.is_active,
          },
        },
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to get user stats', { 
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
   * Deactivate user account (soft delete)
   * POST /api/v1/user/deactivate
   */
  fastify.post('/deactivate', {
    preHandler: [
      authenticate,
      // Rate limiting (very strict)
      async (request: FastifyRequest, reply: FastifyReply) => {
        const userId = (request as AuthenticatedRequest).user?.userId;
        const key = `user_deactivate:${userId}`;
        
        try {
          const attempts = await fastify.redisService.incrementRateLimit(key, 86400000, 1);
          
          if (attempts.exceeded) {
            logger.warn('Account deactivation rate limit exceeded', { userId, attempts: attempts.count });
            return reply.code(429).send({
              success: false,
              message: 'Account deactivation attempted too recently. Please contact support.',
            });
          }
        } catch (error) {
          // Continue without rate limiting if Redis fails
        }
      }
    ],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const logContext: LogContext = {
      userId: (request as AuthenticatedRequest).user?.userId,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      endpoint: 'POST /user/deactivate',
    };

    try {
      const user = (request as AuthenticatedRequest).user;

      logger.warn('User account deactivation requested', logContext);

      // Parallel deactivation operations
      const operations = [
        // Soft delete user (set is_active to false)
        fastify.db.updateUser(user.userId, { is_active: false }),
        // Delete all user sessions
        fastify.db.deleteAllUserSessions(user.userId),
        // Delete all refresh tokens from Redis
        fastify.redisService.deleteAllRefreshTokens(user.userId),
        // Clear user cache
        fastify.redisService.deleteUserCache(user.userId)
      ];

      await Promise.all(operations);

      const duration = Date.now() - startTime;
      logger.info('User account deactivated successfully', { 
        ...logContext,
        duration,
      });

      return reply.send({
        success: true,
        message: 'Account deactivated successfully',
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to deactivate user account', { 
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