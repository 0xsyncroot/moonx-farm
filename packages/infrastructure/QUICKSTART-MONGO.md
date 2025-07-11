# MongoDB Manager - Quick Start Guide

## Installation & Setup

```bash
npm install @moonx-farm/infrastructure@1.0.12
```

### Basic Usage

```typescript
import { MongoManager, createMongoConfig } from '@moonx-farm/infrastructure';

// Initialize with environment config
const config = createMongoConfig();
const mongoManager = new MongoManager(config);

// Connect to MongoDB
await mongoManager.connect();
```

## Environment Variables

```env
MONGODB_URI=mongodb://localhost:27017/moonx-farm
MONGODB_DATABASE=moonx-farm
MONGODB_MAX_POOL_SIZE=10
MONGODB_MIN_POOL_SIZE=1
MONGODB_ENABLE_METRICS=true
MONGODB_ENABLE_QUERY_LOGGING=false
MONGODB_SSL=false
MONGODB_RETRY_WRITES=true
MONGODB_RETRY_READS=true
MONGODB_READ_PREFERENCE=primary
MONGODB_WRITE_CONCERN_W=1
MONGODB_WRITE_CONCERN_J=true
MONGODB_READ_CONCERN_LEVEL=local
```

## Define Models

```typescript
import { Schema } from '@moonx-farm/infrastructure';

// Define user schema
const userSchema = new Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Register model
const UserModel = mongoManager.registerModel('User', userSchema);
```

## CRUD Operations

```typescript
// Create document
const user = await mongoManager.create(UserModel, {
  email: 'user@example.com',
  name: 'John Doe'
});

// Find documents
const users = await mongoManager.findMany(UserModel, { name: /john/i });
const user = await mongoManager.findOne(UserModel, { email: 'user@example.com' });

// Update document
await mongoManager.updateOne(UserModel, 
  { email: 'user@example.com' }, 
  { $set: { name: 'Jane Doe', updatedAt: new Date() } }
);

// Update with upsert option
await mongoManager.updateOne(UserModel, 
  { email: 'newuser@example.com' }, 
  { $set: { name: 'New User', status: 'active' } },
  { upsert: true }
);

// Delete document
await mongoManager.deleteOne(UserModel, { email: 'user@example.com' });
```

## 🚀 Upsert Operations

### Basic Upsert
```typescript
// Insert if not exists, update if exists
const user = await mongoManager.upsert(UserModel, 
  { email: 'user@example.com' }, 
  { $set: { name: 'John Doe', status: 'active' } }
);
```

### Upsert with Options
```typescript
// Control return document (before/after)
const user = await mongoManager.upsert(UserModel, 
  { email: 'user@example.com' }, 
  { $set: { name: 'John Doe' } },
  { returnDocument: 'after' }
);
```

### Bulk Upsert
```typescript
// Upsert multiple documents efficiently
const result = await mongoManager.bulkUpsert(UserModel, [
  { 
    filter: { email: 'user1@example.com' }, 
    update: { $set: { name: 'User 1', status: 'active' } } 
  },
  { 
    filter: { email: 'user2@example.com' }, 
    update: { $set: { name: 'User 2', status: 'active' } } 
  }
]);

console.log(`Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}`);
```

## Advanced Queries

```typescript
// With population and sorting
const users = await mongoManager.findMany(UserModel, {}, {
  populate: 'profile',
  sort: { createdAt: -1 },
  limit: 10,
  skip: 20,
  lean: true
});

// Aggregation pipeline
const stats = await mongoManager.aggregate(UserModel, [
  { $match: { status: 'active' } },
  { $group: { _id: '$department', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);

// Count documents
const totalUsers = await mongoManager.count(UserModel, { status: 'active' });

// Advanced query options
const users = await mongoManager.findMany(UserModel, 
  { status: 'active' }, 
  {
    select: 'name email status',
    sort: { name: 1 },
    limit: 50,
    maxTimeMS: 5000,
    hint: { email: 1, status: 1 },
    collation: { locale: 'en', strength: 2 }
  }
);
```

## Transactions

```typescript
await mongoManager.transaction(async (tx) => {
  // All operations use the same transaction
  const user = await tx.create(UserModel, userData);
  
  // Upsert in transaction
  await tx.upsert(ProfileModel, 
    { userId: user._id }, 
    { $set: { ...profileData, updatedAt: new Date() } }
  );
  
  await tx.updateOne(StatsModel, 
    { type: 'user_count' }, 
    { $inc: { count: 1 } },
    { upsert: true }
  );
  
  await tx.create(LogModel, { 
    action: 'user_created', 
    userId: user._id,
    timestamp: new Date()
  });
  
  // Transaction commits automatically on success
  // Rolls back automatically on error
});
```

## Health Monitoring

```typescript
// Check connection health
const isHealthy = mongoManager.isHealthy();

// Get detailed metrics
const metrics = mongoManager.getMetrics();
console.log(`Total queries: ${metrics.totalQueries}`);
console.log(`Successful queries: ${metrics.successfulQueries}`);
console.log(`Failed queries: ${metrics.failedQueries}`);
console.log(`Average query time: ${metrics.averageQueryTime}ms`);
console.log(`Active connections: ${metrics.activeConnections}`);
console.log(`Transaction count: ${metrics.transactionCount}`);
console.log(`Rollback count: ${metrics.rollbackCount}`);

// Get connection stats
const stats = mongoManager.getConnectionStats();
console.log(`Connection uptime: ${stats.uptime}ms`);
console.log(`Models registered: ${stats.models.join(', ')}`);
```

## Best Practices

