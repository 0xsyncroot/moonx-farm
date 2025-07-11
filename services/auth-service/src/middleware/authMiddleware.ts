import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { createLogger, LogContext } from '@moonx-farm/common';

const logger = createLogger('auth-middleware');

interface AuthenticatedUser {
  userId: string;
  privyUserId: string;
  walletAddress?: string; // Optional for social login
  aaWalletAddress?: string; // AA wallet address
  email?: string;
  tokenId: string;
}

// Cache for blacklisted tokens to reduce Redis calls
const blacklistCache = new Map<string, boolean>();
const BLACKLIST_CACHE_TTL = 60000; // 1 minute

// Rate limiting cache for failed auth attempts
const authAttemptCache = new Map<string, { count: number; resetTime: number }>();
const MAX_AUTH_ATTEMPTS = 10;
const AUTH_ATTEMPT_WINDOW = 300000; // 5 minutes

/**
 * Clean up expired cache entries
 */
function cleanupCaches() {
  const now = Date.now();
  
  // Clean blacklist cache (simple TTL)
  if (blacklistCache.size > 1000) {
    blacklistCache.clear();
  }
  
  // Clean auth attempt cache
  const cacheEntries = Array.from(authAttemptCache.entries());
  for (const [key, value] of cacheEntries) {
    if (now > value.resetTime) {
      authAttemptCache.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupCaches, 300000);

/**
 * Check if IP has too many failed auth attempts
 */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const key = `auth_fail:${ip}`;
  const attempt = authAttemptCache.get(key);
  
  if (!attempt) {
    return false;
  }
  
  if (now > attempt.resetTime) {
    authAttemptCache.delete(key);
    return false;
  }
  
  return attempt.count >= MAX_AUTH_ATTEMPTS;
}

/**
 * Record failed auth attempt
 */
function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const key = `auth_fail:${ip}`;
  const attempt = authAttemptCache.get(key);
  
  if (!attempt || now > attempt.resetTime) {
    authAttemptCache.set(key, {
      count: 1,
      resetTime: now + AUTH_ATTEMPT_WINDOW
    });
  } else {
    attempt.count++;
  }
}

/**
 * Clear failed attempts on successful auth
 */
function clearFailedAttempts(ip: string): void {
  const key = `auth_fail:${ip}`;
  authAttemptCache.delete(key);
}

/**
 * Check if token is blacklisted with caching
 */
