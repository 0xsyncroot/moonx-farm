"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.DEFAULT_LOGGER_CONFIG = void 0;
exports.createLoggerWithConfig = createLoggerWithConfig;
exports.createLogger = createLogger;
exports.createLoggerForProfile = createLoggerForProfile;
exports.createLoggerForService = createLoggerForService;
exports.createLoggerForAnyService = createLoggerForAnyService;
exports.startTimer = startTimer;
exports.withErrorLogging = withErrorLogging;
const winston_1 = __importDefault(require("winston"));
const configs_1 = require("@moonx-farm/configs");
/**
 * Valid profile names for type safety
 */
const VALID_PROFILES = [
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
function isValidProfile(profile) {
    return VALID_PROFILES.includes(profile);
}
/**
 * Get logger configuration from @moonx-farm/configs
 * Falls back to environment variables if configs package is not available
 */
function getLoggerConfigFromConfigs() {
    try {
        const config = (0, configs_1.getLoggerConfig)();
        return {
            level: config.level,
            service: config.service,
            enableConsole: config.enableConsole,
            enableFile: config.enableFile,
            logDir: config.logDir,
            maxFiles: config.maxFiles,
            maxSize: config.maxSize,
            format: config.format,
        };
    }
    catch (error) {
        return null;
    }
}
/**
 * Default logger configuration
 */
exports.DEFAULT_LOGGER_CONFIG = (() => {
    const configsConfig = getLoggerConfigFromConfigs();
    if (configsConfig) {
        return configsConfig;
    }
    // Fallback to environment variables
    return {
        level: process.env.LOG_LEVEL || 'info',
        service: process.env.APP_NAME || 'moonx-farm',
        enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
        enableFile: process.env.LOG_ENABLE_FILE === 'true',
        logDir: process.env.LOG_DIR || 'logs',
        maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
        maxSize: process.env.LOG_MAX_SIZE || '10m',
        format: process.env.LOG_FORMAT || 'console',
    };
})();
/**
 * Creates a Winston logger instance with standardized configuration
 * @param config - Logger configuration
 * @returns Configured Winston logger
 */
function createWinstonLogger(config) {
    // Console format for development
    const consoleFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf(({ timestamp, level, message, service, traceId, ...meta }) => {
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
    }));
    // JSON format for production
    const jsonFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
    // Choose format based on config or environment
    const useJsonFormat = config.format === 'json' || (!(0, configs_1.isDevelopment)() && config.format !== 'console');
    const logger = winston_1.default.createLogger({
        level: config.level,
        defaultMeta: { service: config.service },
        format: useJsonFormat ? jsonFormat : consoleFormat,
        transports: [],
        exitOnError: false,
    });
    // Add console transport if enabled
    if (config.enableConsole) {
        logger.add(new winston_1.default.transports.Console({
            handleExceptions: true,
            handleRejections: true,
        }));
    }
    // Add file transports if enabled
    if (config.enableFile) {
        logger.add(new winston_1.default.transports.File({
            filename: `${config.logDir}/${config.service}-error.log`,
            level: 'error',
            format: jsonFormat,
            maxsize: parseInt(config.maxSize),
            maxFiles: config.maxFiles,
        }));
        logger.add(new winston_1.default.transports.File({
            filename: `${config.logDir}/${config.service}-combined.log`,
            format: jsonFormat,
            maxsize: parseInt(config.maxSize),
            maxFiles: config.maxFiles,
        }));
    }
    return logger;
}
/**
 * Logger wrapper that implements the Logger interface
 */
class LoggerWrapper {
    constructor(winstonLogger, defaultContext = {}) {
        this.winstonLogger = winstonLogger;
        this.defaultContext = defaultContext;
    }
    formatMessage(message, context) {
        const mergedContext = { ...this.defaultContext, ...context };
        return { message, ...mergedContext };
    }
    error(message, context) {
        this.winstonLogger.error(this.formatMessage(message, context));
    }
    warn(message, context) {
        this.winstonLogger.warn(this.formatMessage(message, context));
    }
    info(message, context) {
        this.winstonLogger.info(this.formatMessage(message, context));
    }
    debug(message, context) {
        this.winstonLogger.debug(this.formatMessage(message, context));
    }
    child(defaultContext) {
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
function createLoggerWithConfig(config) {
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
function createLogger(service, level) {
    let config;
    // Check if service is a valid profile
    if (isValidProfile(service)) {
        try {
            // Try to get configuration from @moonx-farm/configs
            const profileConfig = (0, configs_1.getConfig)(service);
            config = {
                level: level || profileConfig.LOG_LEVEL || 'info',
                service: profileConfig.APP_NAME || service,
                enableConsole: profileConfig.LOG_ENABLE_CONSOLE !== false,
                enableFile: profileConfig.LOG_ENABLE_FILE === true,
                logDir: profileConfig.LOG_DIR || 'logs',
                maxFiles: profileConfig.LOG_MAX_FILES || 5,
                maxSize: profileConfig.LOG_MAX_SIZE || '10m',
                format: profileConfig.LOG_FORMAT || 'console',
            };
        }
        catch (error) {
            // Fallback to default configuration
            config = {
                ...exports.DEFAULT_LOGGER_CONFIG,
                service,
                level: level || exports.DEFAULT_LOGGER_CONFIG.level,
            };
        }
    }
    else {
        // Use default configuration for non-profile services
        config = {
            ...exports.DEFAULT_LOGGER_CONFIG,
            service,
            level: level || exports.DEFAULT_LOGGER_CONFIG.level,
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
function createLoggerForProfile(profile, level) {
    if (!isValidProfile(profile)) {
        throw new Error(`Invalid profile: ${profile}. Valid profiles are: ${VALID_PROFILES.join(', ')}`);
    }
    try {
        const profileConfig = (0, configs_1.getConfig)(profile);
        const config = {
            level: level || profileConfig.LOG_LEVEL || 'info',
            service: profileConfig.APP_NAME || profile,
            enableConsole: profileConfig.LOG_ENABLE_CONSOLE !== false,
            enableFile: profileConfig.LOG_ENABLE_FILE === true,
            logDir: profileConfig.LOG_DIR || 'logs',
            maxFiles: profileConfig.LOG_MAX_FILES || 5,
            maxSize: profileConfig.LOG_MAX_SIZE || '10m',
            format: profileConfig.LOG_FORMAT || 'console',
        };
        return createLoggerWithConfig(config);
    }
    catch (error) {
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
function createLoggerForService(service, level) {
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
function createLoggerForAnyService(service, level) {
    return createLogger(service, level);
}
/**
 * Default logger instance for quick usage
 */
exports.logger = createLogger('moonx-farm');
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
function startTimer(label) {
    const start = Date.now();
    return () => {
        const duration = Date.now() - start;
        exports.logger.debug(`Timer [${label}]: ${duration}ms`);
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
function withErrorLogging(fn, context) {
    return (async (...args) => {
        try {
            return await fn(...args);
        }
        catch (error) {
            exports.logger.error(`Error in async operation: ${error instanceof Error ? error.message : 'Unknown error'}`, {
                ...context,
                error: error instanceof Error ? error.stack : error,
                args: JSON.stringify(args),
            });
            throw error;
        }
    });
}
