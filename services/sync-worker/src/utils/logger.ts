// Simple logger implementation for sync worker
interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  data?: any;
}

class Logger {
  private logLevel: string;

  constructor(logLevel: string = 'info') {
    this.logLevel = logLevel;
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex >= currentLevelIndex;
  }

  private log(level: string, message: string, data?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(data && { data })
    };

    console.log(JSON.stringify(logEntry, null, 2));
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: any): void {
    this.log('error', message, data);
  }
}

// Create logger instance
export const logger = new Logger(process.env.LOG_LEVEL || 'info');

// Export logger methods for convenience
export default logger; 