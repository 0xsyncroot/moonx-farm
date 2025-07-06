# 🗄️ MoonX Farm Notification Hub - Database Setup

## 📋 **Tổng quan**

Database schema hoàn chỉnh cho hệ thống thông báo MoonX Farm, được thiết kế dựa trên phân tích các sản phẩm DeFi/DEX hàng đầu như DexTools, Uniswap, PancakeSwap, Zerion, v.v.

## 🎯 **Tính năng hỗ trợ**

### **💰 Trading & Market Alerts**
- ✅ **Price Alerts**: Theo dõi giá với nhiều điều kiện (absolute, percentage, moving average)
- ✅ **Volume Alerts**: Theo dõi volume spike, threshold alerts
- ✅ **Whale Alerts**: Theo dõi giao dịch lớn (>$100k+)
- ✅ **Market Trend**: Technical analysis, social sentiment, funding rate

### **👀 Wallet Tracking**
- ✅ **Tracked Wallets**: Theo dõi ví cá nhân, tổ chức, smart money
- ✅ **Wallet Activity**: Large transactions, swaps, transfers
- ✅ **Portfolio Monitoring**: Total value, PnL, token balance alerts

### **🏦 DeFi Protocols**
- ✅ **Liquidity Pool Alerts**: APY changes, liquidity changes, impermanent loss
- ✅ **Position Health**: Liquidation warnings cho Aave, Compound, Venus
- ✅ **Yield Farming**: Reward claims, pool ending, APY changes
- ✅ **Staking**: Unlock periods, rewards, slashing risks

### **🏛️ Governance & Security**
- ✅ **DAO Governance**: New proposals, voting deadlines
- ✅ **Security Alerts**: Rug pulls, exploits, suspicious activities
- ✅ **New Token Listings**: Filter theo market cap, volume, liquidity

### **📊 Analytics & Management**
- ✅ **Delivery Tracking**: Multi-channel delivery logs
- ✅ **Rate Limiting**: User-specific frequency controls
- ✅ **User Engagement**: Click rates, engagement scores
- ✅ **Notification Templates**: Consistent messaging

## 🗃️ **Database Schema**

### **Core Tables**
```sql
notifications           -- Main notification records
user_preferences        -- User notification settings
notification_templates  -- Reusable message templates
notification_delivery_log -- Delivery tracking
```

### **Alert Types**
```sql
price_alerts           -- Price monitoring
volume_alerts          -- Volume spike detection
whale_alerts          -- Large transaction monitoring
tracked_wallets       -- Wallet tracking
liquidity_alerts      -- LP monitoring
portfolio_alerts      -- Portfolio value monitoring
position_health_alerts -- DeFi position health
yield_farming_alerts  -- Yield farming monitoring
staking_alerts        -- Staking monitoring
governance_alerts     -- DAO governance
security_alerts       -- Security monitoring
market_trend_alerts   -- Technical analysis
```

### **Analytics Tables**
```sql
notification_analytics     -- Performance metrics
user_engagement_metrics   -- User behavior tracking
rate_limits              -- Rate limiting controls
notification_events      -- Event sourcing audit trail
```

## 🚀 **Deployment Guide**

### **Prerequisites**
- PostgreSQL 12+
- Node.js 18+
- npm/yarn

### **Quick Start**

```bash
# 1. Make deployment script executable
chmod +x services/notification-hub/scripts/deploy-database.sh

# 2. Development deployment with sample data
./services/notification-hub/scripts/deploy-database.sh --environment development

# 3. Production deployment
DB_NAME=moonx_prod DB_USER=moonx_user ./services/notification-hub/scripts/deploy-database.sh --environment production --skip-seeds
```

### **Environment Variables**
```bash
# Database Configuration
DB_HOST=localhost              # Database host
DB_PORT=5432                  # Database port
DB_NAME=moonx_notifications   # Database name
DB_USER=postgres              # Database user
DB_PASSWORD=password          # Database password
DB_SSL_MODE=prefer            # SSL mode

# Deployment Options
ENVIRONMENT=development       # Environment (development|staging|production)
SKIP_SEEDS=false             # Skip sample data seeding
FORCE_RECREATE=false         # Force recreation of existing database
BACKUP_EXISTING=true         # Backup existing database before changes
```

### **Deployment Options**

#### **Development Deployment**
```bash
# With sample data for testing
./scripts/deploy-database.sh --environment development

# Clean development setup
./scripts/deploy-database.sh --environment development --force-recreate
```

#### **Production Deployment**
```bash
# Production without sample data
./scripts/deploy-database.sh --environment production --skip-seeds

# Production with custom database
DB_NAME=moonx_prod DB_USER=moonx_user ./scripts/deploy-database.sh --environment production --skip-seeds
```

#### **Advanced Options**
```bash
# Force recreate with backup
./scripts/deploy-database.sh --force-recreate --environment development

# Skip backup (faster deployment)
./scripts/deploy-database.sh --no-backup --environment development
```

## 🔧 **Manual Setup**

