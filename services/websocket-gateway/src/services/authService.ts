import axios, { AxiosError } from 'axios';
import { logger } from '@moonx-farm/common';

interface AuthUser {
  id: string;
  privyId: string;
  walletAddress: string;
  email: string | null;
  isActive: boolean;
  role?: string;
}

interface AuthVerifyResponse {
  success: boolean;
  data?: {
    user: AuthUser;
    valid: boolean;
  };
  message?: string;
}

export class AuthService {
  public authServiceUrl: string; // Make public for HealthCheckable interface
  public timeout: number;

  constructor() {
    this.authServiceUrl = process.env['AUTH_SERVICE_URL'] || 'http://localhost:3002';
    this.timeout = parseInt(process.env['AUTH_TIMEOUT'] || '5000');
  }

  async validateToken(token: string): Promise<AuthUser | null> {
    try {
      if (!token) {
        logger.warn('No token provided for validation');
        return null;
      }

      // Call auth service API endpoint /api/v1/auth/verify
      const response = await axios.get<AuthVerifyResponse>(
        `${this.authServiceUrl}/api/v1/auth/verify`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'WebSocket-Gateway/1.0.0'
          },
          timeout: this.timeout,
          validateStatus: (status: number) => status < 500 // Don't throw on 4xx errors
        }
      );

      if (response.status === 200 && response.data.success && response.data.data) {
        const { user, valid } = response.data.data;
        
        if (valid && user.isActive) {
          logger.debug('Token validation successful', { 
            userId: user.id,
            privyId: user.privyId.substring(0, 8) + '...'
          });
          
          return {
            id: user.id,
            privyId: user.privyId,
            walletAddress: user.walletAddress,
            email: user.email,
            isActive: user.isActive,
            role: 'user' // Default role for WebSocket connections
          };
        }
      }

      // Handle authentication failures
      if (response.status === 401) {
        logger.warn('Token validation failed - unauthorized', {
          status: response.status,
          message: response.data.message
        });
      } else {
        logger.warn('Token validation failed - unexpected response', {
          status: response.status,
          success: response.data.success
        });
      }

      return null;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          logger.error('Auth service unavailable', {
            url: this.authServiceUrl,
            error: error.message
          });
        } else if (error.response) {
          logger.error('Auth service returned error', {
            status: error.response.status,
            data: error.response.data,
            url: this.authServiceUrl
          });
        } else if (error.request) {
          logger.error('No response from auth service', {
            timeout: this.timeout,
            url: this.authServiceUrl
          });
        } else {
          logger.error('Auth request setup error', {
            message: error.message,
            url: this.authServiceUrl
          });
        }
      } else {
        logger.error('Unexpected error during token validation', {
          error: error instanceof Error ? error.message : String(error),
          url: this.authServiceUrl
        });
      }

      return null;
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; user: AuthUser } | null> {
    try {
      const response = await axios.post(
        `${this.authServiceUrl}/api/v1/auth/refresh`,
        { refreshToken },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'WebSocket-Gateway/1.0.0'
          },
          timeout: this.timeout
        }
      );

      if (response.status === 200 && response.data.success) {
        return {
          accessToken: response.data.data.tokens.accessToken,
          user: response.data.data.user
        };
      }

      return null;
    } catch (error: unknown) {
      logger.error('Token refresh failed', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  // Health check for auth service
  async isHealthy(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.authServiceUrl}/health`, {
        timeout: 3000
      });
      
      return response.status === 200 && 
             response.data.status === 'ok' && 
             response.data.services?.jwt === 'healthy';
    } catch (error: unknown) {
      logger.error('Auth service health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  // Get service info
  getServiceInfo() {
    return {
      serviceUrl: this.authServiceUrl,
      timeout: this.timeout,
      service: 'auth-service'
    };
  }
} 