import { FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { createLogger, LogContext } from '@moonx-farm/common';
import { isDevelopment, isProduction } from '@moonx-farm/configs';

const logger = createLogger('error-handler');

interface ErrorResponse {
  success: false;
  message: string;
  code: string;
  details?: any;
  timestamp: string;
  requestId?: string;
}

/**
 * Enhanced error categorization
 */
interface ErrorCategory {
  statusCode: number;
  message: string;
  code: string;
  expose: boolean; // Whether to expose original error message
}

/**
 * Error classification mapping
 */
const ERROR_CATEGORIES = new Map<string, ErrorCategory>([
  // Authentication & Authorization
  ['JsonWebTokenError', { statusCode: 401, message: 'Invalid token', code: 'INVALID_TOKEN', expose: false }],
  ['TokenExpiredError', { statusCode: 401, message: 'Token expired', code: 'TOKEN_EXPIRED', expose: false }],
  ['NotBeforeError', { statusCode: 401, message: 'Token not active', code: 'TOKEN_NOT_ACTIVE', expose: false }],
  
  // Database & Infrastructure
  ['DatabaseError', { statusCode: 500, message: 'Database error', code: 'DATABASE_ERROR', expose: false }],
  ['ServiceUnavailableError', { statusCode: 503, message: 'Service temporarily unavailable', code: 'SERVICE_UNAVAILABLE', expose: false }],
  
  // Validation & Input
  ['ValidationError', { statusCode: 400, message: 'Validation error', code: 'VALIDATION_ERROR', expose: true }],
  
  // External Services
  ['PrivyError', { statusCode: 401, message: 'Authentication service error', code: 'AUTH_SERVICE_ERROR', expose: false }],
]);

/**
 * Global error handler for Fastify with enhanced security and categorization
 */
export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Generate request ID for tracking
  const requestId = request.id || generateRequestId();

  // Log the error with structured context
  const logContext: LogContext = {
    requestId,
    method: request.method,
    url: request.url,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    errorName: error.name,
    errorMessage: error.message,
    statusCode: error.statusCode,
    hasValidation: !!error.validation,
  };

  // Include additional details in development only
  if (isDevelopment()) {
    Object.assign(logContext, {
      errorStack: error.stack,
      headers: request.headers,
      validation: error.validation
    });
  }

  logger.error('Request error occurred', logContext);

  // Prepare error response
  const errorResponse: ErrorResponse = {
    success: false,
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
    requestId,
  };

  // Categorize and handle the error
  let statusCode = 500;
  let category: ErrorCategory | undefined;

  // First, check for specific error categories
  category = ERROR_CATEGORIES.get(error.name);
  
  // Handle validation errors specially (from Fastify schema validation)
  if (error.validation) {
    statusCode = 400;
    errorResponse.message = 'Validation error';
    errorResponse.code = 'VALIDATION_ERROR';
    errorResponse.details = error.validation.map((err: any) => ({
      field: err.instancePath.replace('/', '') || err.params?.missingProperty || 'unknown',
      message: err.message,
      value: isDevelopment() ? err.data : undefined, // Only expose data in development
    }));
  }
  // Use categorized error if found
  else if (category) {
    statusCode = category.statusCode;
    errorResponse.message = category.expose || isDevelopment() ? error.message : category.message;
    errorResponse.code = category.code;
    
    // Add details for non-production environments
    if (!isProduction() && !category.expose) {
      errorResponse.details = error.message;
    }
  }
  // Handle by status code for HTTP errors
  else if (error.statusCode) {
    statusCode = error.statusCode;
    
    switch (statusCode) {
      case 400:
        errorResponse.message = error.message || 'Bad request';
        errorResponse.code = 'BAD_REQUEST';
        break;
      case 401:
        errorResponse.message = 'Unauthorized';
        errorResponse.code = 'UNAUTHORIZED';
        break;
      case 403:
        errorResponse.message = 'Forbidden';
        errorResponse.code = 'FORBIDDEN';
        break;
      case 404:
        errorResponse.message = 'Not found';
        errorResponse.code = 'NOT_FOUND';
        break;
      case 409:
        errorResponse.message = error.message || 'Conflict';
        errorResponse.code = 'CONFLICT';
        break;
      case 429:
        errorResponse.message = 'Too many requests';
        errorResponse.code = 'RATE_LIMIT_EXCEEDED';
        break;
      default:
        if (statusCode >= 400 && statusCode < 500) {
          errorResponse.message = error.message || 'Client error';
          errorResponse.code = 'CLIENT_ERROR';
        } else {
          errorResponse.message = 'Internal server error';
          errorResponse.code = 'INTERNAL_ERROR';
        }
    }
  }
  // Handle by error message patterns (fallback)
  else if (error.message.includes('Redis') || error.message.includes('redis')) {
    statusCode = 503;
    errorResponse.message = 'Cache service temporarily unavailable';
    errorResponse.code = 'CACHE_SERVICE_ERROR';
  }
  else if (error.message.includes('database') || error.message.includes('Database')) {
    statusCode = 500;
    errorResponse.message = 'Database error';
    errorResponse.code = 'DATABASE_ERROR';
    
    if (!isProduction()) {
      errorResponse.details = error.message;
    }
  }
  else if (error.message.includes('Privy') || error.message.includes('privy')) {
    statusCode = 503;
    errorResponse.message = 'Authentication service temporarily unavailable';
    errorResponse.code = 'AUTH_SERVICE_ERROR';
  }
  // Default server error
  else {
    statusCode = 500;
    errorResponse.message = 'Internal server error';
    errorResponse.code = 'INTERNAL_ERROR';
    
    // Include error details in development
    if (isDevelopment()) {
      errorResponse.details = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
  }

  // Send error response
  reply.code(statusCode).send(errorResponse);
}

/**
 * Generate a unique request ID with better entropy
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `req_${timestamp}_${random}`;
}

/**
 * Handle 404 errors (route not found) with enhanced logging
 */
export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  const requestId = request.id || generateRequestId();

  const logContext: LogContext = {
    requestId,
    method: request.method,
    url: request.url,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    eventType: 'route_not_found',
  };

  logger.warn('Route not found', logContext);

  const errorResponse: ErrorResponse = {
    success: false,
    message: `Route ${request.method} ${request.url} not found`,
    code: 'ROUTE_NOT_FOUND',
    timestamp: new Date().toISOString(),
    requestId,
  };

  reply.code(404).send(errorResponse);
}

