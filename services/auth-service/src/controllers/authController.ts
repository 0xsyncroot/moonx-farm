import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createLogger, LogContext } from '@moonx-farm/common';
import { PrivyService, VerifyTokenResult } from '../services/privyService';
import { JwtService, TokenPair } from '../services/jwtService';
import { DatabaseService, User } from '../services/databaseService';
import { RedisService } from '../services/redisService';
import { authenticate } from '../middleware/authMiddleware';
import { 
  LoginRequestSchema, 
  LoginResponseSchema, 
  RefreshRequestSchema, 
  RefreshResponseSchema,
  VerifyResponseSchema,
  ErrorResponseSchema,
  SuccessResponseSchema
} from '../schemas';

interface AuthenticatedUser {
  userId: string;
  privyUserId: string;
  walletAddress: string;
  email?: string;
  tokenId: string;
}

const logger = createLogger('auth-controller');

interface LoginRequest {
  Body: {
    privyToken: string;
  };
}

interface RefreshRequest {
  Body: {
    refreshToken: string;
  };
}

interface AuthResponse {
  success: boolean;
  data?: {
    user: SafeUser;
    tokens: SafeTokenPair;
  };
  message?: string;
}

// Safe user interface - không expose sensitive data
interface SafeUser {
  id: string;
  privyId: string;
  walletAddress: string;
  aaWalletAddress: string;
  email?: string | undefined;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date | undefined;
}

// Safe token pair interface - không expose internal token IDs
interface SafeTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  expiresIn: number; // seconds until expiration
  tokenType: string;
}

