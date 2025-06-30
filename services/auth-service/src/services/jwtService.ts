import { FastifyInstance } from 'fastify';
import { createLogger, LogContext } from '@moonx-farm/common';
import { randomBytes } from 'crypto';

const logger = createLogger('jwt-service');

export interface TokenPayload {
  userId: string;
  privyUserId: string;
  walletAddress?: string; // Optional cho social login
  email?: string;
  iat?: number;
  exp?: number;
  jti?: string;
  type?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenId: string;
  refreshTokenId: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
}

interface JwtConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
  jwtIssuer: string;
  jwtAudience: string;
}

export class JwtService {
  private fastify: FastifyInstance;
  private config: JwtConfig;

  constructor(fastify: FastifyInstance, config: JwtConfig) {
    this.fastify = fastify;
    this.config = config;
  }

  /**
   * Generate unique token ID for dApp context
   */
  private generateTokenId(): string {
    const timestamp = Date.now();
    const randomHex = randomBytes(8).toString('hex');
    return `dapp_${timestamp}_${randomHex}`;
  }

  /**
   * Check if token is a dApp token based on jti format
   */
  isDAppToken(token: string): boolean {
    try {
      const decoded = this.fastify.jwt.decode(token) as any;
      return decoded?.jti?.startsWith('dapp_') || false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create token pair (access + refresh) for dApp users
   */
  async createTokenPair(payload: TokenPayload, context: LogContext): Promise<TokenPair> {
    const logContext = { ...context, userId: payload.userId };
    logger.info('Creating token pair', logContext);

    try {
      const accessTokenId = this.generateTokenId();
      const refreshTokenId = this.generateTokenId();

      // Access token configuration
      const accessTokenExpiresIn = this.config.jwtExpiresIn;
      const accessTokenExpiration = this.calculateExpiration(accessTokenExpiresIn);

      // Refresh token configuration  
      const refreshTokenExpiresIn = this.config.jwtRefreshExpiresIn;
      const refreshTokenExpiration = this.calculateExpiration(refreshTokenExpiresIn);

      // Access token payload
      const accessTokenPayload = {
        ...payload,
        jti: accessTokenId,
        type: 'access',
        iss: this.config.jwtIssuer,
        aud: this.config.jwtAudience,
      };

      // Refresh token payload (có thể có ít thông tin hơn)
      const refreshTokenPayload = {
        userId: payload.userId,
        privyUserId: payload.privyUserId,
        jti: refreshTokenId,
        type: 'refresh',
        iss: this.config.jwtIssuer,
        aud: this.config.jwtAudience,
      };

      // Generate tokens
      const accessToken = this.fastify.jwt.sign(accessTokenPayload, {
        expiresIn: accessTokenExpiresIn,
      });

      const refreshToken = this.fastify.jwt.sign(refreshTokenPayload, {
        expiresIn: refreshTokenExpiresIn,
      });

      logger.info('Token pair created successfully', {
        ...logContext,
        accessTokenId,
        refreshTokenId,
        accessTokenExpiresIn,
        refreshTokenExpiresIn,
      });

      return {
        accessToken,
        refreshToken,
        accessTokenId,
        refreshTokenId,
        expiresAt: accessTokenExpiration,
        refreshExpiresAt: refreshTokenExpiration,
      };
    } catch (error) {
      logger.error('Failed to create token pair', { ...logContext, error });
      throw new Error('Failed to create authentication tokens');
    }
  }

  /**
   * Verify and decode token
   */
  async verifyToken(token: string, context: LogContext): Promise<TokenPayload> {
    logger.debug('Verifying token', context);

    try {
      const decoded = this.fastify.jwt.verify(token) as TokenPayload;
      
      logger.debug('Token verified successfully', {
        ...context,
        userId: decoded.userId,
        tokenType: decoded.type,
        jti: decoded.jti,
      });

      return decoded;
    } catch (error) {
      logger.warn('Token verification failed', { ...context, error });
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string, context: LogContext): Promise<TokenPair> {
    logger.info('Refreshing access token', context);

    try {
      // Verify refresh token
      const decoded = await this.verifyToken(refreshToken, context);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type for refresh');
      }

      // Create new token pair - explicitly handle optional properties
      const newTokenPayload: TokenPayload = {
        userId: decoded.userId,
        privyUserId: decoded.privyUserId,
        ...(decoded.walletAddress && { walletAddress: decoded.walletAddress }),
        ...(decoded.email && { email: decoded.email }),
      };

      const newTokenPair = await this.createTokenPair(newTokenPayload, context);

      logger.info('Access token refreshed successfully', {
        ...context,
        userId: decoded.userId,
        oldRefreshTokenId: decoded.jti,
        newAccessTokenId: newTokenPair.accessTokenId,
      });

      return newTokenPair;
    } catch (error) {
      logger.error('Failed to refresh access token', { ...context, error });
      throw new Error('Failed to refresh token');
    }
  }

  /**
   * Get user info from token without verification (decode only)
   */
  getUserInfoFromToken(token: string): TokenPayload | null {
    try {
      const decoded = this.fastify.jwt.decode(token) as TokenPayload;
      return decoded;
    } catch (error) {
      logger.warn('Failed to decode token', { error });
      return null;
    }
  }

  /**
   * Calculate expiration date from time string
   */
  private calculateExpiration(timeStr: string): Date {
    const now = new Date();
    const matches = timeStr.match(/^(\d+)([smhd])$/);
    
    if (!matches || matches.length < 3) {
      // Default to 1 hour if parsing fails
      return new Date(now.getTime() + 60 * 60 * 1000);
    }

    const value = matches[1];
    const unit = matches[2];
    
    if (!value || !unit) {
      return new Date(now.getTime() + 60 * 60 * 1000);
    }
    
    const num = parseInt(value, 10);

    switch (unit) {
      case 's': // seconds
        return new Date(now.getTime() + num * 1000);
      case 'm': // minutes
        return new Date(now.getTime() + num * 60 * 1000);
      case 'h': // hours
        return new Date(now.getTime() + num * 60 * 60 * 1000);
      case 'd': // days
        return new Date(now.getTime() + num * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 60 * 60 * 1000); // default 1 hour
    }
  }
}