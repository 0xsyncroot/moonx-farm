# 📅 Periodic Sync Feature

## Overview

The MoonX Farm Sync Worker now supports **periodic sync jobs** to automatically sync user portfolios without waiting for manual triggers. This feature is designed to provide up-to-date portfolio data while respecting rate limits and user activity patterns.

## Why Periodic Sync?

1. **Real-time Portfolio Updates**: Token prices change constantly, users need fresh data
2. **Better User Experience**: Portfolio data is already updated when users visit
3. **Reduced API Load**: Intelligent scheduling prevents API spam
4. **Market-Aware Sync**: More frequent sync during market hours (9 AM - 5 PM UTC)

## How It Works

### Smart Scheduling

The periodic sync scheduler uses intelligent algorithms to determine when to sync:

- **Market Hours (9 AM - 5 PM UTC)**: Sync every 5 minutes (configurable)
- **Off Hours (5 PM - 9 AM UTC)**: Sync every 15 minutes (configurable)
- **Activity-Based**: Only sync users who were active within 24 hours
- **Stale Data Detection**: Force sync if data is older than 1 hour (configurable)

### Priority System

- **High Priority**: Stale data (>1 hour old)
- **Medium Priority**: Regular periodic sync for active users
- **Low Priority**: Bulk sync operations

## Configuration

### Environment Variables

```bash
# Enable/disable periodic sync (default: true)
PERIODIC_SYNC_ENABLED=true

# Sync intervals
PERIODIC_SYNC_MARKET_HOURS_INTERVAL=300000  # 5 minutes during market hours
PERIODIC_SYNC_OFF_HOURS_INTERVAL=900000     # 15 minutes during off hours

# Stale data threshold (default: 1 hour)
PERIODIC_SYNC_STALE_THRESHOLD=3600000

# Maximum users to sync per batch (default: 10)
PERIODIC_SYNC_BATCH_SIZE=10
```

### Recommended Settings

| Environment | Market Hours | Off Hours | Stale Threshold | Batch Size |
|-------------|--------------|-----------|-----------------|------------|
| Development | 10 minutes   | 30 minutes| 2 hours         | 5          |
| Production  | 5 minutes    | 15 minutes| 1 hour          | 10         |
| High Load   | 15 minutes   | 30 minutes| 30 minutes      | 20         |

## Usage

### User Registration

When a user performs a manual sync, they're automatically registered for periodic sync:

```typescript
// This happens automatically when user triggers sync
await periodicSyncScheduler.registerUser(userId, walletAddress);
```

### Activity Tracking

Update user activity to maintain smart sync priorities:

```typescript
await periodicSyncScheduler.updateUserActivity(userId);
```

### Manual Control

```typescript
// Pause periodic sync
await periodicSyncScheduler.stop();

// Resume periodic sync
await periodicSyncScheduler.start();

// Get scheduler stats
const stats = periodicSyncScheduler.getStats();
```

## Benefits

### For Users
- 🔄 **Always Fresh Data**: Portfolio values are up-to-date
- ⚡ **Faster Load Times**: Data is pre-synced before user visits
- 📊 **Real-time Tracking**: Price changes reflected quickly

### For System
- 🎯 **Intelligent Scheduling**: Sync only when needed
- 📈 **Better Resource Usage**: Market-aware intervals
- 🔒 **Rate Limit Compliance**: Respects existing rate limits
- 🚀 **Scalable**: Activity-based user filtering

## Monitoring

### Health Checks

```bash
# Check if periodic sync is running
curl http://localhost:3001/health

# Response includes scheduler stats
{
  "schedulerStats": {
    "enabled": true,
    "running": true,
    "totalUsers": 1250,
    "activeUsers": 340,
    "isMarketHours": true,
    "nextScheduledSync": "scheduled"
  }
}
```

### Logging

The scheduler provides detailed logging:

```log
📅 Periodic Sync Scheduler initialized
📅 Running periodic sync check (isMarketHours: true, registeredUsers: 1250)
📅 Scheduling periodic sync batch (userCount: 10, priority: low)
✅ Periodic sync batch scheduled successfully
🔄 Found users with stale data (count: 5, threshold: 3600000)
```

## Migration Guide

### From Manual-Only to Periodic Sync

1. **Enable Feature**: Set `PERIODIC_SYNC_ENABLED=true`
2. **Configure Intervals**: Set appropriate intervals for your load
3. **Monitor Performance**: Watch logs and metrics
4. **Adjust Settings**: Fine-tune based on usage patterns

### Rollback Plan

If you need to disable periodic sync:

```bash
# Disable periodic sync
PERIODIC_SYNC_ENABLED=false

# Restart worker
pm2 restart sync-worker
```

## Performance Impact

### Resource Usage

- **Memory**: ~10MB additional for user tracking
- **CPU**: Minimal overhead (runs in background)
- **Network**: Reduces overall API calls through intelligent scheduling

### Scalability

- **1,000 users**: ~5MB memory, sync every 5-15 minutes
- **10,000 users**: ~50MB memory, batch processing
- **100,000+ users**: Consider multiple worker instances

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Reduce `PERIODIC_SYNC_BATCH_SIZE`
   - Increase `PERIODIC_SYNC_STALE_THRESHOLD`

2. **Too Many API Calls**
   - Increase sync intervals
   - Reduce batch size

3. **Stale Data**
   - Decrease `PERIODIC_SYNC_STALE_THRESHOLD`
   - Enable more frequent market hours sync

### Debug Commands

```bash
# View scheduler stats
curl http://localhost:3001/health | jq .schedulerStats

# Check logs for periodic sync
tail -f logs/sync-worker.log | grep "📅"

# Monitor queue size
curl http://localhost:3001/queue-stats
```

## Future Enhancements

- **User Preference Settings**: Allow users to set sync frequency
- **Token-Specific Sync**: Sync only changed tokens
- **Multi-Region Support**: Sync based on user timezone
- **AI-Powered Scheduling**: Machine learning for optimal sync times
- **WebSocket Integration**: Real-time sync notifications

## Support

For issues or questions about periodic sync:

1. Check logs for error messages
2. Review configuration settings
3. Monitor system resources
4. Contact dev team with scheduler stats

---

*This feature is designed to provide the best balance between data freshness and system performance. Adjust settings based on your specific requirements and monitoring data.* 