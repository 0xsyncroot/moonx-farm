import { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginCallback } from 'fastify';
import { createLogger, LogContext } from '@moonx-farm/common';
import { isDevelopment } from '@moonx-farm/configs';

const logger = createLogger('request-logger');

interface RequestLog {
  requestId: string;
  method: string;
  url: string;
  ip: string;
  userAgent: string | undefined;
  timestamp: string;
  userId?: string;
  walletAddress?: string;
  duration?: number;
  statusCode?: number;
  responseSize?: number;
}

interface UserContext {
  userId?: string;
  walletAddress?: string;
  privyUserId?: string;
}

// Custom properties for request context
interface RequestContextData {
  startTime?: number;
  requestId?: string;
  perfStartTime?: bigint;
  perfStartMemory?: NodeJS.MemoryUsage;
  user?: UserContext;
}

type RequestWithContext = FastifyRequest & RequestContextData;

/**
 * Request logging plugin for Fastify
 * Logs all incoming requests and responses using proper Fastify hooks
 */
export const requestLoggerPlugin: FastifyPluginCallback = async (fastify: FastifyInstance) => {
  // Pre-request hook
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const requestId = generateRequestId();
    
    // Store request metadata
    const requestWithContext = request as RequestWithContext;
    requestWithContext.startTime = startTime;
    requestWithContext.requestId = requestId;

    // Prepare base log context
    const logContext: LogContext = {
      requestId,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString(),
      hasBody: !!request.body && Object.keys(request.body as Record<string, unknown> || {}).length > 0,
      queryParams: Object.keys(request.query as Record<string, unknown> || {}).length,
    };

    // Include additional details in development
    if (isDevelopment()) {
      Object.assign(logContext, {
        headers: filterSensitiveHeaders(request.headers),
        query: request.query,
      });
    }

    logger.info('Incoming request', logContext);
  });

  // Post-response hook
  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
    const requestWithContext = request as RequestWithContext;
    const startTime = requestWithContext.startTime || Date.now();
    const duration = Date.now() - startTime;
    const user = requestWithContext.user;

    const logContext: LogContext = {
      requestId: requestWithContext.requestId || 'unknown',
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      duration,
      statusCode: reply.statusCode,
      responseSize: getPayloadSize(payload),
    };

    // Add user context if available
    if (user?.userId) {
      Object.assign(logContext, { userId: user.userId });
    }
    if (user?.walletAddress) {
      Object.assign(logContext, { 
        walletAddress: user.walletAddress.substring(0, 8) + '...' 
      });
    }

    // Log response based on status code
    if (reply.statusCode >= 500) {
      logger.error('Request completed with server error', logContext);
    } else if (reply.statusCode >= 400) {
      logger.warn('Request completed with client error', logContext);
    } else {
      logger.info('Request completed successfully', logContext);
    }

    return payload;
  });

  // Error hook
  fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    const requestWithContext = request as RequestWithContext;
    const startTime = requestWithContext.startTime || Date.now();
    const duration = Date.now() - startTime;

    const logContext: LogContext = {
      requestId: requestWithContext.requestId || 'unknown',
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      duration,
      statusCode: reply.statusCode || 500,
      errorName: error.name,
      errorMessage: error.message,
    };

    if (isDevelopment()) {
      Object.assign(logContext, { errorStack: error.stack });
    }

    logger.error('Request failed with error', logContext);
  });
};

/**
 * Performance monitoring plugin
 * Tracks slow requests and logs performance metrics
 */
export const performanceMonitorPlugin: FastifyPluginCallback = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    const requestWithContext = request as RequestWithContext;
    requestWithContext.perfStartTime = process.hrtime.bigint();
    requestWithContext.perfStartMemory = process.memoryUsage();
  });

  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
    const requestWithContext = request as RequestWithContext;
    const startTime = requestWithContext.perfStartTime;
    const startMemory = requestWithContext.perfStartMemory;
    
    if (!startTime || !startMemory) return payload;

    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

    const performanceLog: LogContext = {
      requestId: requestWithContext.requestId || 'unknown',
      method: request.method,
      url: request.url,
      duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
      memoryDelta: Math.round(memoryDelta / 1024), // Convert to KB
      statusCode: reply.statusCode,
      performanceEvent: 'request_completed',
    };

    // Log slow requests (> 1 second)
    if (duration > 1000) {
      logger.warn('Slow request detected', performanceLog);
    }
    
    // Log high memory usage (> 10MB)
    if (Math.abs(memoryDelta) > 10 * 1024 * 1024) {
      logger.warn('High memory usage detected', performanceLog);
    }

    // Always log performance metrics in debug mode
    logger.debug('Request performance', performanceLog);

    return payload;
  });
};

