import mongoose, {
    Connection,
    Model,
    Document,
    Schema,
    ConnectOptions,
    FilterQuery,
    UpdateQuery,
    QueryOptions as MongooseQueryOptions,
    PipelineStage,
    PopulateOptions,
    ClientSession,
    Types,
    HydratedDocument,
    AggregateOptions,
    CreateOptions
} from 'mongoose';
import { createLogger, DatabaseError } from '@moonx-farm/common';
import { isDevelopment } from '@moonx-farm/configs';

const logger = createLogger('mongodb-infrastructure');

/**
 * MongoDB configuration options with comprehensive settings
 */
export interface MongoConfig {
    // Basic connection
    uri: string;
    database?: string;
    // Connection options
    maxPoolSize?: number;
    minPoolSize?: number;
    maxIdleTimeMS?: number;
    serverSelectionTimeoutMS?: number;
    socketTimeoutMS?: number;
    connectTimeoutMS?: number;
    // Authentication
    authSource?: string;
    authMechanism?: string;
    // SSL/TLS
    ssl?: boolean;
    sslCA?: string;
    sslCert?: string;
    sslKey?: string;
    // Performance
    bufferCommands?: boolean;
    // Features
    enableMetrics?: boolean;
    enableQueryLogging?: boolean;
    retryWrites?: boolean;
    retryReads?: boolean;
    // Replica set
    replicaSet?: string;
    readPreference?: string;
    // Write concern
    writeConcern?: {
        w?: number | string;
        j?: boolean;
        wtimeout?: number;
    };
    // Read concern
    readConcern?: {
        level?: string;
    };
}

/**
 * MongoDB query options with type safety
 */
export interface QueryOptions {
    timeout?: number;
    retries?: number;
    session?: ClientSession;
    queryName?: string;
    lean?: boolean;
    populate?: string | string[] | PopulateOptions | PopulateOptions[];
    select?: string | Record<string, any>;
    sort?: string | Record<string, any>;
    limit?: number;
    skip?: number;
    maxTimeMS?: number;
    hint?: string | Record<string, any>;
    upsert?: boolean;
    returnDocument?: 'before' | 'after';
    collation?: {
        locale?: string;
        caseLevel?: boolean;
        caseFirst?: string;
        strength?: number;
        numericOrdering?: boolean;
        alternate?: string;
        maxVariable?: string;
        backwards?: boolean;
    };
}

/**
 * MongoDB metrics interface for monitoring
 */
export interface MongoMetrics {
    totalQueries: number;
    successfulQueries: number;
    failedQueries: number;
    averageQueryTime: number;
    activeConnections: number;
    availableConnections: number;
    totalConnections: number;
    transactionCount: number;
    rollbackCount: number;
    isConnected: boolean;
    lastError?: string;
    collectionsCount: number;
    documentsCount: number;
    uptime: number;
    lastHealthCheck?: Date;
}

/**
 * MongoDB transaction interface with comprehensive operations
 */
export interface MongoTransaction {
    readonly session: ClientSession;
    findOne<T extends Document = Document>(
        model: Model<T>,
        filter: FilterQuery<T>,
        options?: QueryOptions
    ): Promise<HydratedDocument<T> | null>;
    findMany<T extends Document = Document>(
        model: Model<T>,
        filter: FilterQuery<T>,
        options?: QueryOptions
    ): Promise<HydratedDocument<T>[]>;
    create<T extends Document = Document>(
        model: Model<T>,
        data: Partial<T>,
        options?: QueryOptions
    ): Promise<HydratedDocument<T>>;
    updateOne<T extends Document = Document>(
        model: Model<T>,
        filter: FilterQuery<T>,
        update: UpdateQuery<T>,
        options?: QueryOptions
    ): Promise<HydratedDocument<T> | null>;
    updateMany<T extends Document = Document>(
        model: Model<T>,
        filter: FilterQuery<T>,
        update: UpdateQuery<T>,
        options?: QueryOptions
    ): Promise<{ matchedCount: number; modifiedCount: number }>;
    upsert<T extends Document = Document>(
        model: Model<T>,
        filter: FilterQuery<T>,
        update: UpdateQuery<T>,
        options?: QueryOptions
    ): Promise<HydratedDocument<T>>;
    deleteOne<T extends Document = Document>(
        model: Model<T>,
        filter: FilterQuery<T>,
        options?: QueryOptions
    ): Promise<HydratedDocument<T> | null>;
    deleteMany<T extends Document = Document>(
        model: Model<T>,
        filter: FilterQuery<T>,
        options?: QueryOptions
    ): Promise<{ deletedCount: number }>;
    aggregate<T extends Document = Document>(
        model: Model<T>,
        pipeline: PipelineStage[],
        options?: QueryOptions
    ): Promise<any[]>;
    count<T extends Document = Document>(
        model: Model<T>,
        filter: FilterQuery<T>,
        options?: QueryOptions
    ): Promise<number>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    getSessionId(): string;
}

