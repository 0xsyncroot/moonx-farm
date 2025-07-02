import winston from 'winston';
import { getLoggerConfig, getConfig, ConfigProfile, isDevelopment } from '@moonx-farm/configs';

/**
 * Logger configuration interface
 */
export interface LoggerConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  service: string;
  enableConsole: boolean;
  enableFile: boolean;
  logDir: string;
  maxFiles: number;
  maxSize: string;
  format?: 'json' | 'console';
}

/**
 * Valid profile names for type safety
 */
const VALID_PROFILES: ConfigProfile[] = [
  'api-gateway',
  'auth-service', 
  'wallet-registry',
  'core-service',
  'aggregator-service',
  'swap-orchestrator',
  'position-indexer',
  'notify-service',
  'price-crawler',
  'order-executor',
  'web',
  'full'
];

/**
 * Check if a string is a valid profile name
 */
function isValidProfile(profile: string): profile is ConfigProfile {
  return VALID_PROFILES.includes(profile as ConfigProfile);
}

/**
 * Get logger configuration from @moonx-farm/configs
 * Falls back to environment variables if configs package is not available
 */
function getLoggerConfigFromConfigs(): LoggerConfig | null {
  try {
    const config = getLoggerConfig();
    return {
      level: config.level as 'error' | 'warn' | 'info' | 'debug',
      service: config.service,
      enableConsole: config.enableConsole,
      enableFile: config.enableFile,
      logDir: config.logDir,
      maxFiles: config.maxFiles,
      maxSize: config.maxSize,
      format: config.format as 'json' | 'console',
    };
  } catch (error) {
    return null;
  }
}

/**
 * Default logger configuration
 */
export const DEFAULT_LOGGER_CONFIG: LoggerConfig = (() => {
  const configsConfig = getLoggerConfigFromConfigs();
  
  if (configsConfig) {
    return configsConfig;
  }
  
  // Fallback to environment variables
  return {
    level: (process.env.LOG_LEVEL as any) || 'info',
    service: process.env.APP_NAME || 'moonx-farm',
    enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
    enableFile: process.env.LOG_ENABLE_FILE === 'true',
    logDir: process.env.LOG_DIR || 'logs',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    format: (process.env.LOG_FORMAT as 'json' | 'console') || 'console',
  };
})();

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
 * @param config - Logger configuration
 * @returns Configured Winston logger
 */