/**
 * Async error wrapper for route handlers
 */
export function asyncErrorHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      // This will be caught by the global error handler
      throw error;
    }
  };
}

/**
 * Enhanced validation error formatter with better structure
 */
export function formatValidationError(validation: any[]): string {
  if (!validation || validation.length === 0) {
    return 'Validation failed';
  }

  const errors = validation.map((err: any) => {
    const field = err.instancePath?.replace('/', '') || 
                  err.params?.missingProperty || 
                  err.schemaPath?.split('/').pop() || 
                  'unknown';
    return `${field}: ${err.message}`;
  });

  return errors.join(', ');
}

/**
 * Check if error should be exposed to client
 */
export function shouldExposeError(error: FastifyError): boolean {
  // Always expose validation errors
  if (error.validation) return true;
  
  // Expose client errors (4xx) in development
  if (isDevelopment() && error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    return true;
  }
  
  // Check error categories
  const category = ERROR_CATEGORIES.get(error.name);
  return category?.expose || false;
}

/**
 * Sanitize error message for production
 */
export function sanitizeErrorMessage(error: FastifyError): string {
  if (shouldExposeError(error)) {
    return error.message;
  }
  
  const category = ERROR_CATEGORIES.get(error.name);
  return category?.message || 'An error occurred';
}