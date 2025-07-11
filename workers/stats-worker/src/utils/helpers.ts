import { ChainPerformanceStats, BridgeLatencyStats, HealthStatus } from '../types/index';
import { logger } from './logger';

/**
 * Calculate percentage change between two numbers
 */
export function calculatePercentageChange(current: number, previous: number): {
  change: string;
  changePercent: number;
} {
  if (previous === 0) {
    return { change: '0%', changePercent: 0 };
  }

  const changePercent = ((current - previous) / previous) * 100;
  const change = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;

  return { change, changePercent };
}

/**
 * Determine health status based on performance metrics
 */
export function determineHealthStatus(
  current: number,
  threshold: { healthy: number; degraded: number }
): HealthStatus {
  if (current <= threshold.healthy) {
    return 'healthy';
  } else if (current <= threshold.degraded) {
    return 'degraded';
  } else {
    return 'unhealthy';
  }
}

/**
 * Format number to human readable format
 */
export function formatNumber(num: number): string {
  if (num >= 1e9) {
    return (num / 1e9).toFixed(1) + 'B';
  } else if (num >= 1e6) {
    return (num / 1e6).toFixed(1) + 'M';
  } else if (num >= 1e3) {
    return (num / 1e3).toFixed(1) + 'K';
  } else {
    return num.toString();
  }
}

/**
 * Format USD amount with dollar sign and appropriate decimals
 */
export function formatUSD(amount: number): string {
  if (amount >= 1e9) {
    return `$${(amount / 1e9).toFixed(1)}B`;
  } else if (amount >= 1e6) {
    return `$${(amount / 1e6).toFixed(1)}M`;
  } else if (amount >= 1e3) {
    return `$${(amount / 1e3).toFixed(1)}K`;
  } else {
    return `$${amount.toFixed(2)}`;
  }
}

/**
 * Calculate average latency from bridge stats
 */
export function calculateAverageLatency(bridgeStats: BridgeLatencyStats[]): number {
  if (bridgeStats.length === 0) return 0;
  
  const totalLatency = bridgeStats.reduce((sum, stat) => sum + stat.latency, 0);
  return totalLatency / bridgeStats.length;
}

/**
 * Calculate average block time from chain stats
 */
export function calculateAverageBlockTime(chainStats: ChainPerformanceStats[]): number {
  if (chainStats.length === 0) return 0;
  
  const totalBlockTime = chainStats.reduce((sum, stat) => sum + stat.blockTime.current, 0);
  return totalBlockTime / chainStats.length;
}

/**
 * Validate chain performance stats
 */
export function validateChainStats(stats: ChainPerformanceStats): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!stats.chainId || stats.chainId <= 0) {
    errors.push('Invalid chain ID');
  }

  if (!stats.chainName || stats.chainName.trim() === '') {
    errors.push('Chain name is required');
  }

  if (!stats.blockTime || stats.blockTime.current <= 0) {
    errors.push('Invalid block time');
  }

  if (!stats.rpcUrl || !isValidUrl(stats.rpcUrl)) {
    errors.push('Invalid RPC URL');
  }

  if (!stats.updatedAt || isNaN(stats.updatedAt.getTime())) {
    errors.push('Invalid updated timestamp');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate bridge latency stats
 */
export function validateBridgeStats(stats: BridgeLatencyStats): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!stats.provider || !['LI.FI', 'Relay.link', '1inch'].includes(stats.provider)) {
    errors.push('Invalid bridge provider');
  }

  if (!stats.latency || stats.latency < 0) {
    errors.push('Invalid latency value');
  }

  if (!stats.status || !['healthy', 'degraded', 'unhealthy'].includes(stats.status)) {
    errors.push('Invalid status');
  }

  if (!stats.timestamp || stats.timestamp <= 0) {
    errors.push('Invalid timestamp');
  }

  if (!stats.updatedAt || isNaN(stats.updatedAt.getTime())) {
    errors.push('Invalid updated timestamp');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check if URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxAttempts) {
        throw lastError;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      logger.debug(`Retry attempt ${attempt} failed, waiting ${delay}ms`, {
        error: lastError.message,
        attempt,
        maxAttempts
      });
      
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    logger.warn('Failed to parse JSON string', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return fallback;
  }
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }
  
  const cloned = {} as T;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  
  return cloned;
}

/**
 * Sanitize data for logging (remove sensitive information)
 */
export function sanitizeForLogging(data: any): any {
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'apiKey', 'privateKey'];
  
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sanitized = deepClone(data);
  
  function sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '***REDACTED***';
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      }
    }
    
    return obj;
  }
  
  return sanitizeObject(sanitized);
}

/**
 * Calculate time difference in human readable format
 */
export function getTimeDifference(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) { // Less than 1 minute
    return `${Math.floor(diff / 1000)}s ago`;
  } else if (diff < 3600000) { // Less than 1 hour
    return `${Math.floor(diff / 60000)}m ago`;
  } else if (diff < 86400000) { // Less than 1 day
    return `${Math.floor(diff / 3600000)}h ago`;
  } else {
    return `${Math.floor(diff / 86400000)}d ago`;
  }
}

/**
 * Get memory usage statistics
 */
export function getMemoryUsage(): {
  used: number;
  total: number;
  percentage: number;
  formatted: string;
} {
  const usage = process.memoryUsage();
  const total = usage.heapTotal;
  const used = usage.heapUsed;
  const percentage = (used / total) * 100;
  
  return {
    used,
    total,
    percentage,
    formatted: `${formatNumber(used)}B / ${formatNumber(total)}B (${percentage.toFixed(1)}%)`
  };
}

/**
 * Get CPU usage statistics (simple version)
 */
export function getCpuUsage(): Promise<number> {
  return new Promise(resolve => {
    const startUsage = process.cpuUsage();
    const startTime = process.hrtime();
    
    setTimeout(() => {
      const endUsage = process.cpuUsage(startUsage);
      const endTime = process.hrtime(startTime);
      
      const totalTime = endTime[0] * 1000000 + endTime[1] / 1000; // Convert to microseconds
      const totalUsage = endUsage.user + endUsage.system;
      
      const percentage = (totalUsage / totalTime) * 100;
      resolve(Math.min(percentage, 100));
    }, 100);
  });
}

/**
 * Create a timeout promise
 */
export function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);
    
    promise
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Check if process is running in cluster mode
 */
export function isClusterMode(): boolean {
  return process.env.CLUSTER_MODE === 'true' || process.env.NODE_ENV === 'production';
}

/**
 * Get optimal number of workers for cluster
 */
export function getOptimalWorkerCount(): number {
  const cpuCount = require('os').cpus().length;
  const envWorkers = process.env.CLUSTER_WORKERS;
  
  if (envWorkers) {
    const parsed = parseInt(envWorkers, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return Math.min(parsed, cpuCount);
    }
  }
  
  // Default to number of CPUs, but cap at 4 for stats worker
  return Math.min(cpuCount, 4);
} 