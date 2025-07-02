import { Pool, PoolClient, QueryResult, QueryResultRow, PoolConfig } from 'pg';
import { createLogger, DatabaseError } from '@moonx-farm/common';
import { isDevelopment } from '@moonx-farm/configs';

const logger = createLogger('database-infrastructure');

/**
 * Database configuration options - simplified but extensible
 */
export interface DatabaseConfig {
  // Basic connection
  host?: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | { rejectUnauthorized?: boolean; ca?: string };
  // Connection pooling
  maxConnections?: number;
  minConnections?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
  // Performance tuning
  statementTimeout?: number;
  queryTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  // Features
  applicationName?: string;
  enableMetrics?: boolean;
  enableQueryLogging?: boolean;
}

/**
 * Database query options
 */
export interface QueryOptions {
  timeout?: number;
  retries?: number;
  transactionId?: string;
  queryName?: string;
}

/**
 * Database metrics interface
 */
export interface DatabaseMetrics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageQueryTime: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  transactionCount: number;
  rollbackCount: number;
  isConnected: boolean;
  lastError?: string;
}

/**
 * Enhanced transaction interface with savepoints
 */
export interface Transaction {
  query<T extends QueryResultRow = any>(
    text: string, 
    params?: any[], 
    options?: Omit<QueryOptions, 'transactionId'>
  ): Promise<QueryResult<T>>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  savepoint(name: string): Promise<void>;
  rollbackToSavepoint(name: string): Promise<void>;
  releaseSavepoint(name: string): Promise<void>;
  getTransactionId(): string;
}

/**
 * Query builder interface for basic operations
 */
export interface QueryBuilder {
  select(table: string, columns?: string[]): SelectQueryBuilder;
  insert(table: string, data: Record<string, any>): InsertQueryBuilder;
  update(table: string, data: Record<string, any>): UpdateQueryBuilder;
  delete(table: string): DeleteQueryBuilder;
}

/**
 * Select query builder
 */
export interface SelectQueryBuilder {
  where(conditions: Record<string, any> | string, params?: any[]): SelectQueryBuilder;
  orderBy(column: string, direction?: 'ASC' | 'DESC'): SelectQueryBuilder;
  limit(count: number): SelectQueryBuilder;
  offset(count: number): SelectQueryBuilder;
  join(table: string, condition: string): SelectQueryBuilder;
  leftJoin(table: string, condition: string): SelectQueryBuilder;
  build(): { text: string; params: any[] };
  execute<T extends QueryResultRow = any>(): Promise<QueryResult<T>>;
}

/**
 * Insert query builder
 */
export interface InsertQueryBuilder {
  returning(columns: string[]): InsertQueryBuilder;
  onConflict(constraint: string, action: string): InsertQueryBuilder;
  build(): { text: string; params: any[] };
  execute<T extends QueryResultRow = any>(): Promise<QueryResult<T>>;
}

/**
 * Update query builder
 */
export interface UpdateQueryBuilder {
  where(conditions: Record<string, any> | string, params?: any[]): UpdateQueryBuilder;
  returning(columns: string[]): UpdateQueryBuilder;
  build(): { text: string; params: any[] };
  execute<T extends QueryResultRow = any>(): Promise<QueryResult<T>>;
}

/**
 * Delete query builder
 */
export interface DeleteQueryBuilder {
  where(conditions: Record<string, any> | string, params?: any[]): DeleteQueryBuilder;
  returning(columns: string[]): DeleteQueryBuilder;
  build(): { text: string; params: any[] };
  execute<T extends QueryResultRow = any>(): Promise<QueryResult<T>>;
}

/**
 * Database manager class - simplified but robust
 */