function createWinstonLogger(config: LoggerConfig): winston.Logger {
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

  // Choose format based on config or environment
  const useJsonFormat = config.format === 'json' || (!isDevelopment() && config.format !== 'console');

  const logger = winston.createLogger({
    level: config.level,
    defaultMeta: { service: config.service },
    format: useJsonFormat ? jsonFormat : consoleFormat,
    transports: [],
    exitOnError: false,
  });

  // Add console transport if enabled
  if (config.enableConsole) {
    logger.add(
      new winston.transports.Console({
        handleExceptions: true,
        handleRejections: true,
      })
    );
  }

  // Add file transports if enabled
  if (config.enableFile) {
    logger.add(
      new winston.transports.File({
        filename: `${config.logDir}/${config.service}-error.log`,
        level: 'error',
        format: jsonFormat,
        maxsize: parseInt(config.maxSize),
        maxFiles: config.maxFiles,
      })
    );
    
    logger.add(
      new winston.transports.File({
        filename: `${config.logDir}/${config.service}-combined.log`,
        format: jsonFormat,
        maxsize: parseInt(config.maxSize),
        maxFiles: config.maxFiles,
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
 * Creates a service-specific logger with custom configuration
 * @param config - Logger configuration
 * @returns Logger instance
 * 
 * @example
 * const logger = createLoggerWithConfig({
 *   level: 'debug',
 *   service: 'auth-service',
 *   enableConsole: true,
 *   enableFile: true,
 *   logDir: 'logs',
 *   maxFiles: 10,
 *   maxSize: '20m'
 * });
 */
export function createLoggerWithConfig(config: LoggerConfig): Logger {
  const winstonLogger = createWinstonLogger(config);
  return new LoggerWrapper(winstonLogger, { service: config.service });
}

/**
 * Creates a service-specific logger
 * @param service - Service name or profile
 * @param level - Log level (optional, overrides config)
 * @returns Logger instance
 * 
 * @example
 * // Using service name (falls back to environment variables)
 * const logger = createLogger('auth-service');
 * 
 * // Using profile from @moonx-farm/configs
 * const logger = createLogger('auth-service', 'debug');
 * 
 * logger.info('User authenticated', { userId: '123', traceId: 'abc' });
 * 
 * // Create child logger with default context
 * const userLogger = logger.child({ userId: '123' });
 * userLogger.info('Profile updated'); // Will include userId automatically
 */
export function createLogger(service: string, level?: LogLevel): Logger {
  let config: LoggerConfig;
  
  // Check if service is a valid profile
  if (isValidProfile(service)) {
    try {
      // Try to get configuration from @moonx-farm/configs
      const profileConfig = getConfig(service);
      
      config = {
        level: level || (profileConfig.LOG_LEVEL as LogLevel) || 'info',
        service: profileConfig.APP_NAME || service,
        enableConsole: profileConfig.LOG_ENABLE_CONSOLE !== false,
        enableFile: profileConfig.LOG_ENABLE_FILE === true,
        logDir: profileConfig.LOG_DIR || 'logs',
        maxFiles: profileConfig.LOG_MAX_FILES || 5,
        maxSize: profileConfig.LOG_MAX_SIZE || '10m',
        format: (profileConfig.LOG_FORMAT as 'json' | 'console') || 'console',
      };
    } catch (error) {
      // Fallback to default configuration
      config = {
        ...DEFAULT_LOGGER_CONFIG,
        service,
        level: level || DEFAULT_LOGGER_CONFIG.level,
      };
    }
  } else {
    // Use default configuration for non-profile services
    config = {
      ...DEFAULT_LOGGER_CONFIG,
      service,
      level: level || DEFAULT_LOGGER_CONFIG.level,
    };
  }
  
  return createLoggerWithConfig(config);
}

/**
 * Creates a logger for a specific profile from @moonx-farm/configs
 * @param profile - Profile name (e.g., 'auth-service', 'quote-service', 'full')
 * @param level - Log level (optional, overrides profile config)
 * @returns Logger instance
 * 
 * @example
 * // Create logger for auth-service profile
 * const authLogger = createLoggerForProfile('auth-service');
 * 
 * // Create logger for quote-service with debug level
 * const quoteLogger = createLoggerForProfile('quote-service', 'debug');
 * 
 * // Create logger for full profile (all configs)
 * const fullLogger = createLoggerForProfile('full');
 */
export function createLoggerForProfile(profile: ConfigProfile, level?: LogLevel): Logger {
  if (!isValidProfile(profile)) {
    throw new Error(`Invalid profile: ${profile}. Valid profiles are: ${VALID_PROFILES.join(', ')}`);
  }
  
  try {
    const profileConfig = getConfig(profile);
    
    const config: LoggerConfig = {
      level: level || (profileConfig.LOG_LEVEL as LogLevel) || 'info',
      service: profileConfig.APP_NAME || profile,
      enableConsole: profileConfig.LOG_ENABLE_CONSOLE !== false,
      enableFile: profileConfig.LOG_ENABLE_FILE === true,
      logDir: profileConfig.LOG_DIR || 'logs',
      maxFiles: profileConfig.LOG_MAX_FILES || 5,
      maxSize: profileConfig.LOG_MAX_SIZE || '10m',
      format: (profileConfig.LOG_FORMAT as 'json' | 'console') || 'console',
    };
    
    return createLoggerWithConfig(config);
  } catch (error) {
    // Fallback to regular createLogger if profile not found
    return createLogger(profile, level);
  }
}

/**
 * Creates a logger for a specific service with type safety
 * @param service - Service name (must be a valid profile)
 * @param level - Log level (optional, overrides config)
 * @returns Logger instance
 * 
 * @example
 * // Type-safe service logger creation
 * const authLogger = createLoggerForService('auth-service');
 * const quoteLogger = createLoggerForService('quote-service', 'debug');
 * 
 * // This will cause a TypeScript error:
 * // const invalidLogger = createLoggerForService('invalid-service'); // ❌ Error
 */
export function createLoggerForService(service: ConfigProfile, level?: LogLevel): Logger {
  return createLoggerForProfile(service, level);
}

/**
 * Creates a logger for any service name (fallback to environment variables)
 * @param service - Any service name
 * @param level - Log level (optional)
 * @returns Logger instance
 * 
 * @example
 * // Any service name (uses environment variables)
 * const customLogger = createLoggerForAnyService('my-custom-service');
 * const debugLogger = createLoggerForAnyService('debug-service', 'debug');
 */
export function createLoggerForAnyService(service: string, level?: LogLevel): Logger {
  return createLogger(service, level);
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