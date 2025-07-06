import { createLogger } from '@moonx-farm/common';
import { redisService } from '../services/redisService';
import { PrometheusService } from '../services/prometheusService';

const logger = createLogger('BaseWorker');

export interface WorkerJob {
  id: string;
  type: string;
  payload: any;
  priority: 'high' | 'medium' | 'low';
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledAt?: Date;
  lastAttempt?: Date;
  metadata?: any;
}

export interface WorkerOptions {
  name: string;
  concurrency: number;
  pollInterval: number;
  maxRetries: number;
  retryDelay: number;
  deadLetterQueue?: string;
}

export abstract class BaseWorker {
  protected name: string;
  protected concurrency: number;
  protected pollInterval: number;
  protected maxRetries: number;
  protected retryDelay: number;
  protected deadLetterQueue?: string;
  protected isRunning: boolean = false;
  protected activeJobs: Map<string, Promise<void>> = new Map();
  protected prometheusService: PrometheusService;

  constructor(options: WorkerOptions) {
    this.name = options.name;
    this.concurrency = options.concurrency;
    this.pollInterval = options.pollInterval;
    this.maxRetries = options.maxRetries;
    this.retryDelay = options.retryDelay;
    if (options.deadLetterQueue !== undefined) {
      this.deadLetterQueue = options.deadLetterQueue;
    }
    this.prometheusService = new PrometheusService();
  }

