import { logger } from '../utils/logger';

// Simplified Prometheus service for metrics
export class PrometheusService {
  private metrics: Map<string, any> = new Map();
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  constructor() {
    this.initializeMetrics();
  }

  private initializeMetrics() {
    // Initialize metric counters
    this.counters.set('notifications_created_total', 0);
    this.counters.set('notifications_delivered_total', 0);
    this.counters.set('notifications_failed_total', 0);
    this.counters.set('messages_processed_total', 0);
    this.counters.set('gateway_messages_sent_total', 0);
    
    // Initialize histograms
    this.histograms.set('notification_processing_duration_seconds', []);
    this.histograms.set('notification_delivery_duration_seconds', []);
    this.histograms.set('message_processing_duration_seconds', []);
    
    logger.info('Prometheus metrics initialized');
  }

  // Counter metrics
  incrementCounter(name: string, labels?: any): void {
    const key = this.createKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + 1);
  }

  // Histogram metrics
  recordHistogram(name: string, value: number, labels?: any): void {
    const key = this.createKey(name, labels);
    const current = this.histograms.get(key) || [];
    current.push(value);
    // Keep only last 1000 values
    if (current.length > 1000) {
      current.shift();
    }
    this.histograms.set(key, current);
  }

  // Specific metric methods
  async recordNotificationCreated(type: string, priority: string, processingTime: number): Promise<void> {
    this.incrementCounter('notifications_created_total', { type, priority });
    this.recordHistogram('notification_processing_duration_seconds', processingTime / 1000, { type });
  }

  async recordNotificationDelivered(
    type: string, 
    priority: string, 
    successCount: number, 
    totalChannels: number,
    deliveryTime: number
  ): Promise<void> {
    this.incrementCounter('notifications_delivered_total', { type, priority });
    this.recordHistogram('notification_delivery_duration_seconds', deliveryTime / 1000, { type });
    
    // Track delivery success rate
    const successRate = successCount / totalChannels;
    this.recordHistogram('delivery_success_rate', successRate, { type });
  }

  async recordNotificationError(type: string, errorType: string): Promise<void> {
    this.incrementCounter('notifications_failed_total', { type, error_type: errorType });
  }

  async recordMessageProcessed(topic: string, status: string, processingTime: number): Promise<void> {
    this.incrementCounter('messages_processed_total', { topic, status });
    this.recordHistogram('message_processing_duration_seconds', processingTime / 1000, { topic });
  }

  incrementGatewayMessages(): void {
    this.incrementCounter('gateway_messages_sent_total');
  }

  // Metric retrieval methods
  async getProcessedMessages(): Promise<number> {
    return this.counters.get('messages_processed_total') || 0;
  }

  async getDeliveredNotifications(): Promise<number> {
    return this.counters.get('notifications_delivered_total') || 0;
  }

  async getFailedDeliveries(): Promise<number> {
    return this.counters.get('notifications_failed_total') || 0;
  }

  async getAverageProcessingTime(): Promise<number> {
    const values = this.histograms.get('notification_processing_duration_seconds') || [];
    if (values.length === 0) return 0;
    
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }

  // Prometheus exposition format
  async getMetrics(): Promise<string> {
    let output = '';
    
    // Add counters
    for (const [key, value] of this.counters) {
      output += `# TYPE ${key} counter\n`;
      output += `${key} ${value}\n`;
    }
    
    // Add histograms
    for (const [key, values] of this.histograms) {
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const count = values.length;
        
        output += `# TYPE ${key} histogram\n`;
        output += `${key}_sum ${sum}\n`;
        output += `${key}_count ${count}\n`;
        output += `${key}_bucket{le="+Inf"} ${count}\n`;
      }
    }
    
    return output;
  }

  // Helper methods
  private createKey(name: string, labels?: any): string {
    if (!labels) return name;
    
    const labelPairs = Object.entries(labels)
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    
    return `${name}{${labelPairs}}`;
  }

  // Statistics
  async getStats(): Promise<any> {
    const stats = {
      counters: Object.fromEntries(this.counters),
      histograms: {}
    };
    
    // Add histogram statistics
    for (const [key, values] of this.histograms) {
      if (values.length > 0) {
        const sorted = [...values].sort((a, b) => a - b);
        (stats.histograms as any)[key] = {
          count: values.length,
          sum: values.reduce((a, b) => a + b, 0),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: sorted[0],
          max: sorted[sorted.length - 1],
          p50: sorted[Math.floor(sorted.length * 0.5)],
          p95: sorted[Math.floor(sorted.length * 0.95)],
          p99: sorted[Math.floor(sorted.length * 0.99)]
        };
      }
    }
    
    return stats;
  }

  // Reset metrics (for testing)
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.initializeMetrics();
  }
} 