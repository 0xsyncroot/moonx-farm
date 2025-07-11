import { createLogger } from '@moonx-farm/common';

// Create logger instance for stats worker
export const logger = createLogger('stats-worker');

// Helper function to log with context
export const logWithContext = (level: string, message: string, context?: Record<string, any>) => {
  const logData = {
    ...context,
    service: 'stats-worker',
    timestamp: new Date().toISOString()
  };

  switch (level) {
    case 'error':
      logger.error(message, logData);
      break;
    case 'warn':
      logger.warn(message, logData);
      break;
    case 'info':
      logger.info(message, logData);
      break;
    case 'debug':
      logger.debug(message, logData);
      break;
    default:
      logger.info(message, logData);
  }
};

// Specialized loggers for different components
export const chainStatsLogger = {
  info: (message: string, context?: Record<string, any>) => 
    logWithContext('info', message, { ...context, component: 'chain-stats' }),
  warn: (message: string, context?: Record<string, any>) => 
    logWithContext('warn', message, { ...context, component: 'chain-stats' }),
  error: (message: string, context?: Record<string, any>) => 
    logWithContext('error', message, { ...context, component: 'chain-stats' }),
  debug: (message: string, context?: Record<string, any>) => 
    logWithContext('debug', message, { ...context, component: 'chain-stats' })
};

export const bridgeStatsLogger = {
  info: (message: string, context?: Record<string, any>) => 
    logWithContext('info', message, { ...context, component: 'bridge-stats' }),
  warn: (message: string, context?: Record<string, any>) => 
    logWithContext('warn', message, { ...context, component: 'bridge-stats' }),
  error: (message: string, context?: Record<string, any>) => 
    logWithContext('error', message, { ...context, component: 'bridge-stats' }),
  debug: (message: string, context?: Record<string, any>) => 
    logWithContext('debug', message, { ...context, component: 'bridge-stats' })
};

export const eventLogger = {
  info: (message: string, context?: Record<string, any>) => 
    logWithContext('info', message, { ...context, component: 'event-publisher' }),
  warn: (message: string, context?: Record<string, any>) => 
    logWithContext('warn', message, { ...context, component: 'event-publisher' }),
  error: (message: string, context?: Record<string, any>) => 
    logWithContext('error', message, { ...context, component: 'event-publisher' }),
  debug: (message: string, context?: Record<string, any>) => 
    logWithContext('debug', message, { ...context, component: 'event-publisher' })
};

export const jobLogger = {
  info: (message: string, context?: Record<string, any>) => 
    logWithContext('info', message, { ...context, component: 'job-scheduler' }),
  warn: (message: string, context?: Record<string, any>) => 
    logWithContext('warn', message, { ...context, component: 'job-scheduler' }),
  error: (message: string, context?: Record<string, any>) => 
    logWithContext('error', message, { ...context, component: 'job-scheduler' }),
  debug: (message: string, context?: Record<string, any>) => 
    logWithContext('debug', message, { ...context, component: 'job-scheduler' })
}; 