/**
 * Connection state constants for better type safety
 */
export const ConnectionState = {
    DISCONNECTED: 0,
    CONNECTED: 1,
    CONNECTING: 2,
    DISCONNECTING: 3
} as const;

/**
 * MongoDB manager class with comprehensive functionality
 */
export class MongoManager {
    private connection: Connection | null = null;
    private isConnected = false;
    private metrics: MongoMetrics;
    private readonly config: MongoConfig;
    private readonly models: Map<string, Model<any>> = new Map();
    private readonly startTime = Date.now();
    private healthCheckInterval?: NodeJS.Timeout;
    private readonly connectionId: string;

    constructor(config: MongoConfig) {
        this.config = { ...config }; // Create a copy to avoid mutation
        this.connectionId = Buffer.from(this.config.uri).toString('base64').slice(0, 8);
        this.metrics = this.initializeMetrics();
        this.startHealthMonitoring();
        
        logger.info('MongoManager initialized', {
            connectionId: this.connectionId,
            database: this.config.database
        });
    }

    /**
     * Initialize metrics with default values
     */
    private initializeMetrics(): MongoMetrics {
        return {
            totalQueries: 0,
            successfulQueries: 0,
            failedQueries: 0,
            averageQueryTime: 0,
            activeConnections: 0,
            availableConnections: 0,
            totalConnections: 0,
            transactionCount: 0,
            rollbackCount: 0,
            isConnected: false,
            collectionsCount: 0,
            documentsCount: 0,
            uptime: 0,
            lastHealthCheck: undefined
        };
    }

    /**
     * Setup connection event handlers with proper error handling
     */
    private setupEventHandlers(connection: Connection): void {
        connection.on('connected', () => {
            this.isConnected = true;
            this.metrics.isConnected = true;
            this.updateConnectionMetrics();
            logger.info('MongoDB connection established', {
                connectionId: this.connectionId,
                host: connection.host,
                port: connection.port,
                name: connection.name
            });
        });

        connection.on('error', (error) => {
            this.metrics.lastError = error.message;
            this.isConnected = false;
            this.metrics.isConnected = false;
            logger.error('MongoDB connection error', { 
                connectionId: this.connectionId,
                error: error.message 
            });
        });

        connection.on('disconnected', () => {
            this.isConnected = false;
            this.metrics.isConnected = false;
            logger.warn('MongoDB connection lost', { 
                connectionId: this.connectionId 
            });
        });

        connection.on('reconnected', () => {
            this.isConnected = true;
            this.metrics.isConnected = true;
            this.updateConnectionMetrics();
            logger.info('MongoDB reconnected', { 
                connectionId: this.connectionId 
            });
        });

        connection.on('close', () => {
            this.isConnected = false;
            this.metrics.isConnected = false;
            logger.info('MongoDB connection closed', { 
                connectionId: this.connectionId 
            });
        });
    }

    /**
     * Start health monitoring with periodic checks
     */
    private startHealthMonitoring(): void {
        if (this.config.enableMetrics !== false) {
            this.healthCheckInterval = setInterval(() => {
                this.performHealthCheck();
            }, 30000); // Check every 30 seconds
        }
    }

