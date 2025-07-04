"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseManager = void 0;
exports.createDatabase = createDatabase;
exports.createDatabaseConfig = createDatabaseConfig;
const pg_1 = require("pg");
const common_1 = require("@moonx-farm/common");
const logger = (0, common_1.createLogger)('database-infrastructure');
/**
 * Database manager class - simplified but robust
 */
class DatabaseManager {
    constructor(config) {
        this.isConnected = false;
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
    initializePool() {
        const poolConfig = {
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
        this.pool = new pg_1.Pool(poolConfig);
    }
    /**
     * Setup pool event handlers
     */
    setupEventHandlers() {
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
            }
            else {
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
    updateConnectionMetrics() {
        this.metrics.activeConnections = this.pool.totalCount;
        this.metrics.idleConnections = this.pool.idleCount;
        this.metrics.waitingConnections = this.pool.waitingCount;
    }
    /**
     * Execute query with monitoring
     */
    async executeQuery(text, params = [], options = {}) {
        const { timeout = this.config.queryTimeout || 30000, retries = this.config.maxRetries || 1, queryName } = options;
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
            let client;
            try {
                client = await this.pool.connect();
                // Set statement timeout
                if (timeout) {
                    await client.query(`SET statement_timeout = ${timeout}`);
                }
                const result = await client.query(text, params);
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
            }
            catch (error) {
                const err = error;
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
                    throw new common_1.DatabaseError(`Query failed after ${retries} attempts`, {
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
            }
            finally {
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
    updateQueryMetrics(duration, success) {
        if (success) {
            this.metrics.successfulQueries++;
            // Update average query time
            const total = this.metrics.successfulQueries;
            this.metrics.averageQueryTime =
                ((this.metrics.averageQueryTime * (total - 1)) + duration) / total;
        }
        else {
            this.metrics.failedQueries++;
            this.metrics.lastError = `Query failed in ${duration}ms`;
        }
    }
    /**
     * Connect to the database
     */
    async connect() {
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
        }
        catch (error) {
            const err = error;
            this.metrics.lastError = err.message;
            logger.error('Database connection failed', { error: err.message });
            throw new common_1.DatabaseError('Failed to connect to database', {
                originalError: err.message,
            });
        }
    }
    /**
     * Disconnect from the database
     */
    async disconnect() {
        try {
            await this.pool.end();
            this.isConnected = false;
            this.metrics.isConnected = false;
            logger.info('Database disconnected successfully');
        }
        catch (error) {
            const err = error;
            logger.error('Database disconnection failed', { error: err.message });
        }
    }
    /**
     * Execute a query with options
     */
    async query(text, params, options = {}) {
        return this.executeQuery(text, params || [], options);
    }
    /**
     * Execute multiple queries in a transaction with savepoints
     */
    async transaction(callback) {
        const transactionId = Math.random().toString(36).substring(7);
        const client = await this.pool.connect();
        this.metrics.transactionCount++;
        logger.debug('Starting database transaction', { transactionId });
        try {
            await client.query('BEGIN');
            const transaction = {
                query: async (text, params, options = {}) => {
                    if (this.config.enableQueryLogging) {
                        logger.debug('Executing transaction query', {
                            transactionId,
                            query: text.substring(0, 100),
                        });
                    }
                    const startTime = Date.now();
                    this.metrics.totalQueries++;
                    try {
                        const result = await client.query(text, params);
                        const duration = Date.now() - startTime;
                        this.updateQueryMetrics(duration, true);
                        return result;
                    }
                    catch (error) {
                        const duration = Date.now() - startTime;
                        this.updateQueryMetrics(duration, false);
                        throw error;
                    }
                },
                commit: async () => {
                    await client.query('COMMIT');
                    logger.debug('Transaction committed', { transactionId });
                },
                rollback: async () => {
                    await client.query('ROLLBACK');
                    this.metrics.rollbackCount++;
                    logger.debug('Transaction rolled back', { transactionId });
                },
                savepoint: async (name) => {
                    await client.query(`SAVEPOINT ${name}`);
                    logger.debug('Savepoint created', { transactionId, savepoint: name });
                },
                rollbackToSavepoint: async (name) => {
                    await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
                    logger.debug('Rolled back to savepoint', { transactionId, savepoint: name });
                },
                releaseSavepoint: async (name) => {
                    await client.query(`RELEASE SAVEPOINT ${name}`);
                    logger.debug('Savepoint released', { transactionId, savepoint: name });
                },
                getTransactionId: () => transactionId
            };
            const result = await callback(transaction);
            await client.query('COMMIT');
            logger.info('Transaction completed successfully', { transactionId });
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            this.metrics.rollbackCount++;
            const err = error;
            logger.error('Transaction failed and rolled back', {
                transactionId,
                error: err.message,
            });
            throw new common_1.DatabaseError('Transaction failed', {
                transactionId,
                originalError: err.message,
            });
        }
        finally {
            client.release();
        }
    }
    /**
     * Health check
     */
    async healthCheck() {
        try {
            const client = await this.pool.connect();
            await client.query('SELECT 1');
            client.release();
            return true;
        }
        catch (error) {
            const err = error;
            logger.error('Database health check failed', { error: err.message });
            return false;
        }
    }
    /**
     * Check if database is connected and healthy
     */
    isHealthy() {
        return this.isConnected && this.pool.totalCount > 0;
    }
    /**
     * Get database metrics
     */
    getMetrics() {
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
    async raw(text, params) {
        const client = await this.pool.connect();
        try {
            if (this.config.enableQueryLogging) {
                logger.info('Executing raw query', { query: text.substring(0, 100) });
            }
            return await client.query(text, params);
        }
        finally {
            client.release();
        }
    }
    /**
     * Query builder: SELECT
     */
    select(table, columns = ['*']) {
        return new SelectQuery(this, table, columns);
    }
    /**
     * Query builder: INSERT
     */
    insert(table, data) {
        return new InsertQuery(this, table, data);
    }
    /**
     * Query builder: UPDATE
     */
    update(table, data) {
        return new UpdateQuery(this, table, data);
    }
    /**
     * Query builder: DELETE
     */
    delete(table) {
        return new DeleteQuery(this, table);
    }
    /**
     * Execute batch queries efficiently
     */
    async batch(queries) {
        const client = await this.pool.connect();
        try {
            const results = [];
            await client.query('BEGIN');
            for (const query of queries) {
                const result = await client.query(query.text, query.params);
                results.push(result);
            }
            await client.query('COMMIT');
            return results;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Get underlying pool for advanced operations
     */
    getPool() {
        return this.pool;
    }
}
exports.DatabaseManager = DatabaseManager;
// Query Builder Implementations
class SelectQuery {
    constructor(db, table, columns) {
        this.db = db;
        this.table = table;
        this.columns = columns;
        this.conditions = [];
        this.params = [];
        this.orderByClauses = [];
        this.joins = [];
    }
    where(conditions, params) {
        if (typeof conditions === 'string') {
            this.conditions.push(conditions);
            if (params)
                this.params.push(...params);
        }
        else {
            const keys = Object.keys(conditions);
            const clause = keys.map((key, index) => `${key} = $${this.params.length + index + 1}`).join(' AND ');
            this.conditions.push(clause);
            this.params.push(...Object.values(conditions));
        }
        return this;
    }
    orderBy(column, direction = 'ASC') {
        this.orderByClauses.push(`${column} ${direction}`);
        return this;
    }
    limit(count) {
        this.limitValue = count;
        return this;
    }
    offset(count) {
        this.offsetValue = count;
        return this;
    }
    join(table, condition) {
        this.joins.push(`JOIN ${table} ON ${condition}`);
        return this;
    }
    leftJoin(table, condition) {
        this.joins.push(`LEFT JOIN ${table} ON ${condition}`);
        return this;
    }
    build() {
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
    async execute() {
        const { text, params } = this.build();
        return this.db.query(text, params);
    }
}
class InsertQuery {
    constructor(db, table, data) {
        this.db = db;
        this.table = table;
        this.data = data;
        this.returningColumns = [];
    }
    returning(columns) {
        this.returningColumns = columns;
        return this;
    }
    onConflict(constraint, action) {
        this.conflictClause = `ON CONFLICT ${constraint} ${action}`;
        return this;
    }
    build() {
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
    async execute() {
        const { text, params } = this.build();
        return this.db.query(text, params);
    }
}
class UpdateQuery {
    constructor(db, table, data) {
        this.db = db;
        this.table = table;
        this.data = data;
        this.conditions = [];
        this.params = [];
        this.returningColumns = [];
    }
    where(conditions, params) {
        const dataValues = Object.values(this.data);
        if (typeof conditions === 'string') {
            this.conditions.push(conditions);
            if (params)
                this.params.push(...params);
        }
        else {
            const keys = Object.keys(conditions);
            const clause = keys.map((key, index) => `${key} = $${dataValues.length + this.params.length + index + 1}`).join(' AND ');
            this.conditions.push(clause);
            this.params.push(...Object.values(conditions));
        }
        return this;
    }
    returning(columns) {
        this.returningColumns = columns;
        return this;
    }
    build() {
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
    async execute() {
        const { text, params } = this.build();
        return this.db.query(text, params);
    }
}
class DeleteQuery {
    constructor(db, table) {
        this.db = db;
        this.table = table;
        this.conditions = [];
        this.params = [];
        this.returningColumns = [];
    }
    where(conditions, params) {
        if (typeof conditions === 'string') {
            this.conditions.push(conditions);
            if (params)
                this.params.push(...params);
        }
        else {
            const keys = Object.keys(conditions);
            const clause = keys.map((key, index) => `${key} = $${this.params.length + index + 1}`).join(' AND ');
            this.conditions.push(clause);
            this.params.push(...Object.values(conditions));
        }
        return this;
    }
    returning(columns) {
        this.returningColumns = columns;
        return this;
    }
    build() {
        let query = `DELETE FROM ${this.table}`;
        if (this.conditions.length > 0) {
            query += ` WHERE ${this.conditions.join(' AND ')}`;
        }
        if (this.returningColumns.length > 0) {
            query += ` RETURNING ${this.returningColumns.join(', ')}`;
        }
        return { text: query, params: this.params };
    }
    async execute() {
        const { text, params } = this.build();
        return this.db.query(text, params);
    }
}
/**
 * Create a database manager instance
 */
function createDatabase(config) {
    return new DatabaseManager(config);
}
/**
 * Create database configuration from environment
 */
function createDatabaseConfig() {
    // Parse DATABASE_URL if provided (priority)
    const databaseUrl = process.env.DATABASE_URL;
    let baseConfig = {};
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
        }
        catch (error) {
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