export async function authRoutes(fastify: FastifyInstance) {
  // Initialize services từ Fastify context
  const privyService = new PrivyService(fastify.config);
  // Sử dụng jwtService đã được register
  const jwtService = fastify.jwtService;

  /**
   * Login with Privy access token
   * POST /api/v1/auth/login
   */
  fastify.post<LoginRequest>('/login', {
    schema: {
      tags: ['Authentication'],
      summary: 'Login with Privy token',
      description: 'Authenticate user using Privy token and return JWT tokens. Creates new user if first time login.',
      body: LoginRequestSchema,
      response: {
        200: LoginResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        429: ErrorResponseSchema,
        500: ErrorResponseSchema
      }
    },
    preHandler: [
      // Rate limiting for login attempts
      async (request: FastifyRequest, reply: FastifyReply) => {
        const ip = request.headers['x-real-ip'] || request.headers['x-forwarded-for'] || request.ip;
        const key = `auth_login_attempts:${ip}`;
        logger.info('Login attempt', { ip, key });
        try {
          const attempts = await fastify.redisService.incrementRateLimit(key, 900000, Number(fastify.config.get('REDIS_MAX_RETRIES_PER_REQUEST')) || 50);
          
          if (attempts.exceeded) {
            logger.warn('Too many login attempts', { ip, attempts: attempts.count });
            return reply.code(429).send({
              success: false,
              message: 'Too many login attempts. Please try again later.',
              retryAfter: 900
            });
          }
        } catch (error) {
          logger.error('Rate limiting error:', { error: error instanceof Error ? error.message : 'Unknown error' });
          // Continue without rate limiting if Redis fails
        }
      }
    ]
  }, async (request: FastifyRequest<LoginRequest>, reply: FastifyReply) => {
    const startTime = Date.now();
    const clientIp = request.ip;
    const userAgent = request.headers['user-agent'] || 'unknown';

    try {
      const { privyToken } = request.body;

      // Input validation
      if (!privyToken || typeof privyToken !== 'string') {
        logger.warn('Invalid login request', { ip: clientIp });
        return reply.code(400).send({
          success: false,
          message: 'Invalid request: privyToken is required',
        });
      }

      // Verify Privy token and get user data
      let privyResult: VerifyTokenResult;
      try {
        privyResult = await privyService.verifyToken(privyToken);
      } catch (error) {
        logger.warn('Privy token verification failed', { 
          ip: clientIp,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return reply.code(401).send({
          success: false,
          message: 'Invalid or expired Privy access token',
        });
      }

      // Social login không yêu cầu wallet address
      const walletAddress = privyResult.walletAddress;
      const aaWalletAddress = privyResult.aaWalletAddress;
      const email = privyResult.email;
      const socialProfile = privyResult.socialProfile;

      // Check if user exists in our database
      let user = await fastify.db.getUserByPrivyId(privyResult.userId);
      
      if (!user) {
        // Create new user
        try {
          user = await fastify.db.createUser({
            privyUserId: privyResult.userId,
            walletAddress: walletAddress || '', // Empty string nếu không có wallet
            aaWalletAddress: aaWalletAddress,
            ...(email && { email }),
          });
          
          logger.info('New user created', { 
            userId: user.id, 
            privyUserId: privyResult.userId,
            hasWallet: !!walletAddress,
            hasEmail: !!email,
            socialProvider: socialProfile?.provider,
            ip: clientIp
          });
        } catch (dbError) {
          logger.error('User creation failed', { 
            privyUserId: privyResult.userId,
            error: dbError instanceof Error ? dbError.message : 'Unknown error'
          });
          return reply.code(500).send({
            success: false,
            message: 'Account creation failed',
          });
        }
      } else {
        // Update existing user info if needed
        const updates: Partial<User> = {};
        
        if (email && user.email !== email) {
          updates.email = email;
        }
        
        if (walletAddress && user.wallet_address !== walletAddress) {
          updates.wallet_address = walletAddress;
        }
        
        if (aaWalletAddress && user.aa_wallet_address !== aaWalletAddress) {
          updates.aa_wallet_address = aaWalletAddress;
        }

        if (Object.keys(updates).length > 0) {
          try {
            user = await fastify.db.updateUser(user.id, updates);
            logger.info('User info updated', { userId: user.id, updates });
          } catch (updateError) {
            logger.warn('User update failed', { 
              userId: user.id, 
              error: updateError instanceof Error ? updateError.message : 'Unknown error'
            });
            // Continue with login even if update fails
          }
        }

        // Update last login
        try {
          await fastify.db.updateUserLastLogin(user.id);
        } catch (updateError) {
          logger.warn('Last login update failed', { 
            userId: user.id,
            error: updateError instanceof Error ? updateError.message : 'Unknown error'
          });
        }
        
        logger.info('User logged in', { 
          userId: user.id, 
          privyUserId: privyResult.userId,
          socialProvider: socialProfile?.provider,
          ip: clientIp
        });
      }

      // Create JWT tokens
      let tokens: TokenPair;
      try {
        tokens = await jwtService.createTokenPair({
          userId: user.id,
          privyUserId: user.privy_user_id,
          walletAddress: user.wallet_address,
          aaWalletAddress: user.aa_wallet_address,
          ...(user.email && { email: user.email }),
        }, {
          action: 'login',
          userId: user.id,
          ip: clientIp
        });
      } catch (tokenError) {
        logger.error('Token creation failed', { 
          userId: user.id,
          error: tokenError instanceof Error ? tokenError.message : 'Unknown error'
        });
        return reply.code(500).send({
          success: false,
          message: 'Authentication failed',
        });
      }

      // Store session in database
      try {
        await fastify.db.createSession({
          userId: user.id,
          sessionToken: tokens.accessTokenId,
          refreshToken: tokens.refreshTokenId,
          expiresAt: tokens.expiresAt,
          ipAddress: clientIp,
          userAgent: userAgent,
        });
      } catch (sessionError) {
        logger.error('Session creation failed', { 
          userId: user.id,
          error: sessionError instanceof Error ? sessionError.message : 'Unknown error'
        });
        // Continue without session storage
      }

      // Store refresh token in Redis
      try {
        const refreshTtl = Math.floor((tokens.refreshExpiresAt.getTime() - Date.now()) / 1000);
        await fastify.redisService.setRefreshToken(user.id, tokens.refreshTokenId, refreshTtl);
      } catch (redisError) {
        logger.error('Redis refresh token storage failed', { 
          userId: user.id,
          error: redisError instanceof Error ? redisError.message : 'Unknown error'
        });
        // Continue without Redis storage
      }

      // Cache user data in Redis (short TTL)
      try {
        await fastify.redisService.setUserCache(user.id, {
          id: user.id,
          privyUserId: user.privy_user_id,
          walletAddress: user.wallet_address,
          email: user.email,
          isActive: user.is_active,
        }, 300); // 5 minutes cache
      } catch (cacheError) {
        logger.warn('User cache failed', { 
          userId: user.id,
          error: cacheError instanceof Error ? cacheError.message : 'Unknown error'
        });
        // Continue without caching
      }

      // Clear rate limiting on successful login
      try {
        await fastify.redisService.del(`ratelimit:auth_login_attempts:${clientIp}`);
      } catch (error) {
        // Ignore rate limit clearing errors
      }

      // Prepare safe response
      const safeUser: SafeUser = {
        id: user.id,
        privyId: user.privy_user_id,
        walletAddress: user.wallet_address,
        aaWalletAddress: user.aa_wallet_address || '',
        email: user.email,
        isActive: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: user.last_login_at,
      };

      const safeTokens: SafeTokenPair = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        expiresIn: Math.floor((tokens.expiresAt.getTime() - Date.now()) / 1000),
        tokenType: 'Bearer',
      };

      const response: AuthResponse = {
        success: true,
        message: 'Login successful',
        data: {
          user: safeUser,
          tokens: safeTokens,
        },
      };

      // Log successful login
      const duration = Date.now() - startTime;
      logger.info('Login successful', { 
        userId: user.id,
        duration,
        ip: clientIp,
        socialProvider: socialProfile?.provider
      });

      return reply.send(response);

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorContext: LogContext = {
        action: 'login',
        duration,
        ip: clientIp,
        userAgent,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      logger.error('Login failed:', errorContext);

      return reply.code(500).send({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   */
  fastify.post<RefreshRequest>('/refresh', {
    schema: {
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { 
            type: 'string',
            minLength: 10,
            maxLength: 2000,
            pattern: '^[A-Za-z0-9._-]+$'
          },
        },
        additionalProperties: false
      },
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
                    walletAddress: { type: 'string' },
                    aaWalletAddress: { type: 'string' },
                    email: { type: 'string' },
                    isActive: { type: 'boolean' }
                  }
                },
                tokens: {
                  type: 'object',
                  properties: {
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' },
                    expiresAt: { type: 'string' },
                    expiresIn: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<RefreshRequest>, reply: FastifyReply) => {
    const startTime = Date.now();
    const clientIp = request.ip;

    try {
      const { refreshToken } = request.body;

      // Input validation
      if (!refreshToken || typeof refreshToken !== 'string') {
        logger.warn('Invalid refresh request', { ip: clientIp });
        return reply.code(400).send({
          success: false,
          message: 'Invalid request: refreshToken is required',
        });
      }

      // Verify refresh token
      let refreshPayload;
      try {
        refreshPayload = await jwtService.verifyToken(refreshToken, {
          action: 'refresh-token',
          ip: clientIp
        });
        
        if (refreshPayload.type !== 'refresh') {
          throw new Error('Invalid token type');
        }
      } catch (error) {
        logger.warn('Refresh token verification failed', { 
          ip: clientIp,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return reply.code(401).send({
          success: false,
          message: 'Invalid or expired refresh token',
        });
      }
      
      if (!refreshPayload.jti) {
        logger.warn('Refresh token missing jti', { ip: clientIp });
        return reply.code(401).send({
          success: false,
          message: 'Invalid refresh token format',
        });
      }

      // Check if refresh token exists in Redis
      let isValidRefreshToken: boolean;
      try {
        isValidRefreshToken = await fastify.redisService.isRefreshTokenValid(
          refreshPayload.userId, 
          refreshPayload.jti
        );
      } catch (redisError) {
        logger.error('Redis refresh token check failed', { 
          userId: refreshPayload.userId,
          error: redisError instanceof Error ? redisError.message : 'Unknown error'
        });
        return reply.code(500).send({
          success: false,
          message: 'Token validation failed',
        });
      }

      if (!isValidRefreshToken) {
        logger.warn('Refresh token not found in Redis', { 
          userId: refreshPayload.userId,
          tokenId: refreshPayload.jti,
          ip: clientIp
        });
        return reply.code(401).send({
          success: false,
          message: 'Refresh token not found or expired',
        });
      }

      // Get user data
      const user = await fastify.db.getUserById(refreshPayload.userId);
      if (!user || !user.is_active) {
        logger.warn('User not found or inactive during refresh', { 
          userId: refreshPayload.userId,
          ip: clientIp
        });
        return reply.code(401).send({
          success: false,
          message: 'User not found or account deactivated',
        });
      }

      // Create new access token
      let newTokenPair;
      try {
        newTokenPair = await jwtService.refreshAccessToken(refreshToken, {
          action: 'refresh-token',
          userId: refreshPayload.userId,
          ip: clientIp
        });
      } catch (tokenError) {
        logger.error('Access token refresh failed', { 
          userId: user.id,
          error: tokenError instanceof Error ? tokenError.message : 'Unknown error'
        });
        return reply.code(500).send({
          success: false,
          message: 'Token refresh failed',
        });
      }

      // Update session with new access token
      try {
        const session = await fastify.db.getSessionByRefreshToken(refreshPayload.jti);
        if (session) {
          await fastify.db.updateSessionToken(session.id, newTokenPair.accessTokenId, newTokenPair.expiresAt);
        }
      } catch (updateError) {
        logger.warn('Session update failed during refresh', {
          userId: user.id,
          error: updateError instanceof Error ? updateError.message : 'Unknown error'
        });
        // Continue without session update
      }

      // Prepare safe response
      const safeUser: SafeUser = {
        id: user.id,
        privyId: user.privy_user_id,
        walletAddress: user.wallet_address,
        aaWalletAddress: user.aa_wallet_address || '',
        email: user.email,
        isActive: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: user.last_login_at,
      };
      const safeTokens: SafeTokenPair = {
        accessToken: newTokenPair.accessToken,
        refreshToken: newTokenPair.refreshToken, // Use new refresh token
        expiresAt: newTokenPair.expiresAt,
        expiresIn: Math.floor((newTokenPair.expiresAt.getTime() - Date.now()) / 1000),
        tokenType: 'Bearer',
      };

      const response: AuthResponse = {
        success: true,
        data: {
          user: safeUser,
          tokens: safeTokens,
        },
      };

      const duration = Date.now() - startTime;
      logger.info('Token refresh successful', { 
        userId: user.id,
        duration,
        ip: clientIp
      });

      return reply.send(response);

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorContext: LogContext = {
        action: 'refresh-token',
        duration,
        ip: clientIp,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      logger.error('Token refresh failed:', errorContext);

      return reply.code(500).send({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  /**
   * Logout
   * POST /api/v1/auth/logout
   */
  fastify.post('/logout', {
    preHandler: [authenticate],
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
    const clientIp = request.ip;

    try {
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        return reply.code(401).send({
          success: false,
          message: 'Authorization header missing',
        });
      }

      const token = authHeader.replace('Bearer ', '');
      const tokenInfo = jwtService.getUserInfoFromToken(token);

      if (!tokenInfo || !tokenInfo.jti || !tokenInfo.userId) {
        logger.warn('Invalid token during logout', { ip: clientIp });
        return reply.code(401).send({
          success: false,
          message: 'Invalid token',
        });
      }

      // Extract values from tokenInfo
      const tokenId = tokenInfo.jti;
      const userId = tokenInfo.userId;

      // Get session to find refresh token ID
      const session = await fastify.db.getSessionByToken(tokenId);
      
      // Parallel logout operations
      const logoutPromises = [];

      // Blacklist the access token
      logoutPromises.push(
        fastify.redisService.blacklistToken(tokenId, 3600).catch((error) => {
          logger.warn('Token blacklisting failed', { tokenId, error });
        })
      );
      
      // Delete session from database
      logoutPromises.push(
        fastify.db.deleteSession(tokenId).catch((error) => {
          logger.warn('Session deletion failed', { tokenId, error });
        })
      );
      
      // Delete refresh token from Redis using correct refresh token ID
      if (session?.refresh_token) {
        logoutPromises.push(
          fastify.redisService.deleteRefreshToken(userId, session.refresh_token).catch((error) => {
            logger.warn('Refresh token deletion failed', { userId, refreshTokenId: session.refresh_token, error });
          })
        );
      }

      // Clear user cache
      logoutPromises.push(
        fastify.redisService.deleteUserCache(userId).catch((error) => {
          logger.warn('User cache deletion failed', { userId, error });
        })
      );

      // Wait for all logout operations
      await Promise.allSettled(logoutPromises);

      const duration = Date.now() - startTime;
      logger.info('User logged out', { 
        userId, 
        tokenId: tokenId.substring(0, 8) + '...',
        duration,
        ip: clientIp
      });

      return reply.send({
        success: true,
        message: 'Logged out successfully',
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorContext: LogContext = {
        action: 'logout',
        duration,
        ip: clientIp,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      logger.error('Logout failed:', errorContext);

      return reply.code(500).send({
        success: false,
        message: 'Logout failed',
      });
    }
  });

  /**
   * Verify token and get user info
   * GET /api/v1/auth/verify
   */
  fastify.get('/verify', {
    preHandler: [authenticate],
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
                    privyId: { type: 'string' },
                    walletAddress: { type: 'string' },
                    aaWalletAddress: { type: 'string' },
                    email: { type: 'string' },
                    isActive: { type: 'boolean' }
                  }
                },
                valid: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
              // User info is already validated by authenticate middleware
        const authenticatedUser = request.user as AuthenticatedUser;
      
      if (!authenticatedUser) {
        return reply.code(401).send({
          success: false,
          message: 'Authentication required',
        });
      }

      // Get fresh user data from database
      const user = await fastify.db.getUserById(authenticatedUser.userId);
      if (!user || !user.is_active) {
        return reply.code(401).send({
          success: false,
          message: 'User not found or account deactivated',
        });
      }
      const safeUser: SafeUser = {
        id: user.id,
        privyId: user.privy_user_id,
        walletAddress: user.wallet_address,
        aaWalletAddress: user.aa_wallet_address || '',
        email: user.email,
        isActive: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: user.last_login_at,
      };

      return reply.send({
        success: true,
        data: {
          user: safeUser,
          valid: true,
        },
      });

    } catch (error) {
              const errorContext: LogContext = {
          action: 'verify-token',
          error: error instanceof Error ? error.message : 'Unknown error',
          ...(request.user && { userId: (request.user as AuthenticatedUser).userId })
        };
      logger.error('Token verification failed:', errorContext);

      return reply.code(500).send({
        success: false,
        message: 'Token verification failed',
      });
    }
  });
}