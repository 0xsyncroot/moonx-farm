#!/usr/bin/env node

const { KafkaManager } = require('@moonx-farm/infrastructure');
const { websocketConfig } = require('../dist/config/index.js');

// Kafka topics configuration - Single topic pattern
const TOPICS = [
  {
    topic: 'moonx.ws.events',
    numPartitions: 6,
    replicationFactor: 1,
    configs: {
      'cleanup.policy': 'delete',
      'retention.ms': '604800000', // 7 days
      'segment.ms': '3600000',     // 1 hour
      'compression.type': 'gzip',
      'max.message.bytes': '1000000', // 1MB
      'min.insync.replicas': '1'
    }
  },
  {
    topic: 'moonx.ws.events.dlq',
    numPartitions: 2,
    replicationFactor: 1,
    configs: {
      'cleanup.policy': 'delete',
      'retention.ms': '2592000000', // 30 days
      'segment.ms': '86400000',     // 24 hours
      'compression.type': 'gzip'
    }
  },
  // Legacy topics for backward compatibility (deprecation phase)
  {
    topic: 'moonx.price.updates',
    numPartitions: 3,
    replicationFactor: 1,
    configs: {
      'cleanup.policy': 'delete',
      'retention.ms': '86400000', // 24 hours
      'segment.ms': '3600000'     // 1 hour
    }
  },
  {
    topic: 'moonx.order.updates',
    numPartitions: 3,
    replicationFactor: 1,
    configs: {
      'cleanup.policy': 'delete',
      'retention.ms': '604800000', // 7 days
      'segment.ms': '3600000'      // 1 hour
    }
  },
  {
    topic: 'moonx.portfolio.updates',
    numPartitions: 2,
    replicationFactor: 1,
    configs: {
      'cleanup.policy': 'delete',
      'retention.ms': '259200000', // 3 days
      'segment.ms': '3600000'      // 1 hour
    }
  },
  {
    topic: 'moonx.trade.updates',
    numPartitions: 3,
    replicationFactor: 1,
    configs: {
      'cleanup.policy': 'delete',
      'retention.ms': '86400000', // 24 hours
      'segment.ms': '3600000'     // 1 hour
    }
  }
];

async function createKafkaTopics() {
  try {
    console.log('🚀 Creating Kafka topics...');
    
    // Get Kafka configuration from service config
    const brokers = websocketConfig.kafka.brokers ? websocketConfig.kafka.brokers.split(',') : ['localhost:9092'];
    
    console.log('📡 Kafka brokers:', brokers);
    
    // Create KafkaManager instance
    const kafkaManager = new KafkaManager({
      brokers: brokers,
      clientId: 'moonx-topic-creator',
      connectionTimeout: 10000,
      requestTimeout: 10000,
    });

    console.log('🔌 Connecting to Kafka...');
    await kafkaManager.connect();
    
    // Get existing topics
    console.log('🔍 Checking existing topics...');
    const existingTopics = await kafkaManager.listTopics();
    console.log('📋 Existing topics:', existingTopics);
    
    // Filter topics that need to be created
    const topicsToCreate = TOPICS.filter(topic => !existingTopics.includes(topic.topic));
    
    if (topicsToCreate.length === 0) {
      console.log('✅ All topics already exist');
      await kafkaManager.disconnect();
      return;
    }
    
    console.log(`📝 Creating ${topicsToCreate.length} topics...`);
    
    // Create topics using KafkaManager API
    await kafkaManager.createTopics(
      topicsToCreate.map(({ topic, numPartitions, replicationFactor, configs }) => ({
        topic,
        numPartitions,
        replicationFactor,
        configEntries: Object.entries(configs).map(([key, value]) => ({
          name: key,
          value: value
        }))
      }))
    );
    
    console.log('✅ Topics created successfully');
    
    // List topics again to verify
    const updatedTopics = await kafkaManager.listTopics();
    console.log('📋 Updated topics list:', updatedTopics);
    
    // Show details of created topics
    for (const topicConfig of topicsToCreate) {
      console.log(`✅ Created topic: ${topicConfig.topic}`);
      console.log(`   - Partitions: ${topicConfig.numPartitions}`);
      console.log(`   - Replication: ${topicConfig.replicationFactor}`);
      console.log(`   - Retention: ${topicConfig.configs['retention.ms']}ms`);
    }
    
    await kafkaManager.disconnect();
    console.log('🎉 Kafka topics setup completed');
    
  } catch (error) {
    console.error('❌ Failed to create Kafka topics:', error);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Make sure Kafka is running and accessible at:', kafkaConfig.KAFKA_BROKERS);
    } else if (error.message.includes('TOPIC_ALREADY_EXISTS')) {
      console.log('ℹ️ Topics already exist, continuing...');
    } else {
      console.error('❌ Error details:', error);
      process.exit(1);
    }
  }
}

// Export function for use in other modules
module.exports = { createKafkaTopics, TOPICS };

// Run if called directly
if (require.main === module) {
  createKafkaTopics()
    .then(() => {
      console.log('🏁 Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
} 