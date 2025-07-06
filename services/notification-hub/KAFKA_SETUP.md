# Kafka Setup Guide for Notification Hub

## Problem
If you see this error:
```
"This server does not host this topic-partition"
Failed to subscribe Kafka consumer
```

This means the required Kafka topics don't exist yet.

## Solution Options

### Option 1: Auto-Create Topics (Recommended)
The notification hub will automatically create required topics when it starts up. Just make sure Kafka is running and accessible.

### Option 2: Manual Topic Creation
Run the setup script manually:

```bash
cd services/notification-hub
npm run kafka:setup-topics
```

### Option 3: Using Docker Compose
If you're using Docker Compose, add this to your kafka service:

```yaml
kafka:
  image: confluentinc/cp-kafka:latest
  environment:
    KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"
    KAFKA_NUM_PARTITIONS: 3
    KAFKA_DEFAULT_REPLICATION_FACTOR: 1
```

## Required Topics

The notification hub requires these topics:

- `price.alerts` - Price alert notifications
- `volume.alerts` - Volume spike alerts  
- `whale.alerts` - Large transaction alerts
- `wallet.activity` - Wallet activity notifications
- `system.alerts` - System-wide alerts
- `user.events` - User-specific events

## Troubleshooting

### 1. Kafka Not Running
```bash
# Check if Kafka is running
docker ps | grep kafka

# Start Kafka with Docker Compose
docker-compose up -d kafka
```

### 2. Connection Issues
Check your Kafka configuration in `.env`:
```bash
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=notification-hub-dev
```

### 3. Permission Issues
Make sure your Kafka user has permissions to create topics:
```bash
# Check Kafka ACLs
kafka-acls --bootstrap-server localhost:9092 --list
```

### 4. Topic Already Exists Error
If you get "Topic already exists" error, it's safe to ignore - the topics are already created.

### 5. Manual Topic Creation
If automatic creation fails, create topics manually:

```bash
# Create price.alerts topic
kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic price.alerts \
  --partitions 3 \
  --replication-factor 1

# Create volume.alerts topic
kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic volume.alerts \
  --partitions 3 \
  --replication-factor 1

# Create whale.alerts topic
kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic whale.alerts \
  --partitions 3 \
  --replication-factor 1

# Create wallet.activity topic
kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic wallet.activity \
  --partitions 3 \
  --replication-factor 1

# Create system.alerts topic
kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic system.alerts \
  --partitions 3 \
  --replication-factor 1

# Create user.events topic
kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic user.events \
  --partitions 3 \
  --replication-factor 1
```

## Verification

After setup, verify topics exist:

```bash
# List all topics
kafka-topics --list --bootstrap-server localhost:9092

# Check specific topic details
kafka-topics --describe --bootstrap-server localhost:9092 --topic price.alerts
```

## Development vs Production

### Development (Single Node)
- Replication factor: 1
- Partitions: 3
- Retention: 7 days

### Production (Multi-Node)
- Replication factor: 3
- Partitions: 6-12 (depends on load)
- Retention: 30 days for system alerts, 7 days for others

## Next Steps

After topics are created, restart the notification hub:

```bash
cd services/notification-hub
npm run dev
```

The service should now start without Kafka topic errors. 