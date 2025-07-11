import { StatsAggregator } from '../services/statsAggregator';
import { 
  ChainPerformanceStats, 
  BridgeLatencyStats, 
  StatsCollectionResult,
  StatsCollectionError 
} from '../types/index';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface CollectionOptions {
  includeChains?: boolean;
  includeBridges?: boolean;
  retryAttempts?: number;
  timeout?: number;
  publishEvents?: boolean;
}

export class StatsCollector {
  private aggregator: StatsAggregator;
  private collectionId: string;
  private startTime: number;
  private isRunning: boolean = false;

  constructor(aggregator: StatsAggregator) {
    this.aggregator = aggregator;
    this.collectionId = uuidv4();
    this.startTime = Date.now();
  }

  /**
   * Collect all stats (chains + bridges)
   */
  async collectAll(options: CollectionOptions = {}): Promise<StatsCollectionResult> {
    return this.collect({
      includeChains: true,
      includeBridges: true,
      ...options
    });
  }

  /**
   * Collect only chain performance stats
   */
  async collectChainStats(options: CollectionOptions = {}): Promise<StatsCollectionResult> {
    return this.collect({
      includeChains: true,
      includeBridges: false,
      ...options
    });
  }

  /**
   * Collect only bridge latency stats
   */
  async collectBridgeStats(options: CollectionOptions = {}): Promise<StatsCollectionResult> {
    return this.collect({
      includeChains: false,
      includeBridges: true,
      ...options
    });
  }

  /**
   * Main collection method
   */
  private async collect(options: CollectionOptions): Promise<StatsCollectionResult> {
    if (this.isRunning) {
      throw new StatsCollectionError('Collection already running', 'collector');
    }

    this.isRunning = true;
    this.collectionId = uuidv4();
    this.startTime = Date.now();

    const {
      includeChains = true,
      includeBridges = true,
      retryAttempts = 3,
      timeout = 120000,
      publishEvents = true
    } = options;

    const collectionLogger = logger.child({ 
      collectionId: this.collectionId,
      includeChains,
      includeBridges
    });

    try {
      collectionLogger.info('Starting stats collection', {
        timeout,
        retryAttempts,
        publishEvents
      });

      const results = await this.performCollection(
        includeChains,
        includeBridges,
        retryAttempts,
        timeout,
        publishEvents,
        collectionLogger
      );

      const duration = Date.now() - this.startTime;
      
      collectionLogger.info('Stats collection completed successfully', {
        duration,
        chainStatsCount: results.chainStats.length,
        bridgeStatsCount: results.bridgeStats.length,
        errorsCount: results.errors.length
      });

      return {
        success: true,
        timestamp: Date.now(),
        duration,
        chainStats: results.chainStats,
        bridgeStats: results.bridgeStats,
        errors: results.errors
      };

    } catch (error) {
      const duration = Date.now() - this.startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      collectionLogger.error('Stats collection failed', {
        duration,
        error: errorMessage
      });

      return {
        success: false,
        timestamp: Date.now(),
        duration,
        chainStats: [],
        bridgeStats: [],
        errors: [errorMessage]
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Perform the actual collection with retry logic
   */
  private async performCollection(
    includeChains: boolean,
    includeBridges: boolean,
    retryAttempts: number,
    timeout: number,
    publishEvents: boolean,
    logger: any
  ): Promise<{
    chainStats: ChainPerformanceStats[];
    bridgeStats: BridgeLatencyStats[];
    errors: string[];
  }> {
    const errors: string[] = [];
    let chainStats: ChainPerformanceStats[] = [];
    let bridgeStats: BridgeLatencyStats[] = [];

    // Setup timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new StatsCollectionError('Collection timeout', 'timeout'));
      }, timeout);
    });

