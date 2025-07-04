import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { logger } from '@moonx-farm/common';
import { AuthService } from '../services/authService';

interface SocketMiddlewareConfig {
  authService: AuthService;
}

export class SocketMiddleware {
  private authService: AuthService;

  constructor(config: SocketMiddlewareConfig) {
    this.authService = config.authService;
  }

  // Authentication middleware - ONLY ESSENTIAL AUTH
  async authenticate(socket: Socket, next: (err?: ExtendedError) => void): Promise<void> {
    try {
      const token = this.extractToken(socket);
      
      if (!token) {
        logger.warn('Authentication failed: No token provided', {
          socketId: socket.id,
          ip: socket.handshake.address
        });
        return next(new Error('Authentication token required'));
      }

      // Validate token with auth service
      const user = await this.authService.validateToken(token);
      
      if (!user) {
        logger.warn('Authentication failed: Invalid token', {
          socketId: socket.id,
          ip: socket.handshake.address,
          token: token.substring(0, 20) + '...'
        });
        return next(new Error('Invalid authentication token'));
      }

      if (!user.isActive) {
        logger.warn('Authentication failed: User account deactivated', {
          socketId: socket.id,
          userId: user.id
        });
        return next(new Error('Account deactivated'));
      }

      // Attach user info to socket
      socket.userId = user.id;
      socket.user = user;
      
      logger.debug('Socket authentication successful', {
        socketId: socket.id,
        userId: user.id,
        walletAddress: user.walletAddress.substring(0, 8) + '...'
      });

      next();
    } catch (error) {
      logger.error('Authentication middleware error:', { error: error instanceof Error ? error.message : String(error) });
      next(new Error('Authentication service error'));
    }
  }

  // NO RATE LIMITING - WebSocket doesn't need it for DEX
  async rateLimit(socket: Socket, next: (err?: ExtendedError) => void): Promise<void> {
    // Completely disabled - DEX needs unrestricted real-time access
    next();
  }

  // NO CONNECTION VALIDATION - Maximum performance
  async validateConnection(socket: Socket, next: (err?: ExtendedError) => void): Promise<void> {
    // Completely disabled - let users connect as much as they need
    next();
  }

  // Extract token from socket handshake
  private extractToken(socket: Socket): string | null {
    // Try auth header first
    const authHeader = socket.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try auth query parameter
    const authQuery = socket.handshake.auth?.['token'];
    if (authQuery) {
      return authQuery;
    }

    // Try query string
    const tokenQuery = socket.handshake.query?.['token'];
    if (typeof tokenQuery === 'string') {
      return tokenQuery;
    }

    return null;
  }
} 