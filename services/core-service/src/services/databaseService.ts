import { DatabaseManager, createDatabaseConfig } from '@moonx/infrastructure';

export class DatabaseService {
  private db: DatabaseManager;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 3;

  constructor() {
    // Get database configuration from @moonx/infrastructure (same as Auth Service)
    const dbConfig = createDatabaseConfig();
    
    // Configure connection pool for Core Service
    const config = {
      ...dbConfig,
      // Override specific settings for Core Service
      maxConnections: 20,
      minConnections: 2,
      applicationName: 'moonx-core-service',
    };

    this.db = new DatabaseManager(config);
    console.log('✅ DatabaseService initialized for Core Service with infrastructure config');
    console.log('🔧 Database SSL config:', { ssl: config.ssl });
  }

  /**
   * Connect to database with retry logic
   */
  async connect(): Promise<void> {
    while (this.connectionAttempts < this.maxConnectionAttempts) {
      try {
        this.connectionAttempts++;
        console.log(`Attempting database connection (attempt ${this.connectionAttempts}/${this.maxConnectionAttempts})`);
        
        await this.db.connect();
        this.isConnected = true;
        this.connectionAttempts = 0; // Reset on success
        
        console.log('✅ Core Service database connected successfully');
        
        // Test connection with a simple query
        await this.query('SELECT NOW() as current_time');
        console.log('✅ Database connection verified');
        
        return;
      } catch (error) {
        console.error(`❌ Database connection attempt ${this.connectionAttempts} failed:`, error);
        
        if (this.connectionAttempts >= this.maxConnectionAttempts) {
          this.isConnected = false;
          throw new Error(`Failed to connect to database after ${this.maxConnectionAttempts} attempts: ${error}`);
        }
        
        // Wait before retry
        await this.sleep(2000 * this.connectionAttempts); // Exponential backoff
      }
    }
  }

  /**
   * Disconnect from database gracefully
   */
  async disconnect(): Promise<void> {
    try {
      await this.db.disconnect();
      this.isConnected = false;
      console.log('⏹️ Core Service database disconnected');
    } catch (error) {
      console.error('Error disconnecting from database:', error);
    }
  }

  /**
   * Check if database is connected
   */
  isDbConnected(): boolean {
    return this.isConnected && this.db.isHealthy();
  }

  /**
   * Get underlying database manager (use with caution)
   */
  getPool(): DatabaseManager {
    return this.db;
  }

  /**
   * Execute a query with proper error handling and logging
   */
  async query(text: string, params?: any[]): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const startTime = Date.now();
    const queryId = Math.random().toString(36).substr(2, 9);
    
    try {
      // Log query in development (be careful with sensitive data)
      if (process.env['NODE_ENV'] !== 'production') {
        console.log(`[Query ${queryId}] Starting:`, {
          sql: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          paramCount: params?.length || 0
        });
      }

      const result = await this.db.query(text, params);
      
      const duration = Date.now() - startTime;
      
      // Log slow queries
      if (duration > 1000) {
        console.warn(`[Query ${queryId}] Slow query detected (${duration}ms):`, {
          sql: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          duration,
          rowCount: result.rowCount
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Query ${queryId}] Failed after ${duration}ms:`, {
        sql: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        error: error instanceof Error ? error.message : 'Unknown error',
        paramCount: params?.length || 0
      });
      
      // Check if it's a connection error
      if (this.isConnectionError(error)) {
        this.isConnected = false;
        console.error('Database connection lost, marking as disconnected');
      }
      
      throw error;
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    if (!this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const transactionId = Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();
    
    try {
      console.log(`[Transaction ${transactionId}] Starting`);
      
      const result = await this.db.transaction(callback);
      
      const duration = Date.now() - startTime;
      console.log(`[Transaction ${transactionId}] Completed successfully in ${duration}ms`);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Transaction ${transactionId}] Failed after ${duration}ms:`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Check if it's a connection error
      if (this.isConnectionError(error)) {
        this.isConnected = false;
        console.error('Database connection lost during transaction');
      }
      
      throw error;
    }
  }

  /**
   * Execute batch queries for bulk operations
   */
  async batch(queries: Array<{ text: string; params?: any[] }>): Promise<any[]> {
    if (!this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const batchId = Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();
    
    try {
      console.log(`[Batch ${batchId}] Starting ${queries.length} queries`);
      
      const results = await this.db.batch(queries);
      
      const duration = Date.now() - startTime;
      console.log(`[Batch ${batchId}] Completed ${queries.length} queries in ${duration}ms`);
      
      return results;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Batch ${batchId}] Failed after ${duration}ms:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        queryCount: queries.length
      });
      
      throw error;
    }
  }

  /**
   * Comprehensive health check
   */
  async healthCheck(): Promise<{
    connected: boolean;
    responseTime: number;
    poolStats: any;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      if (!this.isConnected) {
        return {
          connected: false,
          responseTime: 0,
          poolStats: null,
          error: 'Not connected'
        };
      }

      // Test with a simple query
      await this.db.query('SELECT 1 as health_check, NOW() as current_time');
      
      const responseTime = Date.now() - startTime;
      const poolStats = this.getPoolStats();
      
      return {
        connected: true,
        responseTime,
        poolStats
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('Database health check failed:', errorMessage);
      
      // Update connection status if it's a connection error
      if (this.isConnectionError(error)) {
        this.isConnected = false;
      }
      
      return {
        connected: false,
        responseTime,
        poolStats: null,
        error: errorMessage
      };
    }
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats() {
    try {
      return this.db.getPoolStats();
    } catch (error) {
      console.warn('Failed to get pool stats:', error);
      return null;
    }
  }

  /**
   * Attempt to reconnect to database
   */
  async reconnect(): Promise<void> {
    console.log('Attempting to reconnect to database...');
    
    try {
      await this.disconnect();
      await this.sleep(1000); // Wait 1 second before reconnecting
      await this.connect();
    } catch (error) {
      console.error('Failed to reconnect to database:', error);
      throw error;
    }
  }

  /**
   * Check if error is a connection-related error
   */
  private isConnectionError(error: any): boolean {
    if (!error) return false;
    
    const connectionErrors = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ECONNRESET',
      'connection terminated',
      'connection closed',
      'server closed the connection'
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    return connectionErrors.some(connError => errorMessage.includes(connError));
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate and sanitize SQL queries (basic protection)
   */
  private validateQuery(text: string): void {
    if (!text || typeof text !== 'string') {
      throw new Error('Query text must be a non-empty string');
    }
    
    // Basic SQL injection protection (not comprehensive)
    const suspiciousPatterns = [
      /;\s*drop\s+/i,
      /;\s*delete\s+from\s+/i,
      /;\s*truncate\s+/i,
      /union\s+select\s+/i
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(text)) {
        console.warn('Potentially dangerous SQL pattern detected:', text.substring(0, 100));
        break;
      }
    }
  }

  /**
   * Get database connection info (for debugging)
   */
  getConnectionInfo(): {
    isConnected: boolean;
    connectionAttempts: number;
    maxConnectionAttempts: number;
    dbConfig: any;
  } {
    return {
      isConnected: this.isConnected,
      connectionAttempts: this.connectionAttempts,
      maxConnectionAttempts: this.maxConnectionAttempts,
      dbConfig: {
        host: process.env['DB_HOST'] || 'localhost',
        port: process.env['DB_PORT'] || '5432',
        database: process.env['DB_NAME'] || 'moonx_core'
        // Don't expose sensitive data like password
      }
    };
  }
} 