### **1. Create Database**
```sql
CREATE DATABASE moonx_notifications;
CREATE USER moonx_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE moonx_notifications TO moonx_user;
```

### **2. Run Schema**
```bash
psql -h localhost -U moonx_user -d moonx_notifications -f database/schema.sql
```

### **3. Seed Sample Data (Optional)**
```bash
psql -h localhost -U moonx_user -d moonx_notifications -f database/seeds/sample_data.sql
```

## 📊 **Sample Data**

Khi deploy với `--environment development`, hệ thống sẽ tự động tạo:

### **Sample Users**
- `user_001`: WebSocket + Push + Email notifications
- `user_002`: WebSocket + Email notifications  
- `user_003`: WebSocket + Push notifications

### **Sample Alerts**
- **Price Alerts**: BTC >$45k, ETH <$2.5k, 5% change alerts
- **Volume Alerts**: BTC >$1M volume, ETH volume spikes
- **Whale Alerts**: Large transfers >$500k
- **Wallet Tracking**: Binance, Whale traders, Smart money wallets

### **Sample Notifications**
- Price alerts delivered via WebSocket/Push
- Volume spike notifications
- Whale transaction alerts
- Portfolio health warnings

## 🔍 **Verification**

### **Check Tables**
```sql
-- List all tables
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check sample data
SELECT COUNT(*) FROM notifications;
SELECT COUNT(*) FROM price_alerts;
SELECT COUNT(*) FROM volume_alerts;
SELECT COUNT(*) FROM tracked_wallets;
```

### **Check Extensions**
```sql
SELECT * FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_trgm', 'btree_gin');
```

### **Check Indexes**
```sql
-- List all indexes
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';
```

## 📈 **Performance Optimization**

### **Database Indexes**
- **Primary lookups**: user_id, notification_id, symbol
- **Time-based**: created_at, expires_at, triggered_at
- **Status filters**: is_active, status, priority
- **JSONB indexes**: GIN indexes for flexible data queries

### **Partitioning Strategy**
```sql
-- Monthly partitioning for large tables (future optimization)
CREATE TABLE notifications_202401 PARTITION OF notifications
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### **Archiving Strategy**
```sql
-- Archive old notifications (>90 days)
CREATE TABLE notifications_archive AS 
SELECT * FROM notifications 
WHERE created_at < NOW() - INTERVAL '90 days';
```

## 🧪 **Testing**

### **Unit Tests**
```javascript
// Test database service methods
const dbService = new DatabaseService();

// Test notification creation
const notificationId = await dbService.saveNotification({
  userId: 'test_user',
  type: 'price_alert',
  title: 'Test Alert',
  body: 'Test notification',
  priority: 'high'
});

// Test alert creation
const alertId = await dbService.createVolumeAlert({
  userId: 'test_user',
  symbol: 'BTC-USDC',
  baseToken: '0x...',
  quoteToken: '0x...',
  volumeThreshold: 1000000
});
```

### **Integration Tests**
```bash
# Test database connectivity
npm run test:db

# Test notification flow
npm run test:integration
```

## 🔒 **Security**

### **Database Security**
- ✅ Encrypted connections (SSL/TLS)
- ✅ User-specific permissions
- ✅ Rate limiting per user/type
- ✅ PII data masking in logs

### **Data Protection**
```sql
-- Row-level security example
CREATE POLICY user_notifications_policy ON notifications
FOR ALL TO moonx_user
USING (user_id = current_user_id());
```

## 🚨 **Monitoring**

### **Key Metrics**
- **Performance**: Query response times, connection pool usage
- **Reliability**: Failed queries, connection errors
- **Capacity**: Database size, row counts, index usage

### **Health Checks**
```sql
-- Database health query
SELECT 
  'notifications' as table_name,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM notifications
WHERE created_at >= NOW() - INTERVAL '24 hours';
```

## 🔧 **Maintenance**

### **Regular Tasks**
```bash
# Weekly database maintenance
./scripts/maintenance.sh --vacuum --analyze

# Monthly archiving
./scripts/archive.sh --older-than 90

# Backup
./scripts/backup.sh --compress
```

### **Performance Tuning**
```sql
-- Update statistics
ANALYZE;

-- Rebuild indexes
REINDEX DATABASE moonx_notifications;

-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;
```

## 🤝 **Support**

### **Common Issues**

1. **Connection Errors**
   - Check database credentials
   - Verify network connectivity
   - Check PostgreSQL service status

2. **Schema Errors**
   - Ensure PostgreSQL version 12+
   - Check extension availability
   - Verify user permissions

3. **Performance Issues**
   - Monitor connection pool
   - Check query execution plans
   - Review index usage

### **Contact**
- 📧 **Email**: dev@moonx.farm
- 💬 **Discord**: MoonX Farm Community
- 📖 **Documentation**: [docs.moonx.farm](https://docs.moonx.farm)

---

## 📄 **License**

Copyright © 2024 MoonX Farm. All rights reserved.

---

*🌙 Built with love by the MoonX Farm team* 