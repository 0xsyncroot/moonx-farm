import { logger } from '@moonx-farm/common';
import { RedisManager } from '@moonx-farm/infrastructure';
import { EventEmitter } from 'events';

export interface InstanceInfo {
  id: string;
  host: string;
  port: number;
  connections: number;
  maxConnections: number;
  cpuUsage: number;
  memoryUsage: number;
  isHealthy: boolean;
  lastHealthCheck: Date;
  uptime: number;
  version: string;
  region?: string;
  availabilityZone?: string;
}

export interface LoadBalancerConfig {
  maxConnectionsPerInstance: number;
  healthCheckInterval: number;
  instanceTTL: number;
  algorithm: 'round-robin' | 'least-connections' | 'cpu-based' | 'weighted';
  weights?: Record<string, number>;
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    timeoutMs: number;
    resetTimeoutMs: number;
  };
  redis?: {
    enabled: boolean;
    keyPrefix: string;
    ttl: number;
  };
}

export interface LoadBalancerStatus {
  instanceId: string;
  algorithm: string;
  totalInstances: number;
  healthyInstances: number;
  totalConnections: number;
  averageLoad: number;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  instances: InstanceInfo[];
}

export class LoadBalancer extends EventEmitter {
  private instances: Map<string, InstanceInfo> = new Map();
  private currentInstanceId: string;
  private roundRobinIndex = 0;
  private circuitBreakerState: 'closed' | 'open' | 'half-open' = 'closed';
  private circuitBreakerFailures = 0;
  private circuitBreakerLastFailure = 0;
  private config: LoadBalancerConfig;
  private redisManager: RedisManager | undefined;
  private healthCheckTimer: NodeJS.Timeout | undefined;
  private cleanupTimer: NodeJS.Timeout | undefined;

  constructor(config: LoadBalancerConfig, redisManager?: RedisManager) {
    super();
    this.config = config;
    this.redisManager = redisManager;
    this.currentInstanceId = this.generateInstanceId();
    
    // Initialize current instance
    this.registerCurrentInstance();
    
    // Start background processes
    this.startHealthChecking();
    this.startInstanceCleanup();
    
    logger.info('🔄 LoadBalancer initialized', {
      instanceId: this.currentInstanceId,
      algorithm: this.config.algorithm,
      maxConnections: this.config.maxConnectionsPerInstance
    });
  }

  private generateInstanceId(): string {
    const hostname = process.env['HOSTNAME'] || 'unknown';
    const pid = process.pid;
    const timestamp = Date.now();
    return `${hostname}-${pid}-${timestamp}`;
  }

  private registerCurrentInstance(): void {
    const instanceInfo: InstanceInfo = {
      id: this.currentInstanceId,
      host: process.env['WEBSOCKET_GATEWAY_HOST'] || 'localhost',
      port: parseInt(process.env['WEBSOCKET_GATEWAY_PORT'] || '3007'),
      connections: 0,
      maxConnections: this.config.maxConnectionsPerInstance,
      cpuUsage: 0,
      memoryUsage: 0,
      isHealthy: true,
      lastHealthCheck: new Date(),
      uptime: process.uptime(),
      version: process.env['npm_package_version'] || '1.0.0',
      region: process.env['AWS_REGION'] || process.env['REGION'],
      availabilityZone: process.env['AWS_AVAILABILITY_ZONE'] || process.env['AZ']
    } as InstanceInfo;

    this.instances.set(this.currentInstanceId, instanceInfo);
    
    if (this.config.redis?.enabled && this.redisManager) {
      this.registerInstanceInRedis(instanceInfo);
    }
  }