export class DatabaseManager implements QueryBuilder {
  private pool!: Pool;
  private isConnected = false;
  private metrics: DatabaseMetrics;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.metrics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageQueryTime: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingConnections: 0,
      transactionCount: 0,
      rollbackCount: 0,
      isConnected: false
    };

    this.initializePool();
    this.setupEventHandlers();
  }

  /**
   * Initialize database pool
   */
  private initializePool(): void {
    const poolConfig: PoolConfig = {
      host: this.config.host || 'localhost',
      port: this.config.port || 5432,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      ssl: false,
      max: this.config.maxConnections || 20,
      min: this.config.minConnections || 2,
      idleTimeoutMillis: this.config.idleTimeoutMs || 30000,
      connectionTimeoutMillis: this.config.connectionTimeoutMs || 10000,
      application_name: this.config.applicationName || 'moonx-farm',
      statement_timeout: this.config.statementTimeout || 60000,
      query_timeout: this.config.queryTimeout || 30000,
    };

    logger.info('Pool config', { poolConfig });

    this.pool = new Pool(poolConfig);
  }

  /**
   * Setup pool event handlers
   */
  private setupEventHandlers(): void {
    this.pool.on('connect', (client) => {
      this.updateConnectionMetrics();
      logger.info('New database connection established', {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount,
      });
    });

    this.pool.on('acquire', () => {
      this.updateConnectionMetrics();
      logger.debug('Database connection acquired from pool');
    });

    this.pool.on('release', (err) => {
      if (err) {
        logger.error('Database connection release error', { error: err.message });
      } else {
        logger.debug('Database connection released to pool');
      }
    });

    this.pool.on('error', (err) => {
      this.metrics.lastError = err.message;
      this.metrics.isConnected = false;
      logger.error('Database pool error', { error: err.message });
    });

    // Note: Signal handlers should be managed at application level, not infrastructure level
    // Application should call disconnect() during graceful shutdown
  }

  /**
   * Update connection metrics
   */
  private updateConnectionMetrics(): void {
    this.metrics.activeConnections = this.pool.totalCount;
    this.metrics.idleConnections = this.pool.idleCount;
    this.metrics.waitingConnections = this.pool.waitingCount;
  }

  /**
   * Execute query with monitoring
   */
  private async executeQuery<T extends QueryResultRow = any>(
    text: string,
    params: any[] = [],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const {
      timeout = this.config.queryTimeout || 30000,
      retries = this.config.maxRetries || 1,
      queryName
    } = options;

    const queryId = Math.random().toString(36).substring(7);
    
    // Update metrics
    this.metrics.totalQueries++;

    if (this.config.enableQueryLogging) {
      logger.debug('Executing database query', {
        queryId,
        queryName: queryName || 'unnamed',
        paramsCount: params.length,
      });
    }

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
        this.updateQueryMetrics(duration, true);

        if (this.config.enableQueryLogging) {
          logger.debug('Database query completed', {
            queryId,
            duration,
            rowCount: result.rowCount,
            attempt,
          });
        }

        return result;
      } catch (error) {
        const err = error as Error;
        const duration = Date.now() - startTime;
        this.updateQueryMetrics(duration, false);

        logger.error('Database query failed', {
          queryId,
          queryName: queryName || 'unnamed',
          query: text.substring(0, 100),
          paramsCount: params.length,
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
            queryId
          });
        }

        // Wait before retry with exponential backoff
        const delay = (this.config.retryDelay || 1000) * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      } finally {
        if (client) {
          client.release();
        }
      }
    }

    throw new Error('Unexpected end of retry loop');
  }

  /**
   * Update query metrics
   */
  private updateQueryMetrics(duration: number, success: boolean): void {
    if (success) {
      this.metrics.successfulQueries++;
      
      // Update average query time
      const total = this.metrics.successfulQueries;
      this.metrics.averageQueryTime = 
        ((this.metrics.averageQueryTime * (total - 1)) + duration) / total;
    } else {
      this.metrics.failedQueries++;
      this.metrics.lastError = `Query failed in ${duration}ms`;
    }
  }

  /**
   * Connect to the database
   */
  async connect(): Promise<void> {
    try {
      // Test connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as timestamp, version() as version');
      client.release();

      this.isConnected = true;
      this.metrics.isConnected = true;
      logger.info('Database connected successfully', {
        timestamp: result.rows[0].timestamp,
        version: result.rows[0].version,
        poolSize: this.pool.totalCount,
      });
    } catch (error) {
      const err = error as Error;
      this.metrics.lastError = err.message;
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
      this.metrics.isConnected = false;
      logger.info('Database disconnected successfully');
    } catch (error) {
      const err = error as Error;
      logger.error('Database disconnection failed', { error: err.message });
    }
  }

  /**
   * Execute a query with options
   */
  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    return this.executeQuery<T>(text, params || [], options);
  }

  /**
   * Execute multiple queries in a transaction with savepoints
   */
  async transaction<T>(
    callback: (tx: Transaction) => Promise<T>
  ): Promise<T> {
    const transactionId = Math.random().toString(36).substring(7);
    const client = await this.pool.connect();
    this.metrics.transactionCount++;

    logger.debug('Starting database transaction', { transactionId });

    try {
      await client.query('BEGIN');

      const transaction: Transaction = {
        query: async <U extends QueryResultRow = any>(
          text: string, 
          params?: any[], 
          options: Omit<QueryOptions, 'transactionId'> = {}
        ): Promise<QueryResult<U>> => {
          if (this.config.enableQueryLogging) {
            logger.debug('Executing transaction query', {
              transactionId,
              query: text.substring(0, 100),
            });
          }

          const startTime = Date.now();
          this.metrics.totalQueries++;

          try {
            const result = await client.query<U>(text, params);
            const duration = Date.now() - startTime;
            this.updateQueryMetrics(duration, true);
            return result;
          } catch (error) {
            const duration = Date.now() - startTime;
            this.updateQueryMetrics(duration, false);
            throw error;
          }
        },

        commit: async (): Promise<void> => {
          await client.query('COMMIT');
          logger.debug('Transaction committed', { transactionId });
        },

        rollback: async (): Promise<void> => {
          await client.query('ROLLBACK');
          this.metrics.rollbackCount++;
          logger.debug('Transaction rolled back', { transactionId });
        },

        savepoint: async (name: string): Promise<void> => {
          await client.query(`SAVEPOINT ${name}`);
          logger.debug('Savepoint created', { transactionId, savepoint: name });
        },

        rollbackToSavepoint: async (name: string): Promise<void> => {
          await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
          logger.debug('Rolled back to savepoint', { transactionId, savepoint: name });
        },

        releaseSavepoint: async (name: string): Promise<void> => {
          await client.query(`RELEASE SAVEPOINT ${name}`);
          logger.debug('Savepoint released', { transactionId, savepoint: name });
        },

        getTransactionId: (): string => transactionId
      };

      const result = await callback(transaction);
      await client.query('COMMIT');

      logger.info('Transaction completed successfully', { transactionId });
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.metrics.rollbackCount++;
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
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      const err = error as Error;
      logger.error('Database health check failed', { error: err.message });
      return false;
    }
  }

  /**
   * Check if database is connected and healthy
   */
  isHealthy(): boolean {
    return this.isConnected && this.pool.totalCount > 0;
  }

  /**
   * Get database metrics
   */
  getMetrics(): DatabaseMetrics {
    this.updateConnectionMetrics();
    return { ...this.metrics };
  }

  /**
   * Get pool statistics for monitoring
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
   * Execute a raw query for migrations, admin operations
   */
  async raw(text: string, params?: any[]): Promise<QueryResult> {
    const client = await this.pool.connect();
    
    try {
      if (this.config.enableQueryLogging) {
        logger.info('Executing raw query', { query: text.substring(0, 100) });
      }
      return await client.query(text, params);
    } finally {
      client.release();
    }
  }

  /**
   * Query builder: SELECT
   */
  select(table: string, columns: string[] = ['*']): SelectQueryBuilder {
    return new SelectQuery(this, table, columns);
  }

  /**
   * Query builder: INSERT
   */
  insert(table: string, data: Record<string, any>): InsertQueryBuilder {
    return new InsertQuery(this, table, data);
  }

  /**
   * Query builder: UPDATE
   */
  update(table: string, data: Record<string, any>): UpdateQueryBuilder {
    return new UpdateQuery(this, table, data);
  }

  /**
   * Query builder: DELETE
   */
  delete(table: string): DeleteQueryBuilder {
    return new DeleteQuery(this, table);
  }

  /**
   * Execute batch queries efficiently
   */
  async batch(queries: Array<{ text: string; params?: any[] }>): Promise<QueryResult[]> {
    const client = await this.pool.connect();
    
    try {
      const results: QueryResult[] = [];
      
      await client.query('BEGIN');
      
      for (const query of queries) {
        const result = await client.query(query.text, query.params);
        results.push(result);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get underlying pool for advanced operations
   */
  getPool(): Pool {
    return this.pool;
  }
}

// Query Builder Implementations
class SelectQuery implements SelectQueryBuilder {
  constructor(
    private db: DatabaseManager,
    private table: string,
    private columns: string[]
  ) {}

  private conditions: string[] = [];
  private params: any[] = [];
  private orderByClauses: string[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private joins: string[] = [];

  where(conditions: Record<string, any> | string, params?: any[]): SelectQueryBuilder {
    if (typeof conditions === 'string') {
      this.conditions.push(conditions);
      if (params) this.params.push(...params);
    } else {
      const keys = Object.keys(conditions);
      const clause = keys.map((key, index) => `${key} = $${this.params.length + index + 1}`).join(' AND ');
      this.conditions.push(clause);
      this.params.push(...Object.values(conditions));
    }
    return this;
  }

  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): SelectQueryBuilder {
    this.orderByClauses.push(`${column} ${direction}`);
    return this;
  }

  limit(count: number): SelectQueryBuilder {
    this.limitValue = count;
    return this;
  }

  offset(count: number): SelectQueryBuilder {
    this.offsetValue = count;
    return this;
  }

  join(table: string, condition: string): SelectQueryBuilder {
    this.joins.push(`JOIN ${table} ON ${condition}`);
    return this;
  }

  leftJoin(table: string, condition: string): SelectQueryBuilder {
    this.joins.push(`LEFT JOIN ${table} ON ${condition}`);
    return this;
  }

  build(): { text: string; params: any[] } {
    let query = `SELECT ${this.columns.join(', ')} FROM ${this.table}`;
    
    if (this.joins.length > 0) {
      query += ` ${this.joins.join(' ')}`;
    }
    
    if (this.conditions.length > 0) {
      query += ` WHERE ${this.conditions.join(' AND ')}`;
    }
    
    if (this.orderByClauses.length > 0) {
      query += ` ORDER BY ${this.orderByClauses.join(', ')}`;
    }
    
    if (this.limitValue !== undefined) {
      query += ` LIMIT ${this.limitValue}`;
    }
    
    if (this.offsetValue !== undefined) {
      query += ` OFFSET ${this.offsetValue}`;
    }

    return { text: query, params: this.params };
  }

  async execute<T extends QueryResultRow = any>(): Promise<QueryResult<T>> {
    const { text, params } = this.build();
    return this.db.query<T>(text, params);
  }
}

class InsertQuery implements InsertQueryBuilder {
  constructor(
    private db: DatabaseManager,
    private table: string,
    private data: Record<string, any>
  ) {}

  private returningColumns: string[] = [];
  private conflictClause?: string;

  returning(columns: string[]): InsertQueryBuilder {
    this.returningColumns = columns;
    return this;
  }

  onConflict(constraint: string, action: string): InsertQueryBuilder {
    this.conflictClause = `ON CONFLICT ${constraint} ${action}`;
    return this;
  }

  build(): { text: string; params: any[] } {
    const columns = Object.keys(this.data);
    const values = Object.values(this.data);
    const placeholders = values.map((_, i) => `$${i + 1}`);

    let query = `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
    
    if (this.conflictClause) {
      query += ` ${this.conflictClause}`;
    }
    
    if (this.returningColumns.length > 0) {
      query += ` RETURNING ${this.returningColumns.join(', ')}`;
    }

    return { text: query, params: values };
  }

  async execute<T extends QueryResultRow = any>(): Promise<QueryResult<T>> {
    const { text, params } = this.build();
    return this.db.query<T>(text, params);
  }
}

class UpdateQuery implements UpdateQueryBuilder {
  constructor(
    private db: DatabaseManager,
    private table: string,
    private data: Record<string, any>
  ) {}

  private conditions: string[] = [];
  private params: any[] = [];
  private returningColumns: string[] = [];

  where(conditions: Record<string, any> | string, params?: any[]): UpdateQueryBuilder {
    const dataValues = Object.values(this.data);
    
    if (typeof conditions === 'string') {
      this.conditions.push(conditions);
      if (params) this.params.push(...params);
    } else {
      const keys = Object.keys(conditions);
      const clause = keys.map((key, index) => `${key} = $${dataValues.length + this.params.length + index + 1}`).join(' AND ');
      this.conditions.push(clause);
      this.params.push(...Object.values(conditions));
    }
    return this;
  }

  returning(columns: string[]): UpdateQueryBuilder {
    this.returningColumns = columns;
    return this;
  }

  build(): { text: string; params: any[] } {
    const dataEntries = Object.entries(this.data);
    const setClause = dataEntries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
    const dataValues = dataEntries.map(([, value]) => value);

    let query = `UPDATE ${this.table} SET ${setClause}`;
    
    if (this.conditions.length > 0) {
      query += ` WHERE ${this.conditions.join(' AND ')}`;
    }
    
    if (this.returningColumns.length > 0) {
      query += ` RETURNING ${this.returningColumns.join(', ')}`;
    }

    return { text: query, params: [...dataValues, ...this.params] };
  }

  async execute<T extends QueryResultRow = any>(): Promise<QueryResult<T>> {
    const { text, params } = this.build();
    return this.db.query<T>(text, params);
  }
}

class DeleteQuery implements DeleteQueryBuilder {
  constructor(
    private db: DatabaseManager,
    private table: string
  ) {}

  private conditions: string[] = [];
  private params: any[] = [];
  private returningColumns: string[] = [];

  where(conditions: Record<string, any> | string, params?: any[]): DeleteQueryBuilder {
    if (typeof conditions === 'string') {
      this.conditions.push(conditions);
      if (params) this.params.push(...params);
    } else {
      const keys = Object.keys(conditions);
      const clause = keys.map((key, index) => `${key} = $${this.params.length + index + 1}`).join(' AND ');
      this.conditions.push(clause);
      this.params.push(...Object.values(conditions));
    }
    return this;
  }

  returning(columns: string[]): DeleteQueryBuilder {
    this.returningColumns = columns;
    return this;
  }

  build(): { text: string; params: any[] } {
    let query = `DELETE FROM ${this.table}`;
    
    if (this.conditions.length > 0) {
      query += ` WHERE ${this.conditions.join(' AND ')}`;
    }
    
    if (this.returningColumns.length > 0) {
      query += ` RETURNING ${this.returningColumns.join(', ')}`;
    }

    return { text: query, params: this.params };
  }

  async execute<T extends QueryResultRow = any>(): Promise<QueryResult<T>> {
    const { text, params } = this.build();
    return this.db.query<T>(text, params);
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
  // Parse DATABASE_URL if provided (priority)
  const databaseUrl = process.env.DATABASE_URL;
  let baseConfig: Partial<DatabaseConfig> = {};
  
  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      baseConfig = {
        host: url.hostname,
        port: parseInt(url.port) || 5432,
        database: url.pathname.slice(1),
        user: url.username,
        password: url.password,
        ssl: false,
        maxConnections: 200,
        minConnections: 2,
        idleTimeoutMs: 30000,
        connectionTimeoutMs: 10000,
        statementTimeout: 60000,
        queryTimeout: 30000,
        maxRetries: 3,
        retryDelay: 1000,
        applicationName: 'moonx-farm',
        enableMetrics: true,
        enableQueryLogging: false,
      };
    } catch (error) {
      logger.error('Invalid DATABASE_URL format, falling back to individual settings');
    }
  }

  // Merge with individual environment variables (can override URL settings)
  return {
    host: process.env.DB_HOST || baseConfig.host || 'localhost',
    port: parseInt(process.env.DB_PORT || '') || baseConfig.port || 5432,
    database: process.env.DB_NAME || baseConfig.database || 'moonx_farm',
    user: process.env.DB_USER || baseConfig.user || 'postgres',
    password: process.env.DB_PASSWORD || baseConfig.password || 'postgres',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : 
         process.env.DB_SSL === 'false' ? false : 
         baseConfig.ssl || false,
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '2'),
    idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
    statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '60000'),
    queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
    maxRetries: parseInt(process.env.DB_MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.DB_RETRY_DELAY || '1000'),
    applicationName: process.env.DB_APPLICATION_NAME || 'moonx-farm',
    enableMetrics: process.env.DB_ENABLE_METRICS !== 'false',
    enableQueryLogging: process.env.DB_ENABLE_QUERY_LOGGING === 'true',
  };
} 