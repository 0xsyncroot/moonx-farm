import { FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import { createCoreServiceConfig, getServiceUrls } from '@moonx/configs';

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    privyId: string;
    walletAddress: string;
    email?: string;
  };
}

export class AuthMiddleware {
  private authServiceUrl: string;

  constructor() {
    const config = createCoreServiceConfig();
    
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
      const response = await axios.post(`${this.authServiceUrl}/api/v1/auth/verify`, 
        { token },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000
        }
      );

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

  // Helper to get current user ID
  getCurrentUserId(request: AuthenticatedRequest): string {
    if (!request.user) {
      throw new Error('User not authenticated');
    }
    return request.user.id;
  }

  // Helper to get current user wallet address
  getCurrentWalletAddress(request: AuthenticatedRequest): string {
    if (!request.user) {
      throw new Error('User not authenticated');
    }
    return request.user.walletAddress;
  }
}

export { AuthenticatedRequest }; 