### 1. Connection Management
```typescript
// Initialize once per application
const mongoManager = new MongoManager(config);

// Connect during app startup
await mongoManager.connect();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await mongoManager.cleanup();
  process.exit(0);
});
```

### 2. Model Registration
```typescript
// Register all models during startup
const models = {
  User: mongoManager.registerModel('User', userSchema),
  Profile: mongoManager.registerModel('Profile', profileSchema),
  Order: mongoManager.registerModel('Order', orderSchema)
};
```

### 3. Error Handling
```typescript
try {
  const user = await mongoManager.findOne(UserModel, { email });
} catch (error) {
  if (error instanceof DatabaseError) {
    logger.error('Database operation failed', { 
      error: error.message,
      operation: 'findOne',
      model: 'User'
    });
  }
}
```

### 4. Query Optimization
```typescript
// Use lean queries for read-only operations
const users = await mongoManager.findMany(UserModel, {}, { lean: true });

// Add proper indexes
await mongoManager.createIndexes(UserModel);

// Use hints for complex queries
const results = await mongoManager.findMany(UserModel, filter, {
  hint: { email: 1, status: 1 },
  maxTimeMS: 5000
});

// Use upsert instead of find + create/update
// ❌ Inefficient
const existingUser = await mongoManager.findOne(UserModel, { email });
if (existingUser) {
  await mongoManager.updateOne(UserModel, { email }, updateData);
} else {
  await mongoManager.create(UserModel, createData);
}

// ✅ Efficient
await mongoManager.upsert(UserModel, { email }, { $set: userData });
```

## Development Tools

```typescript
// Development only - drop database
if (isDevelopment()) {
  await mongoManager.dropDatabase();
}

// Get collection statistics
const stats = await mongoManager.getCollectionStats(UserModel);
console.log(`Collection size: ${stats.size}`);
console.log(`Document count: ${stats.count}`);
console.log(`Average document size: ${stats.avgObjSize}`);

// Drop and recreate indexes
await mongoManager.dropIndexes(UserModel);
await mongoManager.createIndexes(UserModel);
```

## Configuration Options

```typescript
const config: MongoConfig = {
  uri: 'mongodb://localhost:27017/moonx-farm',
  database: 'moonx-farm',
  maxPoolSize: 10,
  minPoolSize: 1,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  enableMetrics: true,
  enableQueryLogging: true,
  retryWrites: true,
  retryReads: true,
  readPreference: 'primary',
  writeConcern: { 
    w: 'majority', 
    j: true,
    wtimeout: 10000 
  },
  readConcern: { 
    level: 'local' 
  }
};
```

## Common Usage Patterns

### Service Integration
```typescript
export class UserService {
  private mongoManager: MongoManager;
  private UserModel: Model<any>;

  constructor() {
    this.mongoManager = new MongoManager(createMongoConfig());
    this.UserModel = this.mongoManager.registerModel('User', userSchema);
  }

  async init() {
    await this.mongoManager.connect();
  }

  async createOrUpdateUser(userData: any) {
    return await this.mongoManager.upsert(this.UserModel, 
      { email: userData.email }, 
      { $set: userData }
    );
  }

  async findUserByEmail(email: string) {
    return await this.mongoManager.findOne(this.UserModel, { email });
  }

  async activateUser(email: string) {
    return await this.mongoManager.updateOne(this.UserModel, 
      { email }, 
      { $set: { status: 'active', updatedAt: new Date() } }
    );
  }

  async cleanup() {
    await this.mongoManager.cleanup();
  }
}
```

### Batch Operations
```typescript
// Batch upserts (most efficient)
const result = await mongoManager.bulkUpsert(UserModel, [
  { filter: { email: 'user1@example.com' }, update: { $set: userData1 } },
  { filter: { email: 'user2@example.com' }, update: { $set: userData2 } },
  { filter: { email: 'user3@example.com' }, update: { $set: userData3 } }
]);

// Batch updates
await mongoManager.updateMany(UserModel, 
  { status: 'inactive' },
  { $set: { lastUpdated: new Date() } }
);

// Batch deletes
const deleteResult = await mongoManager.deleteMany(UserModel, { 
  status: 'inactive',
  lastLogin: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // 90 days ago
});
```

### Real-time Operations
```typescript
// Watch for changes with proper session handling
await mongoManager.transaction(async (tx) => {
  const user = await tx.upsert(UserModel, 
    { email: 'user@example.com' }, 
    { $set: { status: 'online', lastSeen: new Date() } }
  );
  
  await tx.create(ActivityModel, {
    userId: user._id,
    action: 'login',
    timestamp: new Date()
  });
});
```

## 🔥 Performance Tips

1. **Use upsert instead of find + create/update**
2. **Leverage bulk operations for multiple documents**
3. **Use lean queries for read-only operations**
4. **Implement proper indexing strategy**
5. **Use transactions only when necessary**
6. **Monitor query performance with metrics**
7. **Set appropriate timeout values**

## 📊 Monitoring & Debugging

```typescript
// Enable query logging in development
const config = createMongoConfig();
config.enableQueryLogging = true;

// Monitor metrics periodically
setInterval(() => {
  const metrics = mongoManager.getMetrics();
  if (metrics.failedQueries > 0) {
    console.warn('Database errors detected:', metrics.lastError);
  }
  
  if (metrics.averageQueryTime > 1000) {
    console.warn('Slow queries detected:', metrics.averageQueryTime);
  }
}, 30000);
```

---

*This guide covers the essential usage patterns for MongoDB infrastructure in MoonXFarm. For advanced features and configuration options, refer to the full implementation in `packages/infrastructure/src/mongo.ts`.* 