async function isTokenBlacklisted(redisService: any, tokenId: string): Promise<boolean> {
  // Check cache first
  if (blacklistCache.has(tokenId)) {
    return blacklistCache.get(tokenId)!;
  }
  
  try {
    const isBlacklisted = await redisService.isTokenBlacklisted(tokenId);
    
    // Cache the result
    blacklistCache.set(tokenId, isBlacklisted);
    
    // Remove from cache after TTL
    setTimeout(() => {
      blacklistCache.delete(tokenId);
    }, BLACKLIST_CACHE_TTL);
    
    return isBlacklisted;
  } catch (error) {
    logger.warn('Failed to check token blacklist', { 
      tokenId: tokenId.substring(0, 8) + '...',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false; // Fail open for Redis errors
  }
}

/**
 * Authentication middleware
 * Validates JWT tokens and sets user context
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
) {
  const startTime = Date.now();
  const clientIp = request.ip;
  const userAgent = request.headers['user-agent'] || 'unknown';

  try {
    // Skip authentication for public routes
    const publicRoutes = [
      '/health',
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/docs',
      '/docs/static',
      '/favicon.ico'
    ];

    const isPublicRoute = publicRoutes.some(route => 
      request.url === route ||
      request.url?.startsWith(route)
    );

    if (isPublicRoute) {
      return done();
    }

    // Check rate limiting for failed attempts
    if (isRateLimited(clientIp)) {
      const logContext: LogContext = {
        ip: clientIp,
        userAgent,
        endpoint: request.url,
        action: 'auth-rate-limited'
      };
      
      logger.warn('Authentication rate limited', logContext);
      
      return reply.code(429).send({
        success: false,
        message: 'Too many failed authentication attempts. Please try again later.',
        code: 'AUTH_RATE_LIMITED',
        retryAfter: 300
      });
    }

    // Get authorization header
    const authorization = request.headers.authorization;
    
    if (!authorization) {
      recordFailedAttempt(clientIp);
      
      const logContext: LogContext = {
        ip: clientIp,
        userAgent,
        endpoint: request.url,
        action: 'missing-auth-header'
      };
      
      logger.warn('Missing authorization header', logContext);
      
      return reply.code(401).send({
        success: false,
        message: 'Authorization header required',
        code: 'MISSING_AUTH_HEADER',
      });
    }

    // Extract token
    const token = authorization.startsWith('Bearer ') 
      ? authorization.slice(7) 
      : authorization;

    if (!token || token.length < 10) {
      recordFailedAttempt(clientIp);
      
      const logContext: LogContext = {
        ip: clientIp,
        userAgent,
        endpoint: request.url,
        action: 'invalid-auth-format'
      };
      
      logger.warn('Invalid authorization format', logContext);
      
      return reply.code(401).send({
        success: false,
        message: 'Invalid authorization format',
        code: 'INVALID_AUTH_FORMAT',
      });
    }

    try {
      // Verify JWT token
      const decoded = await request.server.jwt.verify(token);
      
      if (!decoded || typeof decoded !== 'object') {
        throw new Error('Invalid token payload');
      }

      const { userId, privyUserId, walletAddress, aaWalletAddress, email, jti, type } = decoded as any;

      // Validate required fields
      if (!userId || !privyUserId || !jti) {
        throw new Error('Missing required token fields');
      }

      // Check token type
      if (type !== 'access') {
        recordFailedAttempt(clientIp);
        
        const logContext: LogContext = {
          ip: clientIp,
          userAgent,
          endpoint: request.url,
          action: 'invalid-token-type',
          tokenType: type
        };
        
        logger.warn('Invalid token type', logContext);
        
        return reply.code(401).send({
          success: false,
          message: 'Invalid token type',
          code: 'INVALID_TOKEN_TYPE',
        });
      }

      // Check if token is blacklisted
      const isBlacklisted = await isTokenBlacklisted(request.server.redisService, jti);
      if (isBlacklisted) {
        recordFailedAttempt(clientIp);
        
        const logContext: LogContext = {
          ip: clientIp,
          userAgent,
          endpoint: request.url,
          action: 'token-blacklisted',
          tokenId: jti.substring(0, 8) + '...'
        };
        
        logger.warn('Blacklisted token used', logContext);
        
        return reply.code(401).send({
          success: false,
          message: 'Token has been revoked',
          code: 'TOKEN_REVOKED',
        });
      }

      // Check if user exists and is active
      const user = await request.server.db.getUserById(userId);
      if (!user || !user.is_active) {
        recordFailedAttempt(clientIp);
        
        const logContext: LogContext = {
          ip: clientIp,
          userAgent,
          endpoint: request.url,
          action: 'user-not-found',
          userId
        };
        
        logger.warn('User not found or inactive', logContext);
        
        return reply.code(401).send({
          success: false,
          message: 'User not found or inactive',
          code: 'USER_NOT_FOUND',
        });
      }

      // Set user context on request
      (request as any).user = {
        userId,
        privyUserId,
        walletAddress,
        aaWalletAddress,
        email,
        tokenId: jti,
      };

      // Clear failed attempts on successful auth
      clearFailedAttempts(clientIp);

      const duration = Date.now() - startTime;
      logger.debug('User authenticated successfully', { 
        userId, 
        walletAddress: walletAddress ? walletAddress.substring(0, 8) + '...' : 'none',
        tokenId: jti.substring(0, 8) + '...',
        duration,
        ip: clientIp
      });

      return done();

    } catch (jwtError) {
      recordFailedAttempt(clientIp);
      
      const duration = Date.now() - startTime;
      const logContext: LogContext = {
        ip: clientIp,
        userAgent,
        endpoint: request.url,
        action: 'jwt-verification-failed',
        error: jwtError instanceof Error ? jwtError.message : 'Unknown error',
        duration
      };
      
      logger.warn('JWT verification failed', logContext);

      return reply.code(401).send({
        success: false,
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    const logContext: LogContext = {
      ip: clientIp,
      userAgent,
      endpoint: request.url,
      action: 'auth-middleware-error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration
    };
    
    logger.error('Auth middleware error', logContext);
    
    return reply.code(500).send({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Create authenticate preHandler for specific routes
 * This is a simplified version for use in route preHandlers
 */
export const authenticate = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const startTime = Date.now();
  const clientIp = request.ip;
  const userAgent = request.headers['user-agent'] || 'unknown';

  // Check rate limiting
  if (isRateLimited(clientIp)) {
    logger.warn('Authentication rate limited in preHandler', {
      ip: clientIp,
      endpoint: request.url
    });
    
    return reply.code(429).send({
      success: false,
      message: 'Too many failed authentication attempts. Please try again later.',
      code: 'AUTH_RATE_LIMITED',
      retryAfter: 300
    });
  }

  const authorization = request.headers.authorization;
  
  if (!authorization) {
    recordFailedAttempt(clientIp);
    return reply.code(401).send({
      success: false,
      message: 'Authorization header required',
      code: 'MISSING_AUTH_HEADER',
    });
  }

  const token = authorization.startsWith('Bearer ') 
    ? authorization.slice(7) 
    : authorization;

  if (!token || token.length < 10) {
    recordFailedAttempt(clientIp);
    return reply.code(401).send({
      success: false,
      message: 'Invalid authorization format',
      code: 'INVALID_AUTH_FORMAT',
    });
  }

  try {
    const decoded = await request.server.jwt.verify(token);
    
    if (!decoded || typeof decoded !== 'object') {
      throw new Error('Invalid token payload');
    }

    const { userId, privyUserId, walletAddress, aaWalletAddress, email, jti, type } = decoded as any;

    if (!userId || !privyUserId || !jti) {
      throw new Error('Missing required token fields');
    }

    if (type !== 'access') {
      recordFailedAttempt(clientIp);
      return reply.code(401).send({
        success: false,
        message: 'Invalid token type',
        code: 'INVALID_TOKEN_TYPE',
      });
    }

    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(request.server.redisService, jti);
    if (isBlacklisted) {
      recordFailedAttempt(clientIp);
      return reply.code(401).send({
        success: false,
        message: 'Token has been revoked',
        code: 'TOKEN_REVOKED',
      });
    }

    // Check if user exists and is active
    const user = await request.server.db.getUserById(userId);
    if (!user || !user.is_active) {
      recordFailedAttempt(clientIp);
      return reply.code(401).send({
        success: false,
        message: 'User not found or inactive',
        code: 'USER_NOT_FOUND',
      });
    }

    // Set user context
    (request as any).user = {
      userId,
      privyUserId,
      walletAddress,
      aaWalletAddress,
      email,
      tokenId: jti,
    };

    // Clear failed attempts on successful auth
    clearFailedAttempts(clientIp);

    const duration = Date.now() - startTime;
    logger.debug('PreHandler authentication successful', {
      userId,
      duration,
      ip: clientIp
    });

  } catch (error) {
    recordFailedAttempt(clientIp);
    
    const duration = Date.now() - startTime;
    logger.warn('PreHandler authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: clientIp,
      userAgent,
      duration
    });

    return reply.code(401).send({
      success: false,
      message: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
    });
  }
};