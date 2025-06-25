/**
 * Base application error class with structured error information
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly isOperational: boolean;
  
  constructor(
    message: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serializes error to JSON for logging/API responses
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
      stack: this.stack,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Client/request validation errors (400)
 */
export class BadRequestError extends AppError {
  readonly statusCode = 400;
  readonly isOperational = true;

  constructor(message: string = 'Bad Request', context?: Record<string, any>) {
    super(message, context);
  }
}

/**
 * Authentication required errors (401)
 */
export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly isOperational = true;

  constructor(message: string = 'Authentication required', context?: Record<string, any>) {
    super(message, context);
  }
}

/**
 * Permission/access denied errors (403)
 */
export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly isOperational = true;

  constructor(message: string = 'Access forbidden', context?: Record<string, any>) {
    super(message, context);
  }
}

/**
 * Resource not found errors (404)
 */
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly isOperational = true;

  constructor(message: string = 'Resource not found', context?: Record<string, any>) {
    super(message, context);
  }
}

/**
 * Resource conflict errors (409)
 */
export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly isOperational = true;

  constructor(message: string = 'Resource conflict', context?: Record<string, any>) {
    super(message, context);
  }
}

/**
 * Request validation errors with field-specific details (422)
 */
export class ValidationError extends AppError {
  readonly statusCode = 422;
  readonly isOperational = true;

  constructor(
    message: string = 'Validation failed',
    public readonly fields?: Record<string, string[]>,
    context?: Record<string, any>
  ) {
    super(message, context);
  }

  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      fields: this.fields,
    };
  }
}

/**
 * Rate limiting errors (429)
 */
export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly isOperational = true;

  constructor(
    message: string = 'Rate limit exceeded',
    public readonly retryAfter?: number,
    context?: Record<string, any>
  ) {
    super(message, context);
  }

  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter,
    };
  }
}

/**
 * Internal server errors (500)
 */
export class InternalServerError extends AppError {
  readonly statusCode = 500;
  readonly isOperational = false;

  constructor(message: string = 'Internal server error', context?: Record<string, any>) {
    super(message, context);
  }
}

/**
 * Service unavailable errors (503)
 */
export class ServiceUnavailableError extends AppError {
  readonly statusCode = 503;
  readonly isOperational = true;

  constructor(message: string = 'Service unavailable', context?: Record<string, any>) {
    super(message, context);
  }
}

/**
 * Database-related errors
 */
export class DatabaseError extends InternalServerError {
  constructor(message: string = 'Database operation failed', context?: Record<string, any>) {
    super(message, context);
  }
}

/**
 * External API errors
 */
export class ExternalApiError extends AppError {
  readonly statusCode = 502;
  readonly isOperational = true;

  constructor(
    message: string = 'External API error',
    public readonly service?: string,
    public readonly originalError?: any,
    context?: Record<string, any>
  ) {
    super(message, context);
  }

  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      service: this.service,
      originalError: this.originalError,
    };
  }
}

/**
 * Blockchain-related errors
 */
export class BlockchainError extends AppError {
  readonly statusCode = 502;
  readonly isOperational = true;

  constructor(
    message: string = 'Blockchain operation failed',
    public readonly network?: string,
    public readonly transactionHash?: string,
    context?: Record<string, any>
  ) {
    super(message, context);
  }

  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      network: this.network,
      transactionHash: this.transactionHash,
    };
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if error is operational (expected/handled)
 */
export function isOperationalError(error: any): boolean {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
}

/**
 * Error factory functions for common scenarios
 */
export const ErrorFactory = {
  /**
   * Creates validation error from Zod error
   */
  fromZodError(zodError: any): ValidationError {
    const fields: Record<string, string[]> = {};
    
    if (zodError.errors) {
      zodError.errors.forEach((err: any) => {
        const path = err.path.join('.');
        if (!fields[path]) {
          fields[path] = [];
        }
        fields[path].push(err.message);
      });
    }

    return new ValidationError('Validation failed', fields, {
      originalError: zodError,
    });
  },

  /**
   * Creates database error with query context
   */
  databaseError(message: string, query?: string, params?: any): DatabaseError {
    return new DatabaseError(message, {
      query,
      params,
    });
  },

  /**
   * Creates external API error with service context
   */
  externalApiError(
    service: string,
    message: string,
    originalError?: any
  ): ExternalApiError {
    return new ExternalApiError(message, service, originalError, {
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Creates blockchain error with network context
   */
  blockchainError(
    network: string,
    message: string,
    transactionHash?: string
  ): BlockchainError {
    return new BlockchainError(message, network, transactionHash, {
      timestamp: new Date().toISOString(),
    });
  },
}; 