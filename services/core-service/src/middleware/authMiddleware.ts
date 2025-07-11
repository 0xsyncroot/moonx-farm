import { FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import { createCoreServiceConfig, getServiceUrls } from '@moonx-farm/configs';

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    privyId: string;
    walletAddress: string;
    aaWalletAddress?: string;
    email?: string;
  };
}

export class AuthMiddleware {
  private authServiceUrl: string;

  constructor() {
    // Get service URLs using the utility function
    const serviceUrls = getServiceUrls('core-service');
    this.authServiceUrl = serviceUrls.authService;
  }

  async authenticate(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
    try {
      const authorization = request.headers.authorization;
      
      if (!authorization || !authorization.startsWith('Bearer ')) {
        return reply.code(401).send({
          success: false,
          error: 'Missing or invalid authorization header'
        });
      }

      const token = authorization.replace('Bearer ', '');

      // Verify token with auth service
      const response = await axios.get(`${this.authServiceUrl}/api/v1/auth/verify`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        timeout: 5000
      });

      if (!response.data.success || !response.data.data.user) {
        return reply.code(401).send({
          success: false,
          error: 'Invalid or expired token'
        });
      }

      // Attach user to request
      request.user = response.data.data.user;

    } catch (error) {
      console.error('Auth middleware error:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return reply.code(401).send({
            success: false,
            error: 'Invalid or expired token'
          });
        }
        
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          return reply.code(503).send({
            success: false,
            error: 'Authentication service unavailable'
          });
        }
      }

      return reply.code(500).send({
        success: false,
        error: 'Authentication failed'
      });
    }
  }

  // Optional middleware for admin routes
  async requireAdmin(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      return reply.code(401).send({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if user has admin role (this would be in user data from auth service)
    // For now, simplified check
    const adminEmails = ['admin@moonxfarm.com', 'support@moonxfarm.com'];
    
    if (!request.user.email || !adminEmails.includes(request.user.email)) {
      return reply.code(403).send({
        success: false,
        error: 'Admin access required'
      });
    }
  }

  // Helper method to get current user ID from authenticated request
  getCurrentUserId(request: AuthenticatedRequest): string {
    if (!request.user) {
      throw new Error('User not authenticated');
    }
    return request.user.id;
  }

  // Helper method to get current wallet address from authenticated request
  getCurrentWalletAddress(request: AuthenticatedRequest): string {
    if (!request.user) {
      throw new Error('User not authenticated');
    }
    return request.user.walletAddress;
  }

  // Helper method to get current AA wallet address from authenticated request
  getCurrentAAWalletAddress(request: AuthenticatedRequest): string | undefined {
    if (!request.user) {
      throw new Error('User not authenticated');
    }
    return request.user.aaWalletAddress;
  }

  // Helper method to get full user object from authenticated request
  getCurrentUser(request: AuthenticatedRequest): {
    id: string;
    privyId: string;
    walletAddress: string;
    aaWalletAddress?: string;
    email?: string;
  } {
    if (!request.user) {
      throw new Error('User not authenticated');
    }
    return request.user;
  }
}

export { AuthenticatedRequest }; 