/**
 * Security logging plugin
 * Logs security-related events
 */
export const securityLoggerPlugin: FastifyPluginCallback = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    const requestWithContext = request as RequestWithContext;
    const securityEvents: string[] = [];

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.\.\//,         // Path traversal
      /<script/i,       // XSS attempts
      /union.*select/i, // SQL injection
      /javascript:/i,   // JavaScript injection
      /eval\(/i,        // Code injection
      /exec\(/i,        // Command injection
    ];

    const urlToCheck = decodeURIComponent(request.url);
    
    suspiciousPatterns.forEach((pattern, index) => {
      if (pattern.test(urlToCheck)) {
        securityEvents.push(`Suspicious pattern ${index + 1}: ${pattern.source}`);
      }
    });

    // Check user agent patterns
    const userAgent = request.headers['user-agent'] || '';
    const suspiciousAgents = ['sqlmap', 'nikto', 'nmap', 'masscan'];
    
    suspiciousAgents.forEach(agent => {
      if (userAgent.toLowerCase().includes(agent)) {
        securityEvents.push(`Suspicious user agent: ${agent}`);
      }
    });

          // Log security events if any found
      if (securityEvents.length > 0) {
        const logContext: LogContext = {
          requestId: requestWithContext.requestId || 'unknown',
          ip: request.ip,
        userAgent,
        url: request.url,
        method: request.method,
        securityEvents,
        eventType: 'security_threat',
      };

      if (isDevelopment()) {
        Object.assign(logContext, {
          headers: filterSensitiveHeaders(request.headers),
        });
      }

      logger.warn('Security threat detected', logContext);
    }

          // Log authentication attempts
      if (request.url.includes('/auth/') && request.method === 'POST') {
        const logContext: LogContext = {
          requestId: requestWithContext.requestId || 'unknown',
          ip: request.ip,
        userAgent,
        url: request.url,
        eventType: 'auth_attempt',
      };

      logger.info('Authentication attempt', logContext);
    }
  });
};

/**
 * API usage tracking plugin
 * Tracks API endpoint usage for analytics
 */
export const apiUsageTrackerPlugin: FastifyPluginCallback = async (fastify: FastifyInstance) => {
  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
    const requestWithContext = request as RequestWithContext;
    const user = requestWithContext.user;
    
    // Extract endpoint pattern (remove IDs and query params)
    const endpoint = (request.url.split('?')[0] || request.url)
      .replace(/\/[0-9a-fA-F-]{36}/g, '/:uuid') // Replace UUIDs
      .replace(/\/[0-9]+/g, '/:id') // Replace numeric IDs
      .replace(/\/0x[a-fA-F0-9]{40}/g, '/:address'); // Replace Ethereum addresses

    const usageLog: LogContext = {
      requestId: requestWithContext.requestId || 'unknown',
      endpoint,
      method: request.method,
      statusCode: reply.statusCode,
      timestamp: new Date().toISOString(),
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      eventType: 'api_usage',
    };

    // Add user context if available
    if (user?.userId) {
      Object.assign(usageLog, { userId: user.userId });
    }

    // Log API usage for analytics
    logger.debug('API endpoint accessed', usageLog);

    return payload;
  });
};

/**
 * Generate a unique request ID with better entropy
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `req_${timestamp}_${random}`;
}

/**
 * Filter sensitive headers for logging
 */
function filterSensitiveHeaders(headers: Record<string, any>): Record<string, any> {
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'x-access-token',
    'x-refresh-token',
  ];

  const filtered = { ...headers };

  sensitiveHeaders.forEach(header => {
    if (filtered[header]) {
      filtered[header] = '[REDACTED]';
    }
    if (filtered[header.toUpperCase()]) {
      filtered[header.toUpperCase()] = '[REDACTED]';
    }
  });

  return filtered;
}

/**
 * Calculate payload size safely
 */
function getPayloadSize(payload: any): number {
  if (!payload) return 0;
  if (typeof payload === 'string') return payload.length;
  if (Buffer.isBuffer(payload)) return payload.length;
  if (typeof payload === 'object') {
    try {
      return JSON.stringify(payload).length;
    } catch {
      return 0;
    }
  }
  return 0;
}

/**
 * Helper function to register all logging plugins
 */
export async function registerLoggingPlugins(fastify: FastifyInstance) {
  await fastify.register(requestLoggerPlugin);
  await fastify.register(performanceMonitorPlugin);
  await fastify.register(securityLoggerPlugin);
  await fastify.register(apiUsageTrackerPlugin);
}