// JSON Schemas for API validation and OpenAPI documentation

// Common schemas
export const ErrorResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        details: { type: 'string' }
      }
    }
  },
  required: ['success', 'message']
} as const;

export const SuccessResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' }
  },
  required: ['success', 'message']
} as const;

// Health check schemas
export const HealthResponseSchema = {
  type: 'object',
  properties: {
    status: { 
      type: 'string', 
      enum: ['ok', 'degraded']
    },
    timestamp: { 
      type: 'string', 
      format: 'date-time'
    },
    service: { 
      type: 'string'
    },
    version: { 
      type: 'string'
    },
    services: {
      type: 'object',
      properties: {
        database: { type: 'string', enum: ['healthy', 'unhealthy'] },
        redis: { type: 'string', enum: ['healthy', 'unhealthy'] },
        jwt: { type: 'string', enum: ['healthy', 'unhealthy'] }
      }
    },
    poolStats: {
      type: 'object',
      properties: {
        totalConnections: { type: 'integer' },
        idleConnections: { type: 'integer' },
        waitingCount: { type: 'integer' }
      }
    }
  },
  required: ['status', 'timestamp', 'service', 'version']
} as const;

// User schemas
export const UserSchema = {
  type: 'object',
  properties: {
    id: { 
      type: 'string', 
      format: 'uuid'
    },
    privyId: { 
      type: 'string'
    },
    walletAddress: { 
      type: 'string'
    },
    displayName: { 
      type: 'string',
      nullable: true
    },
    email: { 
      type: 'string',
      format: 'email',
      nullable: true
    },
    bio: { 
      type: 'string',
      nullable: true
    },
    avatarUrl: { 
      type: 'string',
      format: 'uri',
      nullable: true
    },
    isActive: { 
      type: 'boolean'
    },
    createdAt: { 
      type: 'string',
      format: 'date-time'
    },
    updatedAt: { 
      type: 'string',
      format: 'date-time'
    }
  },
  required: ['id', 'privyId', 'walletAddress', 'isActive', 'createdAt', 'updatedAt']
} as const;

export const TokenPairSchema = {
  type: 'object',
  properties: {
    accessToken: { 
      type: 'string'
    },
    refreshToken: { 
      type: 'string'
    },
    expiresIn: { 
      type: 'integer'
    },
    tokenType: { 
      type: 'string'
    }
  },
  required: ['accessToken', 'refreshToken', 'expiresIn', 'tokenType']
} as const;

// Auth request/response schemas
export const LoginRequestSchema = {
  type: 'object',
  properties: {
    privyToken: { 
      type: 'string',
      minLength: 10
    }
  },
  required: ['privyToken'],
  additionalProperties: false
} as const;

export const LoginResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        user: UserSchema,
        tokens: TokenPairSchema
      },
      required: ['user', 'tokens']
    }
  },
  required: ['success', 'message', 'data']
} as const;

export const RefreshRequestSchema = {
  type: 'object',
  properties: {
    refreshToken: { 
      type: 'string',
      minLength: 10
    }
  },
  required: ['refreshToken'],
  additionalProperties: false
} as const;

export const RefreshResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        tokens: TokenPairSchema
      },
      required: ['tokens']
    }
  },
  required: ['success', 'message', 'data']
} as const;

export const VerifyResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        user: UserSchema,
        expiresAt: { 
          type: 'string',
          format: 'date-time'
        }
      },
      required: ['user', 'expiresAt']
    }
  },
  required: ['success', 'message', 'data']
} as const;

// User management schemas
export const UpdateProfileRequestSchema = {
  type: 'object',
  properties: {
    displayName: { 
      type: 'string',
      maxLength: 100
    },
    email: { 
      type: 'string',
      format: 'email'
    },
    bio: { 
      type: 'string',
      maxLength: 500
    },
    avatarUrl: { 
      type: 'string',
      format: 'uri'
    }
  },
  additionalProperties: false
} as const;

export const UserProfileResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        user: UserSchema
      },
      required: ['user']
    }
  },
  required: ['success', 'message', 'data']
} as const;

// Session schemas
export const SessionSchema = {
  type: 'object',
  properties: {
    id: { 
      type: 'string',
      format: 'uuid'
    },
    userId: { 
      type: 'string',
      format: 'uuid'
    },
    deviceInfo: { 
      type: 'string',
      nullable: true
    },
    ipAddress: { 
      type: 'string',
      nullable: true
    },
    userAgent: { 
      type: 'string',
      nullable: true
    },
    isActive: { 
      type: 'boolean'
    },
    lastActivity: { 
      type: 'string',
      format: 'date-time'
    },
    createdAt: { 
      type: 'string',
      format: 'date-time'
    },
    expiresAt: { 
      type: 'string',
      format: 'date-time'
    }
  },
  required: ['id', 'userId', 'isActive', 'lastActivity', 'createdAt', 'expiresAt']
} as const;

export const ActiveSessionsResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        sessions: {
          type: 'array',
          items: SessionSchema
        }
      },
      required: ['sessions']
    }
  },
  required: ['success', 'message', 'data']
} as const; 