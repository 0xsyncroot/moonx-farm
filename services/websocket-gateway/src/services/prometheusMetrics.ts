// Minimal Prometheus Metrics for WebSocket Gateway
export class PrometheusMetrics {
  private metrics = {
    connections: 0,
    totalConnections: 0,
    totalDisconnections: 0,
    errors: 0,
    messagesReceived: 0,
    messagesSent: 0
  };

  incrementConnections(): void {
    this.metrics.connections++;
    this.metrics.totalConnections++;
  }

  decrementConnections(): void {
    this.metrics.connections = Math.max(0, this.metrics.connections - 1);
    this.metrics.totalDisconnections++;
  }

  incrementErrors(): void {
    this.metrics.errors++;
  }

  incrementMessagesReceived(): void {
    this.metrics.messagesReceived++;
  }

  incrementMessagesSent(): void {
    this.metrics.messagesSent++;
  }

  async getMetrics(): Promise<string> {
    const timestamp = Date.now();
    
    return `
# HELP websocket_connections_active Current active WebSocket connections
# TYPE websocket_connections_active gauge
websocket_connections_active ${this.metrics.connections} ${timestamp}

# HELP websocket_connections_total Total WebSocket connections created
# TYPE websocket_connections_total counter
websocket_connections_total ${this.metrics.totalConnections} ${timestamp}

# HELP websocket_disconnections_total Total WebSocket disconnections
# TYPE websocket_disconnections_total counter
websocket_disconnections_total ${this.metrics.totalDisconnections} ${timestamp}

# HELP websocket_errors_total Total WebSocket errors
# TYPE websocket_errors_total counter
websocket_errors_total ${this.metrics.errors} ${timestamp}

# HELP websocket_messages_received_total Total messages received
# TYPE websocket_messages_received_total counter
websocket_messages_received_total ${this.metrics.messagesReceived} ${timestamp}

# HELP websocket_messages_sent_total Total messages sent
# TYPE websocket_messages_sent_total counter
websocket_messages_sent_total ${this.metrics.messagesSent} ${timestamp}
`.trim();
  }

  getStats(): any {
    return {
      ...this.metrics,
      timestamp: new Date().toISOString()
    };
  }

  reset(): void {
    this.metrics = {
      connections: 0,
      totalConnections: 0,
      totalDisconnections: 0,
      errors: 0,
      messagesReceived: 0,
      messagesSent: 0
    };
  }
} 