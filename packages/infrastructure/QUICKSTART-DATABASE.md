# Database Infrastructure Quickstart

Hướng dẫn tích hợp và sử dụng Database infrastructure cho các service trong MoonX Farm.

## Tổng quan

Database Infrastructure hỗ trợ:
- **PostgreSQL**: Connection pooling với retry logic
- **Query Builder**: SELECT, INSERT, UPDATE, DELETE operations
- **Transactions**: ACID compliance với savepoints
- **Monitoring**: Performance metrics và health checks

## Cấu hình Environment

```bash
# Option 1: Database URL (ưu tiên)
DATABASE_URL=postgresql://username:password@localhost:5432/moonx_farm

# Option 2: Individual variables
DB_HOST=localhost
DB_PORT=5432
DB_NAME=moonx_farm
DB_USER=postgres
DB_PASSWORD=your_password

# Connection pooling
DB_MAX_CONNECTIONS=20
DB_MIN_CONNECTIONS=2
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=10000

# Performance
DB_QUERY_TIMEOUT=30000
DB_STATEMENT_TIMEOUT=60000
DB_MAX_RETRIES=3
DB_RETRY_DELAY=1000

# Monitoring
DB_ENABLE_METRICS=true
DB_ENABLE_QUERY_LOGGING=false
DB_SSL=false
```

## Tích hợp cơ bản

```typescript
// services/databaseService.ts
import { 
  DatabaseManager, 
  createDatabaseConfig,
  createDatabase 
} from '@moonx-farm/infrastructure';

export class DatabaseService {
  private db: DatabaseManager;

  constructor() {
    const config = createDatabaseConfig();
    this.db = createDatabase(config);
  }

  async initialize(): Promise<void> {
    await this.db.connect();
  }

  getDB(): DatabaseManager {
    return this.db;
  }

  async healthCheck(): Promise<boolean> {
    return await this.db.healthCheck();
  }

  async shutdown(): Promise<void> {
    await this.db.disconnect();
  }
}

// Export singleton
export const databaseService = new DatabaseService();
```

## API Methods

### Basic Operations

- **`query<T>(text, params?, options?): Promise<QueryResult<T>>`** - Execute raw SQL query
- **`transaction<T>(callback): Promise<T>`** - Execute trong transaction
- **`connect(): Promise<void>`** - Kết nối database
- **`disconnect(): Promise<void>`** - Ngắt kết nối
- **`healthCheck(): Promise<boolean>`** - Kiểm tra sức khỏe
- **`getMetrics(): DatabaseMetrics`** - Lấy performance metrics
- **`getPoolStats()`** - Lấy connection pool stats

### Query Builder

- **`select(table, columns?)`** - SELECT query builder
- **`insert(table, data)`** - INSERT query builder  
- **`update(table, data)`** - UPDATE query builder
- **`delete(table)`** - DELETE query builder

### Transaction Operations

- **`tx.query(text, params?)`** - Execute query trong transaction
- **`tx.commit()`** - Commit transaction
- **`tx.rollback()`** - Rollback transaction
- **`tx.savepoint(name)`** - Tạo savepoint
- **`tx.rollbackToSavepoint(name)`** - Rollback về savepoint
- **`tx.releaseSavepoint(name)`** - Release savepoint

### Batch Operations

- **`batch(queries): Promise<QueryResult[]>`** - Execute multiple queries trong transaction

## Usage Examples

### Basic Queries

```typescript
// Raw SQL
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// Query builder
const users = await db.select('users')
  .where({ is_active: true })
  .orderBy('created_at', 'DESC')
  .limit(10)
  .execute();
```

### Transactions

```typescript
const result = await db.transaction(async (tx) => {
  const user = await tx.query('INSERT INTO users (email) VALUES ($1) RETURNING *', [email]);
  await tx.query('INSERT INTO profiles (user_id) VALUES ($1)', [user.rows[0].id]);
  return user.rows[0];
});
```

### Savepoints

```typescript
await db.transaction(async (tx) => {
  await tx.savepoint('sp1');
  try {
    // risky operation
  } catch (error) {
    await tx.rollbackToSavepoint('sp1');
    // handle error
  }
});
```

## Error Handling

Database operations throw `DatabaseError` khi có lỗi. Handle bằng try-catch:

```typescript
try {
  const result = await db.query('SELECT * FROM users');
} catch (error) {
  if (error instanceof DatabaseError) {
    // Handle database error
  }
}
```

## Common PostgreSQL Error Codes

- **23505**: Duplicate entry (unique constraint)
- **23503**: Foreign key constraint violation
- **23502**: Not null constraint violation

## Health Check & Monitoring

```typescript
// Health check
const isHealthy = await databaseService.healthCheck();

// Metrics
const metrics = databaseService.getDB().getMetrics();
// Returns: { totalQueries, successfulQueries, failedQueries, averageQueryTime, isConnected, ... }

// Pool stats
const poolStats = databaseService.getDB().getPoolStats();
// Returns: { totalCount, idleCount, waitingCount, isConnected }
```

## Best Practices

1. **Connection Pooling**: Set appropriate `DB_MAX_CONNECTIONS` và `DB_MIN_CONNECTIONS`
2. **Query Timeout**: Set `DB_QUERY_TIMEOUT` để avoid hanging queries
3. **Error Handling**: Always handle `DatabaseError` properly
4. **Transactions**: Use transactions cho multi-table operations
5. **Prepared Statements**: Use parameterized queries để prevent SQL injection
6. **Monitoring**: Enable metrics trong production

## Troubleshooting

- **Connection Pool Exhausted**: Tăng `DB_MAX_CONNECTIONS` hoặc check connection leaks
- **Slow Queries**: Enable `DB_ENABLE_QUERY_LOGGING` để debug
- **Connection Timeouts**: Tăng `DB_CONNECTION_TIMEOUT`
- **Transaction Deadlocks**: Use savepoints cho complex transactions

---

Để hỗ trợ hoặc báo cáo lỗi, liên hệ team phát triển MoonX Farm. 