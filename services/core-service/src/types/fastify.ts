// Fastify Type Extensions

import { FastifyRequest, FastifyReply } from 'fastify';
import { DatabaseManager, RedisManager } from '@moonx-farm/infrastructure';

// Extend FastifyRequest to include user property
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      privyId: string;
      walletAddress: string;
      email?: string;
    };
  }
  
  interface FastifyInstance {
    databaseManager: DatabaseManager;
    redisManager: RedisManager;
  }
}

// Extended request and reply types for better typing
export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    privyId: string;
    walletAddress: string;
    email?: string;
  };
}

export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
};

export type PaginatedApiResponse<T> = {
  success: boolean;
  data: {
    items: T[];
    total: number;
    limit: number;
    offset: number;
  };
}; 