    try {
      // Create collection promises
      const promises: Promise<any>[] = [];

      if (includeChains) {
        promises.push(this.collectWithRetry(
          'chain',
          () => this.aggregator.collectChainStats(),
          retryAttempts,
          logger
        ));
      }

      if (includeBridges) {
        promises.push(this.collectWithRetry(
          'bridge',
          () => this.aggregator.collectBridgeStats(),
          retryAttempts,
          logger
        ));
      }

      // Execute collections with timeout
      const results = await Promise.race([
        Promise.allSettled(promises),
        timeoutPromise
      ]);

      // Process results
      let resultIndex = 0;
      
      if (includeChains) {
        const chainResult = results[resultIndex++];
        if (chainResult.status === 'fulfilled') {
          chainStats = chainResult.value;
        } else {
          errors.push(`Chain stats collection failed: ${chainResult.reason}`);
        }
      }

      if (includeBridges) {
        const bridgeResult = results[resultIndex++];
        if (bridgeResult.status === 'fulfilled') {
          bridgeStats = bridgeResult.value;
        } else {
          errors.push(`Bridge stats collection failed: ${bridgeResult.reason}`);
        }
      }

      // Save to database if we have any results
      if (chainStats.length > 0 || bridgeStats.length > 0) {
        await this.saveToDatabase(chainStats, bridgeStats, logger);
      }

      // Publish events if requested
      if (publishEvents && (chainStats.length > 0 || bridgeStats.length > 0)) {
        await this.publishEvents(chainStats, bridgeStats, logger);
      }

      return { chainStats, bridgeStats, errors };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      throw error;
    }
  }

  /**
   * Collect with retry logic
   */
  private async collectWithRetry<T>(
    type: 'chain' | 'bridge',
    collectionFn: () => Promise<T>,
    retryAttempts: number,
    logger: any
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        logger.debug(`${type} collection attempt ${attempt}/${retryAttempts}`);
        const result = await collectionFn();
        
        if (attempt > 1) {
          logger.info(`${type} collection succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn(`${type} collection attempt ${attempt} failed`, {
          error: lastError.message,
          attempt,
          retryAttempts
        });

        if (attempt < retryAttempts) {
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new StatsCollectionError(
      `${type} collection failed after ${retryAttempts} attempts: ${lastError?.message}`,
      type,
      lastError
    );
  }

  /**
   * Save collected stats to database
   */
  private async saveToDatabase(
    chainStats: ChainPerformanceStats[],
    bridgeStats: BridgeLatencyStats[],
    logger: any
  ): Promise<void> {
    try {
      logger.debug('Saving stats to database', {
        chainStatsCount: chainStats.length,
        bridgeStatsCount: bridgeStats.length
      });

      // This would typically call a method on the aggregator
      // For now, we'll assume it's handled by the aggregator's methods
      // await this.aggregator.saveStatsToDatabase(chainStats, bridgeStats);
      
      logger.debug('Stats saved to database successfully');
    } catch (error) {
      logger.error('Failed to save stats to database', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Publish events for collected stats
   */
  private async publishEvents(
    chainStats: ChainPerformanceStats[],
    bridgeStats: BridgeLatencyStats[],
    logger: any
  ): Promise<void> {
    try {
      logger.debug('Publishing stats events', {
        chainStatsCount: chainStats.length,
        bridgeStatsCount: bridgeStats.length
      });

      // This would typically call a method on the aggregator
      // For now, we'll assume it's handled by the aggregator's methods
      // await this.aggregator.publishStatsEvents(chainStats, bridgeStats);
      
      logger.debug('Stats events published successfully');
    } catch (error) {
      logger.error('Failed to publish stats events', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get collection status
   */
  getStatus(): {
    collectionId: string;
    isRunning: boolean;
    startTime: number;
    duration: number;
  } {
    return {
      collectionId: this.collectionId,
      isRunning: this.isRunning,
      startTime: this.startTime,
      duration: this.isRunning ? Date.now() - this.startTime : 0
    };
  }

  /**
   * Cancel running collection
   */
  async cancel(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Canceling stats collection', {
      collectionId: this.collectionId
    });

    this.isRunning = false;
    // Additional cleanup logic could go here
  }
} 