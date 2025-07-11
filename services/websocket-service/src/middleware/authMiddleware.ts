import { FastifyRequest } from 'fastify';
import axios, { AxiosError } from 'axios';
import { createLogger } from '@moonx-farm/common';
import { websocketConfig } from '../config';
import { AuthResult } from '../types';

const logger = createLogger('auth-middleware');

export class AuthService {
  private readonly authServiceUrl: string;
  private readonly verifyEndpoint: string;
  private readonly timeout: number;

  constructor() {
    this.authServiceUrl = websocketConfig.auth.serviceUrl;
    this.verifyEndpoint = websocketConfig.auth.verifyEndpoint;
    this.timeout = websocketConfig.auth.timeout;
  }

  /**
   * Verify JWT token with Auth Service
   * @param token JWT token from client
   * @returns AuthResult with user information
   */
  async verifyToken(token: string): Promise<AuthResult> {
    try {
      const response = await axios.get(
        `${this.authServiceUrl}${this.verifyEndpoint}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: this.timeout
        }
      );

      const data = response.data as any;
      
      // Handle nested response structure from auth service
      const userData = data?.data?.user || data?.user;
      
      // Validate response structure
      if (!userData?.id || !userData?.walletAddress) {
        logger.error('Invalid response from auth service', { 
          data,
          userData,
          hasNestedData: !!data?.data,
          hasDirectUser: !!data?.user
        });
        return {
          success: false,
          error: 'Invalid authentication response'
        };
      }

      logger.info('Token verified successfully', {
        userId: userData.id,
        userAddress: userData.walletAddress
      });

      return {
        success: true,
        userId: userData.id,
        userAddress: userData.walletAddress
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Auth service error', { 
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (axiosError.code === 'ECONNABORTED') {
          return {
            success: false,
            error: 'Authentication timeout'
          };
        }
        
        if (axiosError.response?.status === 401) {
          logger.warn('Token verification failed', {
            status: axiosError.response.status,
            statusText: axiosError.response.statusText,
            data: axiosError.response.data
          });
          
          return {
            success: false,
            error: 'Invalid token'
          };
        }
        
        return {
          success: false,
          error: `Authentication service error: ${axiosError.response?.status || 'unknown'}`
        };
      }
      
      return {
        success: false,
        error: `Unknown authentication error: ${errorMessage}`
      };
    }
  }

  /**
   * Extract token from WebSocket request
   * @param request Fastify request object
   * @returns JWT token or null if not found
   */
  extractToken(request: FastifyRequest): string | null {
    // Try to get token from query parameters
    const query = request.query as { token?: string };
    if (query.token) {
      return query.token;
    }

    // Try to get token from headers
    const authHeader = request.headers.authorization ?? null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try to get token from cookies
    const cookies = request.headers.cookie ?? null;
    if (cookies) {
      const tokenMatch = cookies.match(/token=([^;]+)/);
      if (tokenMatch && tokenMatch[1]) {
        return tokenMatch[1];
      }
    }

    return null;
  }

  /**
   * Authenticate WebSocket connection
   * @param request Fastify request object
   * @returns AuthResult with user information
   */
  async authenticate(request: FastifyRequest): Promise<AuthResult> {
    const token = this.extractToken(request);
    
    if (!token) {
      logger.warn('No token provided in WebSocket connection', {
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });
      
      return {
        success: false,
        error: 'Authentication token required'
      };
    }

    return await this.verifyToken(token);
  }

  /**
   * Health check for auth service
   */
  async checkAuthServiceHealth(): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.authServiceUrl}/health`,
        {
          timeout: 5000
        }
      );

      return response.status === 200;
    } catch (error) {
      logger.error('Auth service health check failed', { error });
      return false;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();

/**
 * Authentication middleware for WebSocket routes
 */
export async function authMiddleware(request: FastifyRequest): Promise<AuthResult> {
  const startTime = Date.now();
  
  try {
    const result = await authService.authenticate(request);
    
    const duration = Date.now() - startTime;
    
    if (result.success) {
      logger.info('WebSocket authentication successful', {
        userId: result.userId,
        userAddress: result.userAddress,
        duration,
        ip: request.ip
      });
    } else {
      logger.warn('WebSocket authentication failed', {
        error: result.error,
        duration,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });
    }
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Authentication middleware error', { 
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    return {
      success: false,
      error: `Authentication middleware error: ${errorMessage}`
    };
  }
} 