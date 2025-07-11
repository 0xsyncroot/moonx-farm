import { config } from '@/config';
import { logger } from '@/utils/logger';

interface MetricValue {
  value: number;
  timestamp: Date;
  labels?: Record<string, string> | undefined;
}

interface Counter extends MetricValue {
  type: 'counter';
}

interface Gauge extends MetricValue {
  type: 'gauge';
}

interface Histogram extends MetricValue {
  type: 'histogram';
  buckets: Record<string, number>;
}

type Metric = Counter | Gauge | Histogram;

export class MetricsCollector {
  private metrics: Map<string, Metric[]> = new Map();
  private isRunning = false;
  private metricsInterval?: NodeJS.Timeout;
  private maxMetricsHistory = 1000; // Keep last 1000 metric points per type

  constructor() {
    logger.info('📊 Metrics collector initialized');
  }

  /**
   * Start metrics collection
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Metrics collector already running');
      return;
    }

    try {
      this.isRunning = true;

      // Collect system metrics periodically
      this.metricsInterval = setInterval(() => {
        this.collectSystemMetrics();
      }, config.monitoring.metricsInterval);

      logger.info('📊 Metrics collection started', {
        interval: config.monitoring.metricsInterval,
      });

    } catch (error) {
      logger.error('Failed to start metrics collector', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Stop metrics collection
   */
  async stop(): Promise<void> {
    try {
      this.isRunning = false;

      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
      }

      logger.info('📊 Metrics collection stopped');
    } catch (error) {
      logger.error('Error stopping metrics collector', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    try {
      const metric: Counter = {
        type: 'counter',
        value,
        timestamp: new Date(),
        labels,
      };

      this.addMetric(name, metric);

      logger.debug('Counter incremented', {
        name,
        value,
        labels,
      });
    } catch (error) {
      logger.error('Error incrementing counter', {
        name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Set a gauge metric
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    try {
      const metric: Gauge = {
        type: 'gauge',
        value,
        timestamp: new Date(),
        labels,
      };

      this.addMetric(name, metric);

      logger.debug('Gauge set', {
        name,
        value,
        labels,
      });
    } catch (error) {
      logger.error('Error setting gauge', {
        name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Record a histogram metric
   */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    try {
      // Define histogram buckets
      const buckets = this.createHistogramBuckets(value);

      const metric: Histogram = {
        type: 'histogram',
        value,
        timestamp: new Date(),
        labels,
        buckets,
      };

      this.addMetric(name, metric);

      logger.debug('Histogram recorded', {
        name,
        value,
        labels,
      });
    } catch (error) {
      logger.error('Error recording histogram', {
        name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Record sync job metrics
   */
  recordSyncJobStart(jobId: string, userId: string, priority: string): void {
    this.incrementCounter('sync_jobs_started_total', 1, {
      priority,
      user_id: userId,
    });

    this.setGauge('sync_jobs_active', this.getActiveJobsCount() + 1);
  }

  /**
   * Record sync job completion
   */
  recordSyncJobComplete(
    jobId: string,
    userId: string,
    priority: string,
    duration: number,
    success: boolean,
    tokensCount: number = 0,
    totalValue: number = 0
  ): void {
    // Increment completion counter
    this.incrementCounter('sync_jobs_completed_total', 1, {
      priority,
      user_id: userId,
      status: success ? 'success' : 'failure',
    });

    // Record processing time
    this.recordHistogram('sync_job_duration_ms', duration, {
      priority,
      status: success ? 'success' : 'failure',
    });

    // Record tokens synced
    if (success && tokensCount > 0) {
      this.recordHistogram('sync_tokens_count', tokensCount, {
        priority,
        user_id: userId,
      });
    }

    // Record total value synced
    if (success && totalValue > 0) {
      this.recordHistogram('sync_total_value_usd', totalValue, {
        priority,
        user_id: userId,
      });
    }

    // Update active jobs count
    this.setGauge('sync_jobs_active', Math.max(0, this.getActiveJobsCount() - 1));
  }

  /**
   * Record API metrics
   */
  recordApiCall(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number
  ): void {
    this.incrementCounter('api_requests_total', 1, {
      endpoint,
      method,
      status_code: statusCode.toString(),
    });

    this.recordHistogram('api_request_duration_ms', duration, {
      endpoint,
      method,
    });
  }

  /**
   * Record database metrics
   */
  recordDatabaseQuery(
    operation: string,
    duration: number,
    success: boolean
  ): void {
    this.incrementCounter('database_queries_total', 1, {
      operation,
      status: success ? 'success' : 'failure',
    });

    this.recordHistogram('database_query_duration_ms', duration, {
      operation,
    });
  }

  /**
   * Record cache metrics
   */
  recordCacheOperation(
    operation: 'get' | 'set' | 'del',
    hit: boolean,
    duration: number
  ): void {
    this.incrementCounter('cache_operations_total', 1, {
      operation,
      result: hit ? 'hit' : 'miss',
    });

    this.recordHistogram('cache_operation_duration_ms', duration, {
      operation,
    });
  }

  /**
   * Record circuit breaker metrics
   */
  recordCircuitBreakerEvent(
    userId: string,
    state: 'opened' | 'closed' | 'half-open'
  ): void {
    this.incrementCounter('circuit_breaker_events_total', 1, {
      user_id: userId,
      state,
    });
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    try {
      // Memory metrics
      const memoryUsage = process.memoryUsage();
      this.setGauge('process_memory_heap_used_bytes', memoryUsage.heapUsed);
      this.setGauge('process_memory_heap_total_bytes', memoryUsage.heapTotal);
      this.setGauge('process_memory_external_bytes', memoryUsage.external);

      // CPU metrics
      const loadAverage = require('os').loadavg();
      this.setGauge('system_load_average_1m', loadAverage[0]);
      this.setGauge('system_load_average_5m', loadAverage[1]);
      this.setGauge('system_load_average_15m', loadAverage[2]);

      // Process metrics
      this.setGauge('process_uptime_seconds', process.uptime());
      this.setGauge('process_cpu_usage_percent', process.cpuUsage().user / 1000000);

      // Node.js event loop metrics
      const eventLoopUtilization = (process as any).cpuUsage?.() || { user: 0, system: 0 };
      this.setGauge('nodejs_eventloop_utilization', eventLoopUtilization.user);

    } catch (error) {
      logger.error('Error collecting system metrics', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Add metric to storage
   */
  private addMetric(name: string, metric: Metric): void {
    try {
      let metrics = this.metrics.get(name);
      if (!metrics) {
        metrics = [];
        this.metrics.set(name, metrics);
      }

      metrics.push(metric);

      // Keep only recent metrics
      if (metrics.length > this.maxMetricsHistory) {
        metrics.shift();
      }
    } catch (error) {
      logger.error('Error adding metric', {
        name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Create histogram buckets
   */
  private createHistogramBuckets(value: number): Record<string, number> {
    const buckets: Record<string, number> = {
      '10': 0,
      '50': 0,
      '100': 0,
      '500': 0,
      '1000': 0,
      '5000': 0,
      '10000': 0,
      '+Inf': 0,
    };

    // Increment appropriate buckets
    Object.keys(buckets).forEach(bucket => {
      const threshold = bucket === '+Inf' ? Infinity : parseInt(bucket);
      if (value <= threshold) {
        buckets[bucket] = 1;
      }
    });

    return buckets;
  }

  /**
   * Get active jobs count (mock implementation)
   */
  private getActiveJobsCount(): number {
    // This would be implemented by tracking active jobs
    // For now, return 0 as placeholder
    return 0;
  }

  /**
   * Get metric values
   */
  getMetric(name: string): Metric[] {
    return this.metrics.get(name) || [];
  }

  /**
   * Get latest metric value
   */
  getLatestMetric(name: string): Metric | null {
    const metrics = this.getMetric(name);
    return metrics.length > 0 ? (metrics[metrics.length - 1] || null) : null;
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): Record<string, any> {
    const summary: Record<string, any> = {};

    for (const [name, metrics] of this.metrics.entries()) {
      if (metrics.length === 0) continue;

      const latestMetric = metrics[metrics.length - 1];
      if (!latestMetric) continue;
      
      summary[name] = {
        type: latestMetric.type,
        value: latestMetric.value,
        timestamp: latestMetric.timestamp,
        count: metrics.length,
      };

      // Add aggregated values for histograms
      if (latestMetric.type === 'histogram') {
        const values = metrics.map(m => m.value);
        summary[name].aggregations = {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          count: values.length,
        };
      }
    }

    return summary;
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    if (!config.monitoring.enablePrometheus) {
      return '';
    }

    const lines: string[] = [];
    const now = Date.now();

    for (const [name, metrics] of this.metrics.entries()) {
      if (metrics.length === 0) continue;

      const latestMetric = metrics[metrics.length - 1];
      if (!latestMetric) continue;
      
      // Add metric help and type
      lines.push(`# HELP ${name} Sync worker metric`);
      lines.push(`# TYPE ${name} ${latestMetric.type}`);

      // Add metric value
      const labels = latestMetric.labels 
        ? Object.entries(latestMetric.labels)
            .map(([key, value]) => `${key}="${value}"`)
            .join(',')
        : '';
      
      const labelsStr = labels ? `{${labels}}` : '';
      lines.push(`${name}${labelsStr} ${latestMetric.value} ${now}`);

      // Add histogram buckets if applicable
      if (latestMetric.type === 'histogram' && 'buckets' in latestMetric) {
        const buckets = (latestMetric as Histogram).buckets;
        if (buckets) {
          for (const [bucket, count] of Object.entries(buckets)) {
            const bucketLabels = labels 
              ? `{${labels},le="${bucket}"}` 
              : `{le="${bucket}"}`;
            lines.push(`${name}_bucket${bucketLabels} ${count} ${now}`);
          }
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    try {
      this.metrics.clear();
      logger.info('📊 All metrics cleared');
    } catch (error) {
      logger.error('Error clearing metrics', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get metrics statistics
   */
  getMetricsStats(): {
    totalMetrics: number;
    metricsCount: Record<string, number>;
    memoryUsage: number;
    oldestMetric: Date | null;
    newestMetric: Date | null;
  } {
    let totalMetrics = 0;
    let oldestMetric: Date | null = null;
    let newestMetric: Date | null = null;
    const metricsCount: Record<string, number> = {};

    for (const [name, metrics] of this.metrics.entries()) {
      totalMetrics += metrics.length;
      metricsCount[name] = metrics.length;

      if (metrics.length > 0) {
        const firstMetric = metrics[0];
        const lastMetric = metrics[metrics.length - 1];
        
        if (firstMetric && lastMetric) {
          const oldest = firstMetric.timestamp;
          const newest = lastMetric.timestamp;

          if (!oldestMetric || oldest < oldestMetric) {
            oldestMetric = oldest;
          }
          if (!newestMetric || newest > newestMetric) {
            newestMetric = newest;
          }
        }
      }
    }

    return {
      totalMetrics,
      metricsCount,
      memoryUsage: JSON.stringify(Array.from(this.metrics.entries())).length,
      oldestMetric,
      newestMetric,
    };
  }
} 