    /**
     * Perform health check and update metrics
     */
    private async performHealthCheck(): Promise<void> {
        try {
            await this.healthCheck();
            this.metrics.lastHealthCheck = new Date();
        } catch (error) {
            logger.warn('Health check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }

    /**
     * Update connection metrics safely
     */
    private updateConnectionMetrics(): void {
        if (this.connection) {
            const readyState = this.connection.readyState;
            this.metrics.activeConnections = readyState === ConnectionState.CONNECTED ? 1 : 0;
            this.metrics.totalConnections = 1;
            this.metrics.availableConnections = readyState === ConnectionState.CONNECTED ? 1 : 0;
            this.metrics.uptime = Date.now() - this.startTime;
        }
    }

    /**
     * Execute operation with comprehensive metrics tracking and error handling
     */
    private async executeWithMetrics<T>(
        operation: () => Promise<T>,
        operationName: string
    ): Promise<T> {
        const startTime = Date.now();
        this.metrics.totalQueries++;

        try {
            const result = await operation();
            this.metrics.successfulQueries++;
            this.updateQueryMetrics(Date.now() - startTime, true);

            if (this.config.enableQueryLogging) {
                logger.debug(`MongoDB operation completed: ${operationName}`, {
                    duration: Date.now() - startTime,
                    timestamp: new Date().toISOString()
                });
            }

            return result;
        } catch (error) {
            this.metrics.failedQueries++;
            this.metrics.lastError = error instanceof Error ? error.message : 'Unknown error';
            this.updateQueryMetrics(Date.now() - startTime, false);

            logger.error(`MongoDB operation failed: ${operationName}`, {
                error: error instanceof Error ? error.message : 'Unknown error',
                duration: Date.now() - startTime,
                stack: error instanceof Error ? error.stack : undefined
            });

            throw new DatabaseError(`MongoDB operation failed: ${operationName}`, {
                originalError: error,
                operation: operationName
            });
        }
    }

    /**
     * Update query metrics with proper calculation
     */
    private updateQueryMetrics(duration: number, success: boolean): void {
        if (this.metrics.totalQueries > 0) {
            this.metrics.averageQueryTime =
                (this.metrics.averageQueryTime * (this.metrics.totalQueries - 1) + duration) /
                this.metrics.totalQueries;
        }
    }

    /**
     * Build connection options safely
     */
    private buildConnectionOptions(): ConnectOptions {
        const options: ConnectOptions = {
            maxPoolSize: this.config.maxPoolSize || 10,
            minPoolSize: this.config.minPoolSize || 1,
            maxIdleTimeMS: this.config.maxIdleTimeMS || 30000,
            serverSelectionTimeoutMS: this.config.serverSelectionTimeoutMS || 5000,
            socketTimeoutMS: this.config.socketTimeoutMS || 45000,
            connectTimeoutMS: this.config.connectTimeoutMS || 10000,
            bufferCommands: this.config.bufferCommands ?? false,
            retryWrites: this.config.retryWrites ?? true,
            retryReads: this.config.retryReads ?? true,
            ...(this.config.authSource && { authSource: this.config.authSource }),
            ...(this.config.authMechanism && { authMechanism: this.config.authMechanism as any }),
            ...(this.config.ssl && { ssl: this.config.ssl }),
            ...(this.config.sslCA && { sslCA: this.config.sslCA }),
            ...(this.config.sslCert && { sslCert: this.config.sslCert }),
            ...(this.config.sslKey && { sslKey: this.config.sslKey }),
            ...(this.config.replicaSet && { replicaSet: this.config.replicaSet }),
            ...(this.config.readPreference && { readPreference: this.config.readPreference as any }),
            ...(this.config.writeConcern && { writeConcern: this.config.writeConcern as any }),
            ...(this.config.readConcern && { readConcern: this.config.readConcern as any })
        };

        return options;
    }

    /**
     * Connect to MongoDB with proper error handling
     */
    async connect(): Promise<void> {
        if (this.isConnected) {
            logger.warn('MongoDB already connected', { connectionId: this.connectionId });
            return;
        }

        try {
            const options = this.buildConnectionOptions();
            
            // Use createConnection() instead of connect() to support multiple connections
            this.connection = await mongoose.createConnection(this.config.uri, options);
            
            // Setup event handlers for this specific connection
            this.setupEventHandlers(this.connection);
            
            // Wait for connection to be established
            await new Promise<void>((resolve, reject) => {
                if (this.connection!.readyState === 1) {
                    resolve();
                    return;
                }
                
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 10000);
                
                this.connection!.once('connected', () => {
                    clearTimeout(timeout);
                    resolve();
                });
                
                this.connection!.once('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });

            this.isConnected = true;
            this.metrics.isConnected = true;

            logger.info('MongoDB connected successfully', {
                connectionId: this.connectionId,
                host: this.connection.host,
                port: this.connection.port,
                name: this.connection.name,
                readyState: this.connection.readyState
            });
        } catch (error) {
            const sanitizedUri = this.config.uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
            logger.error('Failed to connect to MongoDB', {
                connectionId: this.connectionId,
                error: error instanceof Error ? error.message : 'Unknown error',
                uri: sanitizedUri
            });
            throw new DatabaseError('Failed to connect to MongoDB', { originalError: error });
        }
    }

    /**
     * Disconnect from MongoDB safely
     */
    async disconnect(): Promise<void> {
        if (!this.isConnected || !this.connection) {
            logger.warn('MongoDB not connected', { connectionId: this.connectionId });
            return;
        }

        try {
            // Clear health check interval
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = undefined;
            }

            // Close the specific connection instead of global disconnect
            await this.connection.close();
            
            this.isConnected = false;
            this.metrics.isConnected = false;
            this.connection = null;
            
            logger.info('MongoDB disconnected successfully', { 
                connectionId: this.connectionId 
            });
        } catch (error) {
            logger.error('Error disconnecting from MongoDB', {
                connectionId: this.connectionId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw new DatabaseError('Failed to disconnect from MongoDB', { originalError: error });
        }
    }

    /**
     * Register a Mongoose model with validation
     */
    registerModel<T extends Document>(name: string, schema: Schema<T>): Model<T> {
        if (!name || typeof name !== 'string') {
            throw new Error('Model name must be a non-empty string');
        }

        if (this.models.has(name)) {
            logger.warn(`Model '${name}' already exists, returning existing model`, {
                connectionId: this.connectionId
            });
            return this.models.get(name) as Model<T>;
        }

        try {
            let model: Model<T>;
            
            if (this.connection) {
                // Use connection-specific model registration to avoid global conflicts
                model = this.connection.model<T>(name, schema);
            } else {
                // If connection not established yet, use global mongoose (fallback)
                logger.warn(`Connection not established, using global mongoose for model '${name}'`, {
                    connectionId: this.connectionId
                });
                model = mongoose.model<T>(name, schema);
            }
            
            this.models.set(name, model);
            logger.info(`Model '${name}' registered successfully`, {
                connectionId: this.connectionId,
                usingConnection: !!this.connection
            });
            return model;
        } catch (error) {
            logger.error(`Failed to register model '${name}'`, {
                connectionId: this.connectionId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw new DatabaseError(`Failed to register model '${name}'`, { originalError: error });
        }
    }

    /**
     * Get a registered model with validation
     */
    getModel<T extends Document>(name: string): Model<T> {
        if (!name || typeof name !== 'string') {
            throw new Error('Model name must be a non-empty string');
        }

        const model = this.models.get(name);
        if (!model) {
            throw new Error(`Model '${name}' not found. Please register it first.`);
        }
        return model as Model<T>;
    }

    /**
     * Find one document with proper type handling
     */
    async findOne<T extends Document = Document>(
        model: Model<T>,
        filter: FilterQuery<T>,
        options: QueryOptions = {}
    ): Promise<HydratedDocument<T> | null> {
        return this.executeWithMetrics(async () => {
            let query: any = model.findOne(filter, options.select);

            if (options.populate) {
                if (Array.isArray(options.populate)) {
                    query = query.populate(options.populate as PopulateOptions[]);
                } else if (typeof options.populate === 'string') {
                    query = query.populate(options.populate);
                } else {
                    query = query.populate(options.populate as PopulateOptions);
                }
            }

            if (options.sort) {
                query = query.sort(options.sort);
            }

            if (options.maxTimeMS) {
                query = query.maxTimeMS(options.maxTimeMS);
            }

            if (options.hint) {
                query = query.hint(options.hint);
            }

            if (options.collation) {
                query = query.collation(options.collation);
            }

            if (options.lean) {
                query = query.lean();
            }

            if (options.session) {
                query = query.session(options.session);
            }

            return await query.exec() as HydratedDocument<T> | null;
        }, `findOne(${model.modelName})`);
    }

    /**
     * Find many documents with proper type handling
     */
    async findMany<T extends Document = Document>(
        model: Model<T>,
        filter: FilterQuery<T>,
        options: QueryOptions = {}
    ): Promise<HydratedDocument<T>[]> {
        return this.executeWithMetrics(async () => {
            let query: any = model.find(filter, options.select);

            if (options.populate) {
                if (Array.isArray(options.populate)) {
                    query = query.populate(options.populate as PopulateOptions[]);
                } else if (typeof options.populate === 'string') {
                    query = query.populate(options.populate);
                } else {
                    query = query.populate(options.populate as PopulateOptions);
                }
            }

            if (options.sort) {
                query = query.sort(options.sort);
            }

            if (options.limit) {
                query = query.limit(options.limit);
            }

            if (options.skip) {
                query = query.skip(options.skip);
            }

            if (options.maxTimeMS) {
                query = query.maxTimeMS(options.maxTimeMS);
            }

            if (options.hint) {
                query = query.hint(options.hint);
            }

            if (options.collation) {
                query = query.collation(options.collation);
            }

            if (options.lean) {
                query = query.lean();
            }

            if (options.session) {
                query = query.session(options.session);
            }

            return await query.exec() as HydratedDocument<T>[];
        }, `findMany(${model.modelName})`);
    }

    /**
     * Create a new document with proper options handling
     */
    async create<T extends Document = Document>(
        model: Model<T>,
        data: Partial<T>,
        options: QueryOptions = {}
    ): Promise<HydratedDocument<T>> {
        return this.executeWithMetrics(async () => {
            const createOptions: CreateOptions = {};

            if (options.session) {
                createOptions.session = options.session;
            }

            const [result] = await model.create([data], createOptions);
            return result as HydratedDocument<T>;
        }, `create(${model.modelName})`);
    }

    /**
     * Update one document with proper options handling
     */
    async updateOne<T extends Document = Document>(
        model: Model<T>,
        filter: FilterQuery<T>,
        update: UpdateQuery<T>,
        options: QueryOptions = {}
    ): Promise<HydratedDocument<T> | null> {
        return this.executeWithMetrics(async () => {
            const updateOptions: MongooseQueryOptions = {
                new: true,
                runValidators: true
            };

            if (options.session) {
                updateOptions.session = options.session;
            }

            if (options.maxTimeMS) {
                updateOptions.maxTimeMS = options.maxTimeMS;
            }

            if (options.upsert) {
                updateOptions.upsert = options.upsert;
            }

            if (options.returnDocument) {
                updateOptions.returnDocument = options.returnDocument;
            }

            return await model.findOneAndUpdate(filter, update, updateOptions).exec();
        }, `updateOne(${model.modelName})`);
    }

    /**
     * Update many documents with proper options handling
     */
    async updateMany<T extends Document = Document>(
        model: Model<T>,
        filter: FilterQuery<T>,
        update: UpdateQuery<T>,
        options: QueryOptions = {}
    ): Promise<{ matchedCount: number; modifiedCount: number }> {
        return this.executeWithMetrics(async () => {
            const updateOptions: MongooseQueryOptions = {
                runValidators: true
            };

            if (options.session) {
                updateOptions.session = options.session;
            }

            if (options.maxTimeMS) {
                updateOptions.maxTimeMS = options.maxTimeMS;
            }

            if (options.upsert) {
                updateOptions.upsert = options.upsert;
            }

            const result = await model.updateMany(filter, update, updateOptions as any).exec();
            return {
                matchedCount: result.matchedCount || 0,
                modifiedCount: result.modifiedCount || 0
            };
        }, `updateMany(${model.modelName})`);
    }

    /**
     * Upsert document - insert if not exists, update if exists
     */
    async upsert<T extends Document = Document>(
        model: Model<T>,
        filter: FilterQuery<T>,
        update: UpdateQuery<T>,
        options: QueryOptions = {}
    ): Promise<HydratedDocument<T>> {
        return this.executeWithMetrics(async () => {
            const updateOptions: MongooseQueryOptions = {
                new: true,
                upsert: true,
                runValidators: true
            };

            if (options.session) {
                updateOptions.session = options.session;
            }

            if (options.maxTimeMS) {
                updateOptions.maxTimeMS = options.maxTimeMS;
            }

            if (options.returnDocument) {
                updateOptions.returnDocument = options.returnDocument;
            }

            const result = await model.findOneAndUpdate(filter, update, updateOptions).exec();
            if (!result) {
                throw new Error('Upsert operation failed');
            }
            return result;
        }, `upsert(${model.modelName})`);
    }

    /**
     * Delete one document with proper options handling
     */
    async deleteOne<T extends Document = Document>(
        model: Model<T>,
        filter: FilterQuery<T>,
        options: QueryOptions = {}
    ): Promise<HydratedDocument<T> | null> {
        return this.executeWithMetrics(async () => {
            const deleteOptions: MongooseQueryOptions = {};

            if (options.session) {
                deleteOptions.session = options.session;
            }

            if (options.maxTimeMS) {
                deleteOptions.maxTimeMS = options.maxTimeMS;
            }

            return await model.findOneAndDelete(filter, deleteOptions).exec();
        }, `deleteOne(${model.modelName})`);
    }

    /**
     * Delete many documents with proper options handling
     */
    async deleteMany<T extends Document = Document>(
        model: Model<T>,
        filter: FilterQuery<T>,
        options: QueryOptions = {}
    ): Promise<{ deletedCount: number }> {
        return this.executeWithMetrics(async () => {
            const deleteOptions: MongooseQueryOptions = {};

            if (options.session) {
                deleteOptions.session = options.session;
            }

            if (options.maxTimeMS) {
                deleteOptions.maxTimeMS = options.maxTimeMS;
            }

            const result = await model.deleteMany(filter, deleteOptions as any).exec();
            return {
                deletedCount: result.deletedCount || 0
            };
        }, `deleteMany(${model.modelName})`);
    }

    /**
     * Aggregate documents with proper options handling
     */
    async aggregate<T extends Document = Document>(
        model: Model<T>,
        pipeline: PipelineStage[],
        options: QueryOptions = {}
    ): Promise<any[]> {
        return this.executeWithMetrics(async () => {
            const aggregateOptions: AggregateOptions = {};

            if (options.session) {
                aggregateOptions.session = options.session;
            }

            if (options.maxTimeMS) {
                aggregateOptions.maxTimeMS = options.maxTimeMS;
            }

            if (options.hint) {
                aggregateOptions.hint = options.hint;
            }

            if (options.collation) {
                aggregateOptions.collation = options.collation as any;
            }

            return await model.aggregate(pipeline, aggregateOptions).exec();
        }, `aggregate(${model.modelName})`);
    }

    /**
     * Count documents with proper options handling
     */
    async count<T extends Document = Document>(
        model: Model<T>,
        filter: FilterQuery<T>,
        options: QueryOptions = {}
    ): Promise<number> {
        return this.executeWithMetrics(async () => {
            let query = model.countDocuments(filter);

            if (options.session) {
                query = query.session(options.session);
            }

            if (options.maxTimeMS) {
                query = query.maxTimeMS(options.maxTimeMS);
            }

            if (options.hint) {
                query = query.hint(options.hint);
            }

            return await query.exec();
        }, `count(${model.modelName})`);
    }

    /**
     * Execute transaction with comprehensive error handling
     */
    async transaction<T>(
        callback: (tx: MongoTransaction) => Promise<T>
    ): Promise<T> {
        const session = await mongoose.startSession();
        this.metrics.transactionCount++;

        try {
            const result = await session.withTransaction(async () => {
                const transaction: MongoTransaction = {
                    session,
                    findOne: <U extends Document = Document>(model: Model<U>, filter: FilterQuery<U>, options: QueryOptions = {}) =>
                        this.findOne(model, filter, { ...options, session }),
                    findMany: <U extends Document = Document>(model: Model<U>, filter: FilterQuery<U>, options: QueryOptions = {}) =>
                        this.findMany(model, filter, { ...options, session }),
                    create: <U extends Document = Document>(model: Model<U>, data: Partial<U>, options: QueryOptions = {}) =>
                        this.create(model, data, { ...options, session }),
                    updateOne: <U extends Document = Document>(model: Model<U>, filter: FilterQuery<U>, update: UpdateQuery<U>, options: QueryOptions = {}) =>
                        this.updateOne(model, filter, update, { ...options, session }),
                    updateMany: <U extends Document = Document>(model: Model<U>, filter: FilterQuery<U>, update: UpdateQuery<U>, options: QueryOptions = {}) =>
                        this.updateMany(model, filter, update, { ...options, session }),
                    upsert: <U extends Document = Document>(model: Model<U>, filter: FilterQuery<U>, update: UpdateQuery<U>, options: QueryOptions = {}) =>
                        this.upsert(model, filter, update, { ...options, session }),
                    deleteOne: <U extends Document = Document>(model: Model<U>, filter: FilterQuery<U>, options: QueryOptions = {}) =>
                        this.deleteOne(model, filter, { ...options, session }),
                    deleteMany: <U extends Document = Document>(model: Model<U>, filter: FilterQuery<U>, options: QueryOptions = {}) =>
                        this.deleteMany(model, filter, { ...options, session }),
                    aggregate: <U extends Document = Document>(model: Model<U>, pipeline: PipelineStage[], options: QueryOptions = {}) =>
                        this.aggregate(model, pipeline, { ...options, session }),
                    count: <U extends Document = Document>(model: Model<U>, filter: FilterQuery<U>, options: QueryOptions = {}) =>
                        this.count(model, filter, { ...options, session }),
                    commit: async () => {
                        await session.commitTransaction();
                    },
                    rollback: async () => {
                        await session.abortTransaction();
                        this.metrics.rollbackCount++;
                    },
                    getSessionId: () => session.id?.toString() || 'unknown'
                };

                return await callback(transaction);
            });

            return result;
        } catch (error) {
            this.metrics.rollbackCount++;
            logger.error('MongoDB transaction failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            });
            throw new DatabaseError('MongoDB transaction failed', { originalError: error });
        } finally {
            await session.endSession();
        }
    }

    /**
     * Health check with proper error handling
     */
    async healthCheck(): Promise<boolean> {
        try {
            if (!this.connection || !this.connection.db) {
                return false;
            }

            await this.connection.db.admin().ping();
            return true;
        } catch (error) {
            logger.error('MongoDB health check failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }

    /**
     * Check if connection is healthy
     */
    isHealthy(): boolean {
        return this.isConnected &&
            this.connection?.readyState === ConnectionState.CONNECTED &&
            this.connection?.db !== undefined;
    }

    /**
     * Get comprehensive metrics
     */
    getMetrics(): MongoMetrics {
        this.updateConnectionMetrics();
        return { ...this.metrics };
    }

    /**
     * Get detailed connection stats
     */
    getConnectionStats() {
        return {
            isConnected: this.isConnected,
            readyState: this.connection?.readyState,
            host: this.connection?.host,
            port: this.connection?.port,
            name: this.connection?.name,
            models: Array.from(this.models.keys()),
            uptime: Date.now() - this.startTime,
            lastHealthCheck: this.metrics.lastHealthCheck,
            totalQueries: this.metrics.totalQueries,
            successfulQueries: this.metrics.successfulQueries,
            failedQueries: this.metrics.failedQueries,
            averageQueryTime: this.metrics.averageQueryTime
        };
    }

    /**
     * Get native MongoDB connection
     */
    getConnection(): Connection | null {
        return this.connection;
    }

    /**
     * Get mongoose instance
     */
    getMongoose(): typeof mongoose {
        return mongoose;
    }

    /**
     * Drop database with safety checks (development only)
     */
    async dropDatabase(): Promise<void> {
        if (!isDevelopment()) {
            throw new Error('Database drop is only allowed in development environment');
        }

        if (!this.connection?.db) {
            throw new Error('Database connection not available');
        }

        return this.executeWithMetrics(async () => {
            await this.connection!.db!.dropDatabase();
            logger.warn('MongoDB database dropped');
        }, 'dropDatabase');
    }

    /**
     * Create indexes for a model with error handling
     */
    async createIndexes<T extends Document>(model: Model<T>): Promise<void> {
        return this.executeWithMetrics(async () => {
            await model.createIndexes();
            logger.info(`Indexes created for model: ${model.modelName}`);
        }, `createIndexes(${model.modelName})`);
    }

    /**
     * Drop indexes for a model with error handling
     */
    async dropIndexes<T extends Document>(model: Model<T>): Promise<void> {
        return this.executeWithMetrics(async () => {
            await model.collection.dropIndexes();
            logger.info(`Indexes dropped for model: ${model.modelName}`);
        }, `dropIndexes(${model.modelName})`);
    }

    /**
     * Get collection statistics
     */
    async getCollectionStats<T extends Document>(model: Model<T>): Promise<any> {
        return this.executeWithMetrics(async () => {
            const stats = await (model.collection as any).stats();
            return stats;
        }, `getCollectionStats(${model.modelName})`);
    }

    /**
     * Bulk upsert operation for multiple documents
     */
    async bulkUpsert<T extends Document = Document>(
        model: Model<T>,
        operations: Array<{
            filter: FilterQuery<T>;
            update: UpdateQuery<T>;
        }>,
        options: QueryOptions = {}
    ): Promise<{ upsertedCount: number; modifiedCount: number }> {
        return this.executeWithMetrics(async () => {
            const bulkOps = operations.map(op => ({
                updateOne: {
                    filter: op.filter,
                    update: op.update,
                    upsert: true
                }
            }));

            const result = await model.bulkWrite(bulkOps as any, {
                session: options.session,
                ordered: false
            });

            return {
                upsertedCount: result.upsertedCount || 0,
                modifiedCount: result.modifiedCount || 0
            };
        }, `bulkUpsert(${model.modelName})`);
    }

    /**
     * Clean up resources
     */
    async cleanup(): Promise<void> {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = undefined;
        }

        if (this.isConnected) {
            await this.disconnect();
        }
    }
}

/**
 * Factory function to create MongoManager with validation
 */
export function createMongo(config: MongoConfig): MongoManager {
    if (!config.uri) {
        throw new Error('MongoDB URI is required');
    }

    return new MongoManager(config);
}

/**
 * Factory function to create MongoDB configuration with environment variables
 */
export function createMongoConfig(): MongoConfig {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/moonx-farm';

    if (!uri) {
        throw new Error('MONGODB_URI environment variable is required');
    }

    return {
        uri,
        database: process.env.MONGODB_DATABASE || 'moonx-farm',
        maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10', 10),
        minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '1', 10),
        maxIdleTimeMS: parseInt(process.env.MONGODB_MAX_IDLE_TIME_MS || '30000', 10),
        serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || '5000', 10),
        socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT_MS || '45000', 10),
        connectTimeoutMS: parseInt(process.env.MONGODB_CONNECT_TIMEOUT_MS || '10000', 10),
        authSource: process.env.MONGODB_AUTH_SOURCE,
        authMechanism: process.env.MONGODB_AUTH_MECHANISM,
        ssl: process.env.MONGODB_SSL === 'true',
        enableMetrics: process.env.MONGODB_ENABLE_METRICS !== 'false',
        enableQueryLogging: process.env.MONGODB_ENABLE_QUERY_LOGGING === 'true',
        retryWrites: process.env.MONGODB_RETRY_WRITES !== 'false',
        retryReads: process.env.MONGODB_RETRY_READS !== 'false',
        replicaSet: process.env.MONGODB_REPLICA_SET,
        readPreference: process.env.MONGODB_READ_PREFERENCE || 'primary',
        writeConcern: {
            w: process.env.MONGODB_WRITE_CONCERN_W ? parseInt(process.env.MONGODB_WRITE_CONCERN_W, 10) : 1,
            j: process.env.MONGODB_WRITE_CONCERN_J === 'true',
            wtimeout: process.env.MONGODB_WRITE_CONCERN_WTIMEOUT ? parseInt(process.env.MONGODB_WRITE_CONCERN_WTIMEOUT, 10) : 10000
        },
        readConcern: {
            level: process.env.MONGODB_READ_CONCERN_LEVEL || 'local'
        }
    };
}

// Export commonly used Mongoose types for convenience
export {
    Schema,
    Model,
    Document,
    Types,
    Connection,
    FilterQuery,
    UpdateQuery,
    PipelineStage,
    PopulateOptions,
    ClientSession,
    HydratedDocument
} from 'mongoose'; 