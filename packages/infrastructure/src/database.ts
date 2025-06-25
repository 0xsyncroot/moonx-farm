import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { createLogger, DatabaseError } from '@moonx/common';
import { isDevelopment } from '@moonx/configs';

const logger = createLogger('database');

/**
 * Database configuration options
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
}

/**
 * Database query options
 */
export interface QueryOptions {
  timeout?: number;
  retries?: number;
  transactionId?: string;
}

/**
 * Database transaction interface
 */
export interface Transaction {
  query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/**
 * Database manager class
 */
export class DatabaseManager {
  private pool: Pool;
  private isConnected = false;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.maxConnections || 20,
      idleTimeoutMillis: config.idleTimeoutMs || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMs || 10000,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup pool event handlers
   */
  private setupEventHandlers(): void {
    this.pool.on('connect', (client) => {
      logger.info('New database connection established', {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount,
      });
    });

    this.pool.on('acquire', (client) => {
      logger.debug('Database connection acquired from pool');
    });

    this.pool.on('release', (err, client) => {
      if (err) {
        logger.error('Database connection release error', { error: err.message });
      } else {
        logger.debug('Database connection released to pool');
      }
    });

    this.pool.on('error', (err) => {
      logger.error('Database pool error', { error: err.message });
    });

    // Graceful shutdown
    process.on('SIGINT', () => this.disconnect());
    process.on('SIGTERM', () => this.disconnect());
  }

  /**
   * Connect to the database
   */
  async connect(): Promise<void> {
    try {
      // Test connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      logger.info('Database connected successfully', {
        timestamp: result.rows[0].now,
        poolSize: this.pool.totalCount,
      });
    } catch (error) {
      const err = error as Error;
      logger.error('Database connection failed', { error: err.message });
      throw new DatabaseError('Failed to connect to database', {
        originalError: err.message,
      });
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database disconnected successfully');
    } catch (error) {
      const err = error as Error;
      logger.error('Database disconnection failed', { error: err.message });
    }
  }

  /**
   * Execute a query
   */
  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const { timeout = 30000, retries = 1, transactionId } = options;
    const queryId = Math.random().toString(36).substring(7);

    logger.debug('Executing database query', {
      queryId,
      transactionId,
      query: text,
      params: params ? params.length : 0,
    });

    const startTime = Date.now();

    for (let attempt = 1; attempt <= retries; attempt++) {
      let client: PoolClient | undefined;

      try {
        client = await this.pool.connect();
        
        // Set statement timeout
        if (timeout) {
          await client.query(`SET statement_timeout = ${timeout}`);
        }

        const result = await client.query<T>(text, params);
        const duration = Date.now() - startTime;

        logger.debug('Database query completed', {
          queryId,
          transactionId,
          duration,
          rowCount: result.rowCount,
          attempt,
        });

        return result;
      } catch (error) {
        const err = error as Error;
        const duration = Date.now() - startTime;

        logger.error('Database query failed', {
          queryId,
          transactionId,
          query: text,
          params,
          error: err.message,
          duration,
          attempt,
          maxRetries: retries,
        });

        if (attempt === retries) {
          throw new DatabaseError(`Query failed after ${retries} attempts`, {
            query: text,
            params,
            originalError: err.message,
            duration,
          });
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      } finally {
        if (client) {
          client.release();
        }
      }
    }

    throw new Error('Unexpected end of retry loop');
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(
    callback: (tx: Transaction) => Promise<T>
  ): Promise<T> {
    const transactionId = Math.random().toString(36).substring(7);
    const client = await this.pool.connect();

    logger.debug('Starting database transaction', { transactionId });

    try {
      await client.query('BEGIN');

      const transaction: Transaction = {
        query: async <U extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<U>> => {
          logger.debug('Executing transaction query', {
            transactionId,
            query: text,
          });

          const result = await client.query<U>(text, params);
          return result;
        },

        commit: async (): Promise<void> => {
          await client.query('COMMIT');
          logger.debug('Transaction committed', { transactionId });
        },

        rollback: async (): Promise<void> => {
          await client.query('ROLLBACK');
          logger.debug('Transaction rolled back', { transactionId });
        },
      };

      const result = await callback(transaction);
      await client.query('COMMIT');

      logger.info('Transaction completed successfully', { transactionId });
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      const err = error as Error;

      logger.error('Transaction failed and rolled back', {
        transactionId,
        error: err.message,
      });

      throw new DatabaseError('Transaction failed', {
        transactionId,
        originalError: err.message,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Check if database is connected
   */
  isHealthy(): boolean {
    return this.isConnected && this.pool.totalCount > 0;
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      isConnected: this.isConnected,
    };
  }

  /**
   * Execute a raw query (for migrations, etc.)
   */
  async raw(text: string): Promise<QueryResult> {
    const client = await this.pool.connect();
    
    try {
      return await client.query(text);
    } finally {
      client.release();
    }
  }
}

/**
 * Create a database manager instance
 */
export function createDatabase(config: DatabaseConfig): DatabaseManager {
  return new DatabaseManager(config);
}

/**
 * Create database configuration from environment
 */
export function createDatabaseConfig(): DatabaseConfig {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (databaseUrl) {
    const url = new URL(databaseUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1),
      user: url.username,
      password: url.password,
      ssl: !isDevelopment(),
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'moonx_farm',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
  };
} 