  private async registerInstanceInRedis(instance: InstanceInfo): Promise<void> {
    if (!this.redisManager) return;
    
    const key = `${this.config.redis?.keyPrefix || 'lb:'}instances:${instance.id}`;
    const value = JSON.stringify(instance);
    
    try {
      await this.redisManager.set(key, value);
      logger.debug('Instance registered in Redis', { instanceId: instance.id });
    } catch (error) {
      logger.error('Failed to register instance in Redis', { 
        instanceId: instance.id, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  private async loadInstancesFromRedis(): Promise<void> {
    if (!this.config.redis?.enabled || !this.redisManager) return;
    
    const pattern = `${this.config.redis.keyPrefix || 'lb:'}instances:*`;
    
    try {
      // For simplicity, we'll use a different approach since keys() might not be available
      // In production, you'd configure Redis client with proper key scanning
      logger.debug('Loading instances from Redis (placeholder implementation)');
      
      // TODO: Implement proper Redis key scanning based on your Redis client
      // const keys = await this.redisManager.keys(pattern);
      // const instancesData = await Promise.all(keys.map(key => this.redisManager!.get(key)));
      
    } catch (error) {
      logger.error('Failed to load instances from Redis', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  private startHealthChecking(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
      this.loadInstancesFromRedis();
    }, this.config.healthCheckInterval);
  }

  private startInstanceCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleInstances();
    }, this.config.instanceTTL / 2);
  }

  private performHealthCheck(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const instance = this.instances.get(this.currentInstanceId);
    if (!instance) return;
    
    // Calculate metrics
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000;
    
    // Update instance info
    instance.memoryUsage = Math.round(heapUsedMB * 100) / 100;
    instance.cpuUsage = Math.round(cpuPercent * 100) / 100;
    instance.uptime = process.uptime();
    instance.lastHealthCheck = new Date();
    
    // Health check logic
    const wasHealthy = instance.isHealthy;
    instance.isHealthy = (
      instance.connections < instance.maxConnections &&
      instance.memoryUsage < 1024 && // Less than 1GB
      instance.cpuUsage < 80 // Less than 80%
    );
    
    // Update circuit breaker
    if (!instance.isHealthy) {
      this.circuitBreakerFailures++;
      this.circuitBreakerLastFailure = Date.now();
      
      if (this.circuitBreakerFailures >= this.config.circuitBreaker.failureThreshold) {
        this.circuitBreakerState = 'open';
        logger.warn('Circuit breaker opened due to health check failures', {
          instanceId: this.currentInstanceId,
          failures: this.circuitBreakerFailures
        });
      }
    } else if (wasHealthy !== instance.isHealthy) {
      // Instance recovered
      this.circuitBreakerFailures = 0;
      this.circuitBreakerState = 'closed';
      logger.info('Instance recovered, circuit breaker closed', {
        instanceId: this.currentInstanceId
      });
    }
    
    // Update circuit breaker state
    if (this.circuitBreakerState === 'open') {
      const timeSinceLastFailure = Date.now() - this.circuitBreakerLastFailure;
      if (timeSinceLastFailure > this.config.circuitBreaker.resetTimeoutMs) {
        this.circuitBreakerState = 'half-open';
        logger.info('Circuit breaker half-open', { instanceId: this.currentInstanceId });
      }
    }
    
    // Register updated instance
    if (this.config.redis?.enabled && this.redisManager) {
      this.registerInstanceInRedis(instance);
    }
    
    // Emit health check event
    this.emit('health-check', {
      instanceId: this.currentInstanceId,
      isHealthy: instance.isHealthy,
      metrics: {
        connections: instance.connections,
        memoryUsage: instance.memoryUsage,
        cpuUsage: instance.cpuUsage,
        uptime: instance.uptime
      }
    });
  }

  private cleanupStaleInstances(): void {
    const now = Date.now();
    const staleCutoff = now - this.config.instanceTTL;
    
    const staleInstances = Array.from(this.instances.entries())
      .filter(([id, instance]) => {
        if (id === this.currentInstanceId) return false;
        return instance.lastHealthCheck.getTime() < staleCutoff;
      })
      .map(([id]) => id);
    
    for (const instanceId of staleInstances) {
      this.instances.delete(instanceId);
      logger.info('Removed stale instance', { instanceId });
      
      // Clean up from Redis
      if (this.config.redis?.enabled && this.redisManager) {
        const key = `${this.config.redis.keyPrefix || 'lb:'}instances:${instanceId}`;
        this.redisManager.del(key).catch(error => {
          logger.error('Failed to delete instance from Redis', { instanceId, error });
        });
      }
    }
  }

  async registerConnection(connectionId: string): Promise<void> {
    const instance = this.instances.get(this.currentInstanceId);
    if (instance) {
      instance.connections++;
      
      if (this.config.redis?.enabled && this.redisManager) {
        this.registerInstanceInRedis(instance);
      }
    }
    
    logger.debug('Connection registered', { 
      connectionId, 
      instanceId: this.currentInstanceId,
      totalConnections: instance?.connections || 0
    });
  }

  async unregisterConnection(connectionId: string): Promise<void> {
    const instance = this.instances.get(this.currentInstanceId);
    if (instance && instance.connections > 0) {
      instance.connections--;
      
      if (this.config.redis?.enabled && this.redisManager) {
        this.registerInstanceInRedis(instance);
      }
    }
    
    logger.debug('Connection unregistered', { 
      connectionId, 
      instanceId: this.currentInstanceId,
      totalConnections: instance?.connections || 0
    });
  }

  getOptimalInstance(): InstanceInfo | null {
    const healthyInstances = Array.from(this.instances.values())
      .filter(instance => instance.isHealthy && instance.connections < instance.maxConnections);
    
    if (healthyInstances.length === 0) {
      return null;
    }
    
    switch (this.config.algorithm) {
      case 'round-robin':
        return this.roundRobinSelect(healthyInstances);
      
      case 'least-connections':
        return this.leastConnectionsSelect(healthyInstances);
      
      case 'cpu-based':
        return this.cpuBasedSelect(healthyInstances);
      
      case 'weighted':
        return this.weightedSelect(healthyInstances);
      
      default:
        return this.roundRobinSelect(healthyInstances);
    }
  }

  private roundRobinSelect(instances: InstanceInfo[]): InstanceInfo {
    if (instances.length === 0) {
      throw new Error('No instances available for round-robin selection');
    }
    const index = this.roundRobinIndex % instances.length;
    const instance = instances[index];
    this.roundRobinIndex++;
    if (!instance) {
      throw new Error('Instance not found at calculated index');
    }
    return instance;
  }

  private leastConnectionsSelect(instances: InstanceInfo[]): InstanceInfo {
    return instances.reduce((min, current) => 
      current.connections < min.connections ? current : min
    );
  }

  private cpuBasedSelect(instances: InstanceInfo[]): InstanceInfo {
    return instances.reduce((min, current) => 
      current.cpuUsage < min.cpuUsage ? current : min
    );
  }

  private weightedSelect(instances: InstanceInfo[]): InstanceInfo {
    if (instances.length === 0) {
      throw new Error('No instances available for weighted selection');
    }
    
    const weights = this.config.weights || {};
    const weightedInstances = instances.map(instance => ({
      instance,
      weight: weights[instance.id] || 1
    }));
    
    const totalWeight = weightedInstances.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const item of weightedInstances) {
      random -= item.weight;
      if (random <= 0) {
        return item.instance;
      }
    }
    
    // Fallback to first instance if no selection made
    const fallbackInstance = weightedInstances[0]?.instance;
    if (!fallbackInstance) {
      throw new Error('No fallback instance available');
    }
    return fallbackInstance;
  }

  canAcceptConnection(): boolean {
    const instance = this.instances.get(this.currentInstanceId);
    if (!instance) return false;
    
    return (
      instance.isHealthy &&
      instance.connections < instance.maxConnections &&
      this.circuitBreakerState !== 'open'
    );
  }

  async getStatus(): Promise<LoadBalancerStatus> {
    const instances = Array.from(this.instances.values());
    const healthyInstances = instances.filter(i => i.isHealthy);
    const totalConnections = instances.reduce((sum, i) => sum + i.connections, 0);
    const averageLoad = instances.length > 0 
      ? totalConnections / instances.length 
      : 0;
    
    return {
      instanceId: this.currentInstanceId,
      algorithm: this.config.algorithm,
      totalInstances: instances.length,
      healthyInstances: healthyInstances.length,
      totalConnections,
      averageLoad: Math.round(averageLoad * 100) / 100,
      circuitBreakerState: this.circuitBreakerState,
      instances: instances.sort((a, b) => a.id.localeCompare(b.id))
    };
  }

  getConnectionCount(): number {
    return this.instances.get(this.currentInstanceId)?.connections || 0;
  }

  isInstanceHealthy(): boolean {
    return this.instances.get(this.currentInstanceId)?.isHealthy || false;
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    // Remove instance from Redis
    if (this.config.redis?.enabled && this.redisManager) {
      const key = `${this.config.redis.keyPrefix || 'lb:'}instances:${this.currentInstanceId}`;
      await this.redisManager.del(key);
    }
    
    logger.info('LoadBalancer shutdown completed', { 
      instanceId: this.currentInstanceId 
    });
  }
} 