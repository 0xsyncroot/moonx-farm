import winston from 'winston';
import { getCurrentEnv, isDevelopment } from './env';

/**
 * Log level type definition
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Structured log context interface
 */
export interface LogContext {
  traceId?: string;
  userId?: string;
  service?: string;
  action?: string;
  [key: string]: any;
}

/**
 * Logger interface for consistent logging across services
 */
export interface Logger {
  error(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  child(defaultContext: LogContext): Logger;
}

/**
 * Creates a Winston logger instance with standardized configuration
 * @param service - Service name for log identification
 * @param level - Log level (defaults to LOG_LEVEL env var or 'info')
 * @returns Configured Winston logger
 */
function createWinstonLogger(service: string, level: LogLevel = 'info'): winston.Logger {
  const env = getCurrentEnv();
  
  // Console format for development
  const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, service, traceId, ...meta }) => {
      let logLine = `${timestamp} [${level}] [${service}]`;
      
      if (traceId) {
        logLine += ` [${traceId}]`;
      }
      
      logLine += `: ${message}`;
      
      // Add metadata if present
      const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
      if (metaStr) {
        logLine += `\n${metaStr}`;
      }
      
      return logLine;
    })
  );

  // JSON format for production
  const jsonFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );

  const logger = winston.createLogger({
    level,
    defaultMeta: { service },
    format: isDevelopment() ? consoleFormat : jsonFormat,
    transports: [
      new winston.transports.Console({
        handleExceptions: true,
        handleRejections: true,
      })
    ],
    exitOnError: false,
  });

  // Add file transport for non-development environments
  if (!isDevelopment()) {
    logger.add(
      new winston.transports.File({
        filename: `logs/${service}-error.log`,
        level: 'error',
        format: jsonFormat,
      })
    );
    
    logger.add(
      new winston.transports.File({
        filename: `logs/${service}-combined.log`,
        format: jsonFormat,
      })
    );
  }

  return logger;
}

/**
 * Logger wrapper that implements the Logger interface
 */
class LoggerWrapper implements Logger {
  constructor(
    private winstonLogger: winston.Logger,
    private defaultContext: LogContext = {}
  ) {}

  private formatMessage(message: string, context?: LogContext) {
    const mergedContext = { ...this.defaultContext, ...context };
    return { message, ...mergedContext };
  }

  error(message: string, context?: LogContext): void {
    this.winstonLogger.error(this.formatMessage(message, context));
  }

  warn(message: string, context?: LogContext): void {
    this.winstonLogger.warn(this.formatMessage(message, context));
  }

  info(message: string, context?: LogContext): void {
    this.winstonLogger.info(this.formatMessage(message, context));
  }

  debug(message: string, context?: LogContext): void {
    this.winstonLogger.debug(this.formatMessage(message, context));
  }

  child(defaultContext: LogContext): Logger {
    return new LoggerWrapper(this.winstonLogger, {
      ...this.defaultContext,
      ...defaultContext,
    });
  }
}

/**
 * Creates a service-specific logger
 * @param service - Service name
 * @param level - Log level (optional)
 * @returns Logger instance
 * 
 * @example
 * const logger = createLogger('auth-service');
 * logger.info('User authenticated', { userId: '123', traceId: 'abc' });
 * 
 * // Create child logger with default context
 * const userLogger = logger.child({ userId: '123' });
 * userLogger.info('Profile updated'); // Will include userId automatically
 */
export function createLogger(service: string, level?: LogLevel): Logger {
  const logLevel = level || (process.env.LOG_LEVEL as LogLevel) || 'info';
  const winstonLogger = createWinstonLogger(service, logLevel);
  return new LoggerWrapper(winstonLogger, { service });
}

/**
 * Default logger instance for quick usage
 */
export const logger = createLogger('moonx-farm');

/**
 * Performance timing utility
 * @param label - Timer label
 * @returns Function to end the timer
 * 
 * @example
 * const endTimer = startTimer('database-query');
 * await database.query('SELECT * FROM users');
 * endTimer(); // Logs: Timer [database-query]: 45ms
 */
export function startTimer(label: string): () => void {
  const start = Date.now();
  return () => {
    const duration = Date.now() - start;
    logger.debug(`Timer [${label}]: ${duration}ms`);
  };
}

/**
 * Async function wrapper with automatic error logging
 * @param fn - Async function to wrap
 * @param context - Additional context for error logging
 * @returns Wrapped function
 * 
 * @example
 * const safeDbQuery = withErrorLogging(
 *   async (userId: string) => database.findUser(userId),
 *   { action: 'find-user' }
 * );
 */
export function withErrorLogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: LogContext
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error(`Error in async operation: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        ...context,
        error: error instanceof Error ? error.stack : error,
        args: JSON.stringify(args),
      });
      throw error;
    }
  }) as T;
} 