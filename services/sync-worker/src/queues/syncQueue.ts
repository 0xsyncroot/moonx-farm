import { config } from '@/config';
import { SyncJobData, SyncJobResult, Priority, QueueStats } from '@/types';
import { logger } from '@/utils/logger';

// Job interface for internal queue management
interface QueueJob {
  id: string;
  data: SyncJobData;
  priority: Priority;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: SyncJobResult;
  error?: string;
  delay?: number;
}

// Job processor function type
type JobProcessor = (job: QueueJob) => Promise<SyncJobResult>;

// Priority mapping
const priorityMap: Record<Priority, number> = {
  high: 1,
  medium: 5,
  low: 10,
};

export class SyncQueue {
  private jobs: Map<string, QueueJob> = new Map();
  private waitingJobs: QueueJob[] = [];
  private activeJobs: QueueJob[] = [];
  private completedJobs: QueueJob[] = [];
  private failedJobs: QueueJob[] = [];
  private processor?: JobProcessor;
  private isStarted = false;
  private isPaused = false;
  private workerInterval?: NodeJS.Timeout;
  private jobCounter = 0;

  constructor(private name: string = 'sync-queue') {
    logger.info(`📦 Queue created: ${name}`);
  }

  /**
   * Initialize worker with job processor
   */
  initializeWorker(processor: JobProcessor): void {
    this.processor = processor;
    logger.info(`🔧 Worker initialized for queue: ${this.name}`);
  }

  /**
   * Add sync job to queue
   */
  async addSyncJob(
    jobData: SyncJobData,
    options: {
      priority?: Priority;
      delay?: number;
      jobId?: string;
      removeOnComplete?: number;
      removeOnFail?: number;
    } = {}
  ): Promise<string> {
    try {
      const jobId = options.jobId || `job_${++this.jobCounter}_${Date.now()}`;
      
      const job: QueueJob = {
        id: jobId,
        data: jobData,
        priority: options.priority || 'medium',
        status: 'waiting',
        attempts: 0,
        maxAttempts: config.worker.retryAttempts,
        createdAt: new Date(),
        ...(options.delay && { delay: options.delay }),
      };

      this.jobs.set(jobId, job);
      
      // Add to waiting jobs queue (sorted by priority)
      this.waitingJobs.push(job);
      this.sortWaitingJobs();

      logger.info(`📨 Sync job queued`, {
        jobId,
        userId: jobData.userId,
        walletAddress: jobData.walletAddress,
        priority: job.priority,
        delay: options.delay || 0,
      });

      return jobId;
    } catch (error) {
      logger.error(`Failed to queue sync job`, {
        error: error instanceof Error ? error.message : String(error),
        userId: jobData.userId,
        walletAddress: jobData.walletAddress,
      });
      throw error;
    }
  }

