import { createLogger } from '@moonx-farm/common';
import { connectionManager } from './connectionManager';
import { kafkaConsumer } from './kafkaConsumer';
import { rateLimiter } from '../middleware/rateLimitMiddleware';
import { authService } from '../middleware/authMiddleware';
import { connectionHandler } from '../handlers/connectionHandler';

const logger = createLogger('service-registry');

export class ServiceRegistry {
  private services: Array<{
    name: string;
    service: any;
    isInitialized: boolean;
    isRunning: boolean;
  }> = [];

  constructor() {
    this.registerServices();
  }

  /**
   * Register all services
   */
  private registerServices(): void {
    this.services = [
      {
        name: 'ConnectionManager',
        service: connectionManager,
        isInitialized: false,
        isRunning: false
      },
      {
        name: 'KafkaConsumer',
        service: kafkaConsumer,
        isInitialized: false,
        isRunning: false
      },
      {
        name: 'RateLimiter',
        service: rateLimiter,
        isInitialized: false,
        isRunning: false
      },
      {
        name: 'AuthService',
        service: authService,
        isInitialized: false,
        isRunning: false
      },
      {
        name: 'ConnectionHandler',
        service: connectionHandler,
        isInitialized: false,
        isRunning: false
      }
    ];

    logger.info('Services registered', { 
      serviceCount: this.services.length,
      services: this.services.map(s => s.name)
    });
  }

  /**
   * Start all services
   */
  async startAll(): Promise<void> {
    logger.info('Starting all services...');
    
    try {
      // Start services in order
      for (const serviceInfo of this.services) {
        await this.startService(serviceInfo);
      }
      
      logger.info('All services started successfully');
    } catch (error) {
      logger.error('Failed to start services', { error });
      throw error;
    }
  }

  /**
   * Start individual service
   */
  private async startService(serviceInfo: any): Promise<void> {
    try {
      const { name, service } = serviceInfo;
      
      // Check if service has start method
      if (typeof service.start === 'function') {
        await service.start();
        serviceInfo.isRunning = true;
        logger.info(`${name} started`);
      } else {
        // Mark as running even if no start method
        serviceInfo.isRunning = true;
        logger.debug(`${name} has no start method, marked as running`);
      }
      
      serviceInfo.isInitialized = true;
      
    } catch (error) {
      logger.error(`Failed to start ${serviceInfo.name}`, { error });
      throw error;
    }
  }

  /**
   * Stop all services
   */
  async stopAll(): Promise<void> {
    logger.info('Stopping all services...');
    
    try {
      // Stop services in reverse order
      for (const serviceInfo of this.services.reverse()) {
        await this.stopService(serviceInfo);
      }
      
      logger.info('All services stopped successfully');
    } catch (error) {
      logger.error('Failed to stop services', { error });
      throw error;
    }
  }

  /**
   * Stop individual service
   */
  private async stopService(serviceInfo: any): Promise<void> {
    try {
      const { name, service } = serviceInfo;
      
      if (!serviceInfo.isRunning) {
        logger.debug(`${name} is not running, skipping stop`);
        return;
      }
      
      // Check if service has stop/shutdown method
      if (typeof service.stop === 'function') {
        await service.stop();
        logger.info(`${name} stopped`);
      } else if (typeof service.shutdown === 'function') {
        await service.shutdown();
        logger.info(`${name} shutdown`);
      } else {
        logger.debug(`${name} has no stop/shutdown method`);
      }
      
      serviceInfo.isRunning = false;
      
    } catch (error) {
      logger.error(`Failed to stop ${serviceInfo.name}`, { error });
      // Continue stopping other services
    }
  }

  /**
   * Get health status of all services
   */
  async getHealthStatus(): Promise<{
    overall: 'healthy' | 'unhealthy' | 'degraded';
    services: Record<string, {
      status: 'healthy' | 'unhealthy' | 'unknown';
      isRunning: boolean;
      isInitialized: boolean;
      error?: string;
    }>;
  }> {
    const serviceStatuses: Record<string, any> = {};
    let healthyCount = 0;
    let totalCount = 0;

    for (const serviceInfo of this.services) {
      const { name, service } = serviceInfo;
      totalCount++;
      
      let status = 'unknown';
      let error: string | undefined;

      try {
        // Check if service has health check method
        if (typeof service.getHealthStatus === 'function') {
          const isHealthy = await service.getHealthStatus();
          status = isHealthy ? 'healthy' : 'unhealthy';
        } else if (typeof service.checkAuthServiceHealth === 'function') {
          const isHealthy = await service.checkAuthServiceHealth();
          status = isHealthy ? 'healthy' : 'unhealthy';
        } else if (serviceInfo.isRunning) {
          status = 'healthy';
        } else {
          status = 'unhealthy';
        }
        
        if (status === 'healthy') {
          healthyCount++;
        }
        
      } catch (err) {
        status = 'unhealthy';
        error = err instanceof Error ? err.message : String(err);
      }

      serviceStatuses[name] = {
        status,
        isRunning: serviceInfo.isRunning,
        isInitialized: serviceInfo.isInitialized,
        error
      };
    }

    let overall: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (healthyCount === 0) {
      overall = 'unhealthy';
    } else if (healthyCount < totalCount) {
      overall = 'degraded';
    }

    return {
      overall,
      services: serviceStatuses
    };
  }

  /**
   * Get service metrics
   */
  getMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    for (const serviceInfo of this.services) {
      const { name, service } = serviceInfo;
      
      try {
        if (typeof service.getMetrics === 'function') {
          metrics[name] = service.getMetrics();
        } else {
          metrics[name] = {
            isRunning: serviceInfo.isRunning,
            isInitialized: serviceInfo.isInitialized
          };
        }
      } catch (error) {
        metrics[name] = {
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    
    return metrics;
  }

  /**
   * Get service count
   */
  getServiceCount(): { total: number; running: number; initialized: number } {
    return {
      total: this.services.length,
      running: this.services.filter(s => s.isRunning).length,
      initialized: this.services.filter(s => s.isInitialized).length
    };
  }
}

// Export singleton instance
export const serviceRegistry = new ServiceRegistry(); 