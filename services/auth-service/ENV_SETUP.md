# Auth Service - Environment Setup Guide

## Required Environment Variables

The Auth Service requires the following environment variables to function properly. You can set these in the root `.env` file or create a local `.env` file in the auth service directory.

### 🔧 General Configuration

```bash
# Service Configuration
NODE_ENV=development              # development | production | test
LOG_LEVEL=debug                  # error | warn | info | debug
AUTH_SERVICE_HOST=0.0.0.0        # Service host
AUTH_SERVICE_PORT=3001           # Service port

# CORS Configuration
FRONTEND_URL=http://localhost:3000  # Frontend URL for CORS
```

### 🗄️ Database Configuration

**Option 1: Database URL (Recommended for Production)**
```bash
DATABASE_URL=postgresql://username:password@host:port/database
```

**Option 2: Individual Settings (Development/Override)**
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=moonx_farm
DB_USER=postgres
DB_PASSWORD=postgres123
DB_SSL=false
DB_MAX_CONNECTIONS=20
DB_MIN_CONNECTIONS=2
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=10000
DB_STATEMENT_TIMEOUT=60000
DB_QUERY_TIMEOUT=30000
DB_MAX_RETRIES=3
DB_RETRY_DELAY=1000
DB_APPLICATION_NAME=moonx-farm
DB_ENABLE_METRICS=true
DB_ENABLE_QUERY_LOGGING=false
```

### 🔴 Redis Configuration

**Option 1: Redis URL (Recommended for Production)**
```bash
REDIS_URL=redis://[password@]host:port[/database]
# Example: redis://:mypassword@redis.example.com:6379/0
```

**Option 2: Individual Settings (Development/Override)**
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=                    # Leave empty if no password
REDIS_DB=0
REDIS_KEY_PREFIX=moonx:
REDIS_FAMILY=4                     # IP version (4 or 6)
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=100
REDIS_LAZY_CONNECT=true
REDIS_ENABLE_METRICS=true
REDIS_ENABLE_OFFLINE_QUEUE=true
```

### 🔐 JWT Configuration

```bash
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-64-chars-minimum
JWT_EXPIRES_IN=1h                  # Access token expiry
JWT_REFRESH_EXPIRES_IN=7d          # Refresh token expiry
JWT_ISSUER=moonx-farm              # Token issuer
JWT_AUDIENCE=moonx-dapp-users      # Token audience
```

### 🔑 Privy Authentication (Social Login)

```bash
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
PRIVY_VERIFICATION_KEY=your-privy-verification-key
```

### 🧪 Testing Configuration

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/moonx_farm_test
TEST_REDIS_URL=redis://localhost:6379/1
```

## 🚀 Quick Setup

### 1. Copy from Root Configuration

The simplest approach is to use the root `env.example`:

```bash
# From project root
cp env.example .env
# Edit .env with your values
```

### 2. Development Setup

For local development, create a `.env` file in the project root with these minimal settings:

```bash
# Basic setup for development
NODE_ENV=development
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/moonx_farm

# Redis
REDIS_URL=redis://localhost:6379

# JWT (generate secure keys for production!)
JWT_SECRET=dev-secret-key-replace-in-production-64-chars-minimum-length
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=moonx-farm
JWT_AUDIENCE=moonx-dapp-users

# Auth Service
AUTH_SERVICE_HOST=0.0.0.0
AUTH_SERVICE_PORT=3001
FRONTEND_URL=http://localhost:3000

# Privy (get from https://console.privy.io)
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
PRIVY_VERIFICATION_KEY=your-privy-verification-key
```

### 3. Production Setup

For production, ensure you:

1. **Generate secure secrets**:
   ```bash
   # Generate 64-character secrets
   openssl rand -hex 32
   ```

2. **Use environment-specific values**:
   - Different database credentials
   - Secure Redis password
   - Production Privy credentials
   - HTTPS frontend URL

3. **Set proper NODE_ENV**:
   ```bash
   NODE_ENV=production
   LOG_LEVEL=info
   ```

## 🔒 Security Notes

- **Never commit `.env` files** to version control
- **Use different secrets** for each environment
- **Rotate secrets regularly** in production
- **Use strong passwords** for database and Redis
- **Enable SSL/TLS** in production
- **Restrict CORS origins** to your actual frontend domains

## 🐳 Docker Setup

If using Docker Compose, the environment variables are automatically loaded from the root `.env` file. Make sure your `.env` file is in the project root.

## 🔍 Troubleshooting

### Common Issues

1. **Database connection fails**:
   - Check if PostgreSQL is running
   - Verify credentials and database exists
   - Check if DATABASE_URL format is correct

2. **Redis connection fails**:
   - Check if Redis is running
   - Verify REDIS_URL format
   - Check if password is required

3. **JWT errors**:
   - Ensure JWT_SECRET is at least 32 characters
   - Check expiry time formats (1h, 7d, etc.)

4. **Privy authentication fails**:
   - Verify Privy credentials are correct
   - Check if Privy app is properly configured
   - Ensure frontend domain is whitelisted in Privy console

### Environment Variable Priority

The system uses the following priority order:

1. **URL-based configuration** (highest priority)
   - `DATABASE_URL`, `REDIS_URL`

2. **Individual environment variables** (can override URL)
   - `DB_HOST`, `REDIS_HOST`, etc.

3. **Default values** (lowest priority)
   - Built-in fallbacks

This allows for flexible configuration in different environments. 