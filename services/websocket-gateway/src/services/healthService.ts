// Minimal Health Service for WebSocket Gateway
import { logger } from '@moonx-farm/common';

interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details?: Record<string, any>;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: HealthCheckResult[];
}

// Type for dependencies that can be health checked
interface HealthCheckable {
  constructor?: { name: string };
  // Auth service interface
  validateToken?: (token: string) => Promise<any>;
  isHealthy?: () => Promise<boolean>;
  authServiceUrl?: string;
  timeout?: number;
  // Redis manager interface
  getClient?: () => { ping: () => Promise<string> };
}

export class HealthService {
  private startTime = Date.now();
  private dependencies: HealthCheckable[];

  constructor(dependencies: HealthCheckable[] = []) {
    this.dependencies = dependencies;
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const checks: HealthCheckResult[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check dependencies
    for (const dependency of this.dependencies) {
      const check = await this.checkDependency(dependency);
      checks.push(check);
      
      // Update overall status based on dependency health
      if (check.status === 'unhealthy') {
        overallStatus = 'unhealthy';
      } else if (check.status === 'degraded' && overallStatus !== 'unhealthy') {
        overallStatus = 'degraded';
      }
    }

    // Memory check
    const memoryCheck = this.checkMemory();
    checks.push(memoryCheck);
    
    // Update overall status based on memory check
    if (memoryCheck.status === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (memoryCheck.status === 'degraded' && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env['npm_package_version'] || '1.0.0',
      checks
    };
  }

  private async checkDependency(dependency: HealthCheckable): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      let name = 'Unknown Service';
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let details: Record<string, any> = {};

      // Check auth service
      if (dependency.validateToken && dependency.isHealthy) {
        name = 'Auth Service';
        try {
          const isHealthy = await dependency.isHealthy();
          status = isHealthy ? 'healthy' : 'unhealthy';
          details = { 
            url: dependency.authServiceUrl || 'unknown',
            timeout: dependency.timeout || 5000
          };
        } catch (error: unknown) {
          status = 'unhealthy';
          details = { 
            error: error instanceof Error ? error.message : String(error),
            url: dependency.authServiceUrl || 'unknown'
          };
        }
      }
      // Check Redis Manager
      else if (dependency.getClient) {
        name = 'Redis Manager';
        try {
          const client = dependency.getClient();
          const pingResult = await client.ping();
          status = pingResult === 'PONG' ? 'healthy' : 'degraded';
          details = { status: 'connected', ping: pingResult };
        } catch (error: unknown) {
          status = 'unhealthy';
          details = { 
            error: error instanceof Error ? error.message : String(error),
            status: 'disconnected'
          };
        }
      }
      // Generic service check
      else {
        name = dependency.constructor?.name || 'Unknown Service';
        status = 'healthy'; // Assume healthy if no specific check
        details = { type: 'generic', checked: true };
      }

      return {
        name,
        status,
        responseTime: Date.now() - startTime,
        details
      };
    } catch (error: unknown) {
      return {
        name: dependency.constructor?.name || 'Unknown Service',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  private checkMemory(): HealthCheckResult {
    const startTime = Date.now();
    
    try {
      const usage = process.memoryUsage();
      const usageInMB = {
        rss: Math.round(usage.rss / 1024 / 1024),
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
        external: Math.round(usage.external / 1024 / 1024)
      };

      // Memory thresholds for WebSocket Gateway
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (usageInMB.heapUsed > 1000) {
        // Critical: > 1GB heap usage
        status = 'unhealthy';
      } else if (usageInMB.heapUsed > 500) {
        // Warning: > 500MB heap usage
        status = 'degraded';
      }

      return {
        name: 'Memory Usage',
        status,
        responseTime: Date.now() - startTime,
        details: {
          ...usageInMB,
          thresholds: {
            degraded: '> 500MB',
            unhealthy: '> 1GB'
          }
        }
      };
    } catch (error: unknown) {
      return {
        name: 'Memory Usage',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  isHealthy(): boolean {
    // Simple sync health check - check if service has been running for at least 30 seconds
    const uptime = Date.now() - this.startTime;
    return uptime > 30000; // 30 seconds minimum uptime
  }

  // Get simple health status (for quick checks)
  getQuickStatus(): 'healthy' | 'unhealthy' {
    const uptime = Date.now() - this.startTime;
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    
    // Quick check: uptime > 30s and memory < 1GB
    return uptime > 30000 && heapUsedMB < 1000 ? 'healthy' : 'unhealthy';
  }

  // Get uptime in human readable format
  getUptimeString(): string {
    const uptime = Date.now() - this.startTime;
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
} 