  abstract getQueueName(): string;
  abstract processJob(job: WorkerJob): Promise<void>;

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn(`Worker ${this.name} is already running`);
      return;
    }

    this.isRunning = true;
    logger.info(`Starting worker ${this.name} with concurrency ${this.concurrency}`);

    // Start multiple concurrent processors
    for (let i = 0; i < this.concurrency; i++) {
      this.startProcessor(`${this.name}-${i}`);
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info(`Stopping worker ${this.name}...`);
    this.isRunning = false;

    // Wait for all active jobs to complete
    const activeJobPromises = Array.from(this.activeJobs.values());
    await Promise.allSettled(activeJobPromises);

    logger.info(`Worker ${this.name} stopped`);
  }

  private async startProcessor(processorId: string): Promise<void> {
    logger.info(`Starting processor ${processorId}`);

    while (this.isRunning) {
      try {
        const job = await this.getNextJob();
        
        if (job) {
          const jobPromise = this.executeJob(job, processorId);
          this.activeJobs.set(job.id, jobPromise);
          
          // Remove from active jobs when complete
          jobPromise.finally(() => {
            this.activeJobs.delete(job.id);
          });
        } else {
          // No jobs available, wait before next poll
          await this.sleep(this.pollInterval);
        }
      } catch (error) {
        logger.error(`Error in processor ${processorId}: ${error}`);
        await this.sleep(this.pollInterval);
      }
    }
  }

  private async getNextJob(): Promise<WorkerJob | null> {
    try {
      const redis = redisService.getRedis();
      const queueName = this.getQueueName();
      
      // Get job from queue (blocking pop with timeout)
      const result = await redis.command('BRPOP', queueName, 1);
      
      if (result && Array.isArray(result) && result.length === 2) {
        const jobData = JSON.parse(result[1] as string);
        return this.deserializeJob(jobData);
      }
      
      return null;
    } catch (error) {
      logger.error(`Error getting next job: ${error}`);
      return null;
    }
  }

  private async executeJob(job: WorkerJob, processorId: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info(`Processor ${processorId} executing job ${job.id} (attempt ${job.attempts + 1})`);
      
      // Update job attempt count
      job.attempts++;
      job.lastAttempt = new Date();
      
      // Process the job
      await this.processJob(job);
      
      // Record success metrics
      const processingTime = Date.now() - startTime;
      this.recordJobSuccess(job, processingTime);
      
      logger.info(`Job ${job.id} completed successfully in ${processingTime}ms`);
      
    } catch (error) {
      logger.error(`Job ${job.id} failed: ${error}`);
      
      // Handle job failure
      await this.handleJobFailure(job, error as Error);
      
      // Record failure metrics
      this.recordJobFailure(job, error as Error);
    }
  }

  private async handleJobFailure(job: WorkerJob, error: Error): Promise<void> {
    if (job.attempts >= this.maxRetries) {
      logger.error(`Job ${job.id} exceeded max retries (${this.maxRetries}), moving to DLQ`);
      
      if (this.deadLetterQueue) {
        await this.moveToDeadLetterQueue(job, error);
      }
    } else {
      // Retry job with exponential backoff
      const delay = this.calculateRetryDelay(job.attempts);
      logger.info(`Retrying job ${job.id} in ${delay}ms`);
      
      await this.scheduleRetry(job, delay);
    }
  }

  private async scheduleRetry(job: WorkerJob, delay: number): Promise<void> {
    try {
      const redis = redisService.getRedis();
      const retryQueueName = `${this.getQueueName()}:retry`;
      
      // Schedule job for retry
      const retryTime = Date.now() + delay;
      await redis.command('ZADD', retryQueueName, retryTime, JSON.stringify(job));
      
    } catch (error) {
      logger.error(`Error scheduling retry for job ${job.id}: ${error}`);
    }
  }

  private async moveToDeadLetterQueue(job: WorkerJob, error: Error): Promise<void> {
    try {
      const redis = redisService.getRedis();
      const dlqName = this.deadLetterQueue || `${this.getQueueName()}:dlq`;
      
      const dlqJob = {
        ...job,
        failureReason: error.message,
        failedAt: new Date(),
        originalQueue: this.getQueueName()
      };
      
      await redis.command('LPUSH', dlqName, JSON.stringify(dlqJob));
      
    } catch (dlqError) {
      logger.error(`Error moving job ${job.id} to DLQ: ${dlqError}`);
    }
  }

  private calculateRetryDelay(attempts: number): number {
    // Exponential backoff with jitter
    const baseDelay = this.retryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, attempts - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    
    return Math.min(exponentialDelay + jitter, 300000); // Max 5 minutes
  }

  private deserializeJob(jobData: any): WorkerJob {
    const job: WorkerJob = {
      id: jobData.id,
      type: jobData.type,
      payload: jobData.payload,
      priority: jobData.priority,
      attempts: jobData.attempts || 0,
      maxAttempts: jobData.maxAttempts || this.maxRetries,
      createdAt: new Date(jobData.createdAt),
      metadata: jobData.metadata
    };
    
    if (jobData.scheduledAt) {
      job.scheduledAt = new Date(jobData.scheduledAt);
    }
    
    if (jobData.lastAttempt) {
      job.lastAttempt = new Date(jobData.lastAttempt);
    }
    
    return job;
  }

  private recordJobSuccess(job: WorkerJob, processingTime: number): void {
    // Record metrics with Prometheus
    // TODO: Implement proper metrics recording
    logger.info(`Job ${job.id} completed in ${processingTime}ms`);
  }

  private recordJobFailure(job: WorkerJob, error: Error): void {
    // Record metrics with Prometheus
    // TODO: Implement proper metrics recording
    logger.error(`Job ${job.id} failed: ${error.message}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for queue management
  async addJob(job: Omit<WorkerJob, 'id' | 'attempts' | 'createdAt'>): Promise<void> {
    try {
      const redis = redisService.getRedis();
      const queueName = this.getQueueName();
      
      const fullJob: WorkerJob = {
        id: this.generateJobId(),
        attempts: 0,
        createdAt: new Date(),
        ...job
      };
      
      await redis.command('LPUSH', queueName, JSON.stringify(fullJob));
      
    } catch (error) {
      logger.error(`Error adding job to queue: ${error}`);
      throw error;
    }
  }

  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    retry: number;
    dlq: number;
  }> {
    try {
      const redis = redisService.getRedis();
      const queueName = this.getQueueName();
      
      const [waiting, retry, dlq] = await Promise.all([
        redis.command('LLEN', queueName),
        redis.command('ZCARD', `${queueName}:retry`),
        redis.command('LLEN', this.deadLetterQueue || `${queueName}:dlq`)
      ]);
      
      return {
        waiting: waiting as number,
        active: this.activeJobs.size,
        completed: 0, // TODO: Implement completed job tracking
        failed: 0,    // TODO: Implement failed job tracking
        retry: retry as number,
        dlq: dlq as number
      };
    } catch (error) {
      logger.error(`Error getting queue stats: ${error}`);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        retry: 0,
        dlq: 0
      };
    }
  }

  private generateJobId(): string {
    return `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Getters
  get isActive(): boolean {
    return this.isRunning;
  }

  get activeJobCount(): number {
    return this.activeJobs.size;
  }

  get workerName(): string {
    return this.name;
  }
} 