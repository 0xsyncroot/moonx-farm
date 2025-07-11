import * as cron from 'node-cron';
import { StatsAggregator } from '../services/statsAggregator';
import { StatsWorkerConfig, JobConfig } from '../types/index';
import { logger } from '../utils/logger';

export interface ScheduledJob {
  name: string;
  schedule: string;
  task: cron.ScheduledTask;
  isRunning: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  errorCount: number;
}

export class StatsScheduler {
  private aggregator: StatsAggregator;
  private config: StatsWorkerConfig;
  private jobs: Map<string, ScheduledJob> = new Map();
  private isStarted = false;

  constructor(aggregator: StatsAggregator, config: StatsWorkerConfig) {
    this.aggregator = aggregator;
    this.config = config;
  }

  /**
   * Start all scheduled jobs
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('Scheduler already started');
      return;
    }

    try {
      logger.info('Starting stats scheduler', {
        jobsCount: this.config.jobs.length
      });

      // Setup jobs from configuration
      for (const jobConfig of this.config.jobs) {
        if (jobConfig.enabled) {
          await this.setupJob(jobConfig);
        }
      }

      // Setup default jobs if no jobs configured
      if (this.config.jobs.length === 0) {
        await this.setupDefaultJobs();
      }

      this.isStarted = true;
      logger.info('Stats scheduler started successfully', {
        activeJobs: this.getActiveJobs().length
      });
    } catch (error) {
      logger.error('Failed to start scheduler', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Stop all scheduled jobs
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      logger.warn('Scheduler not started');
      return;
    }

    try {
      logger.info('Stopping stats scheduler');

      // Stop all jobs
      for (const [name, job] of this.jobs) {
        logger.debug('Stopping job', { name });
        job.task.stop();
      }

      // Wait for running jobs to complete
      await this.waitForRunningJobs();

      this.jobs.clear();
      this.isStarted = false;

      logger.info('Stats scheduler stopped successfully');
    } catch (error) {
      logger.error('Failed to stop scheduler', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Setup a job from configuration
   */
  private async setupJob(jobConfig: JobConfig): Promise<void> {
    try {
      const task = cron.schedule(jobConfig.schedule, async () => {
        await this.executeJob(jobConfig.name);
      }, {
        scheduled: false,
        timezone: 'UTC'
      });

      const scheduledJob: ScheduledJob = {
        name: jobConfig.name,
        schedule: jobConfig.schedule,
        task,
        isRunning: false,
        runCount: 0,
        errorCount: 0
      };

      this.jobs.set(jobConfig.name, scheduledJob);
      task.start();

      logger.info('Job scheduled', {
        name: jobConfig.name,
        schedule: jobConfig.schedule
      });
    } catch (error) {
      logger.error('Failed to setup job', {
        jobName: jobConfig.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Setup default jobs if no configuration provided
   */
  private async setupDefaultJobs(): Promise<void> {
    const defaultJobs: JobConfig[] = [
      {
        name: 'full_stats_collection',
        schedule: '*/5 * * * *', // Every 5 minutes
        enabled: true,
        timeout: 120000, // 2 minutes
        retryAttempts: 3
      },
      {
        name: 'chain_performance_only',
        schedule: '*/1 * * * *', // Every 1 minute
        enabled: true,
        timeout: 60000, // 1 minute
        retryAttempts: 2
      },
      {
        name: 'bridge_latency_only',
        schedule: '*/2 * * * *', // Every 2 minutes
        enabled: true,
        timeout: 90000, // 1.5 minutes
        retryAttempts: 2
      }
    ];

    for (const jobConfig of defaultJobs) {
      await this.setupJob(jobConfig);
    }
  }

  /**
   * Execute a job by name
   */
  private async executeJob(jobName: string): Promise<void> {
    const job = this.jobs.get(jobName);
    if (!job) {
      logger.warn('Job not found', { jobName });
      return;
    }

    if (job.isRunning) {
      logger.warn('Job already running, skipping', { jobName });
      return;
    }

    job.isRunning = true;
    job.lastRun = new Date();
    job.runCount++;

    const startTime = Date.now();
    const jobLogger = logger.child({ jobName, runCount: job.runCount });

    try {
      jobLogger.info('Job started');

      // Execute based on job type
      switch (jobName) {
        case 'full_stats_collection':
          await this.aggregator.collectAllStats();
          break;
        case 'chain_performance_only':
          await this.aggregator.collectAndPublishChainStats();
          break;
        case 'bridge_latency_only':
          await this.aggregator.collectAndPublishBridgeStats();
          break;
        default:
          throw new Error(`Unknown job type: ${jobName}`);
      }

      const duration = Date.now() - startTime;
      jobLogger.info('Job completed successfully', { duration });

    } catch (error) {
      job.errorCount++;
      const duration = Date.now() - startTime;
      
      jobLogger.error('Job failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        errorCount: job.errorCount
      });

      // Retry logic could be added here if needed
      
    } finally {
      job.isRunning = false;
      
      // Update next run time - we'll calculate it differently or set to undefined for now
      job.nextRun = undefined;
    }
  }

  /**
   * Wait for all running jobs to complete
   */
  private async waitForRunningJobs(timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const runningJobs = Array.from(this.jobs.values()).filter(job => job.isRunning);
      
      if (runningJobs.length === 0) {
        return;
      }

      logger.debug('Waiting for running jobs to complete', {
        runningJobs: runningJobs.map(job => job.name)
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.warn('Timeout waiting for running jobs to complete');
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get job by name
   */
  getJob(name: string): ScheduledJob | undefined {
    return this.jobs.get(name);
  }

  /**
   * Get job statistics
   */
  getJobStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [name, job] of this.jobs) {
      stats[name] = {
        isRunning: job.isRunning,
        runCount: job.runCount,
        errorCount: job.errorCount,
        lastRun: job.lastRun,
        nextRun: job.nextRun,
        schedule: job.schedule
      };
    }

    return stats;
  }

  /**
   * Add a new job dynamically
   */
  async addJob(jobConfig: JobConfig): Promise<void> {
    if (this.jobs.has(jobConfig.name)) {
      throw new Error(`Job ${jobConfig.name} already exists`);
    }

    await this.setupJob(jobConfig);
    logger.info('Job added dynamically', { jobName: jobConfig.name });
  }

  /**
   * Remove a job dynamically
   */
  async removeJob(jobName: string): Promise<void> {
    const job = this.jobs.get(jobName);
    if (!job) {
      throw new Error(`Job ${jobName} not found`);
    }

    // Stop the job
    job.task.stop();
    
    // Wait for it to complete if running
    if (job.isRunning) {
      await this.waitForSpecificJob(jobName);
    }

    this.jobs.delete(jobName);
    logger.info('Job removed', { jobName });
  }

  /**
   * Wait for a specific job to complete
   */
  private async waitForSpecificJob(jobName: string, timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const job = this.jobs.get(jobName);
      if (!job || !job.isRunning) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.warn('Timeout waiting for job to complete', { jobName });
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isStarted: boolean;
    totalJobs: number;
    runningJobs: number;
    totalRuns: number;
    totalErrors: number;
  } {
    const jobs = Array.from(this.jobs.values());
    
    return {
      isStarted: this.isStarted,
      totalJobs: jobs.length,
      runningJobs: jobs.filter(job => job.isRunning).length,
      totalRuns: jobs.reduce((sum, job) => sum + job.runCount, 0),
      totalErrors: jobs.reduce((sum, job) => sum + job.errorCount, 0)
    };
  }
} 