  /**
   * Add batch sync jobs
   */
  async addBatchSyncJobs(
    jobsData: Array<{
      data: SyncJobData;
      options?: {
        priority?: Priority;
        delay?: number;
        jobId?: string;
      };
    }>
  ): Promise<string[]> {
    try {
      const jobIds: string[] = [];

      for (const { data, options = {} } of jobsData) {
        const jobId = await this.addSyncJob(data, options);
        jobIds.push(jobId);
      }

      logger.info(`📨 Batch sync jobs queued`, {
        count: jobsData.length,
        jobIds,
      });

      return jobIds;
    } catch (error) {
      logger.error(`Failed to queue batch sync jobs`, {
        error: error instanceof Error ? error.message : String(error),
        count: jobsData.length,
      });
      throw error;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<{
    id: string;
    status: string;
    progress: number;
    result?: SyncJobResult;
    error?: string;
    createdAt: Date;
    processedAt?: Date;
    finishedAt?: Date;
  } | null> {
    try {
      const job = this.jobs.get(jobId);
      
      if (!job) {
        return null;
      }

      return {
        id: job.id,
        status: job.status,
        progress: job.status === 'completed' ? 100 : job.status === 'active' ? 50 : 0,
        ...(job.result && { result: job.result }),
        ...(job.error && { error: job.error }),
        createdAt: job.createdAt,
        ...(job.startedAt && { processedAt: job.startedAt }),
        ...(job.completedAt && { finishedAt: job.completedAt }),
      };
    } catch (error) {
      logger.error(`Failed to get job status`, {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Cancel job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = this.jobs.get(jobId);
      
      if (!job) {
        return false;
      }

      // Remove from waiting queue
      this.waitingJobs = this.waitingJobs.filter(j => j.id !== jobId);
      
      // Remove from jobs map
      this.jobs.delete(jobId);
      
      logger.info(`🚫 Job cancelled`, { jobId });
      return true;
    } catch (error) {
      logger.error(`Failed to cancel job`, {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    try {
      return {
        name: this.name,
        waiting: this.waitingJobs.length,
        active: this.activeJobs.length,
        completed: this.completedJobs.length,
        failed: this.failedJobs.length,
        delayed: this.waitingJobs.filter(job => job.delay && job.delay > 0).length,
        paused: this.isPaused,
      };
    } catch (error) {
      logger.error(`Failed to get queue stats`, {
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        name: this.name,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: false,
      };
    }
  }

  /**
   * Clean old jobs
   */
  async cleanJobs(grace: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const now = Date.now();
      
      // Clean completed jobs
      this.completedJobs = this.completedJobs.filter(job => {
        const jobAge = now - (job.completedAt?.getTime() || 0);
        return jobAge < grace;
      });

      // Clean failed jobs
      this.failedJobs = this.failedJobs.filter(job => {
        const jobAge = now - (job.completedAt?.getTime() || 0);
        return jobAge < grace;
      });
      
      logger.info(`🧹 Cleaned old jobs`, {
        grace: `${grace / 1000}s`,
        queueName: this.name,
      });
    } catch (error) {
      logger.error(`Failed to clean jobs`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Pause queue
   */
  async pauseQueue(): Promise<void> {
    try {
      this.isPaused = true;
      logger.info(`⏸️ Queue paused`, { queueName: this.name });
    } catch (error) {
      logger.error(`Failed to pause queue`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Resume queue
   */
  async resumeQueue(): Promise<void> {
    try {
      this.isPaused = false;
      logger.info(`▶️ Queue resumed`, { queueName: this.name });
    } catch (error) {
      logger.error(`Failed to resume queue`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Start worker
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('Queue already started');
      return;
    }

    if (!this.processor) {
      throw new Error('Worker not initialized. Call initializeWorker() first.');
    }

    try {
      this.isStarted = true;
      this.startWorker();
      
      logger.info(`🚀 Sync queue started`, {
        queueName: this.name,
        concurrency: config.worker.concurrency,
      });
    } catch (error) {
      logger.error(`Failed to start queue`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Stop worker and queue
   */
  async stop(): Promise<void> {
    try {
      this.isStarted = false;
      
      if (this.workerInterval) {
        clearInterval(this.workerInterval);
      }
      
      logger.info(`🛑 Sync queue stopped`, { queueName: this.name });
    } catch (error) {
      logger.error(`Failed to stop queue`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Sort waiting jobs by priority
   */
  private sortWaitingJobs(): void {
    this.waitingJobs.sort((a, b) => {
      return priorityMap[a.priority] - priorityMap[b.priority];
    });
  }

  /**
   * Start worker processing
   */
  private startWorker(): void {
    this.workerInterval = setInterval(async () => {
      if (this.isPaused || !this.processor) {
        return;
      }

      // Process jobs up to concurrency limit
      const concurrencyLimit = config.worker.concurrency;
      const availableSlots = concurrencyLimit - this.activeJobs.length;
      
      if (availableSlots <= 0) {
        return;
      }

      // Get next jobs to process
      const jobsToProcess = this.waitingJobs.splice(0, availableSlots);
      
      for (const job of jobsToProcess) {
        this.processJob(job);
      }
    }, 1000); // Check every second
  }

  /**
   * Process individual job
   */
  private async processJob(job: QueueJob): Promise<void> {
    try {
      // Move to active jobs
      job.status = 'active';
      job.startedAt = new Date();
      this.activeJobs.push(job);
      
      logger.debug(`🔄 Processing job`, { jobId: job.id });

      // Process the job
      const result = await this.processor!(job);
      
      // Mark as completed
      job.status = 'completed';
      job.completedAt = new Date();
      job.result = result;
      
      // Move to completed jobs
      this.activeJobs = this.activeJobs.filter(j => j.id !== job.id);
      this.completedJobs.push(job);
      
      logger.info(`✅ Job completed`, {
        jobId: job.id,
        duration: job.completedAt.getTime() - job.startedAt!.getTime(),
        tokensSync: result.tokensSync,
        totalValueUsd: result.totalValueUsd,
      });
      
    } catch (error) {
      // Handle job failure
      job.attempts++;
      job.error = error instanceof Error ? error.message : String(error);
      
      // Remove from active jobs
      this.activeJobs = this.activeJobs.filter(j => j.id !== job.id);
      
      if (job.attempts >= job.maxAttempts) {
        // Mark as failed
        job.status = 'failed';
        job.completedAt = new Date();
        this.failedJobs.push(job);
        
        logger.error(`❌ Job failed`, {
          jobId: job.id,
          error: job.error,
          attempts: job.attempts,
        });
      } else {
        // Retry job
        job.status = 'waiting';
        this.waitingJobs.push(job);
        this.sortWaitingJobs();
        
        logger.warn(`🔄 Job retrying`, {
          jobId: job.id,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
        });
      }
    }
  }
} 