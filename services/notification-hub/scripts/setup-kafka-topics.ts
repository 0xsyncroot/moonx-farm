#!/usr/bin/env npx ts-node

import { createKafka, createKafkaConfig } from '@moonx-farm/infrastructure';
import { createLogger } from '@moonx-farm/common';

const logger = createLogger('KafkaTopicSetup');

const REQUIRED_TOPICS = [
  {
    topic: 'price.alerts',
    numPartitions: 3,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: '604800000' }, // 7 days
      { name: 'cleanup.policy', value: 'delete' },
    ],
  },
  {
    topic: 'volume.alerts',
    numPartitions: 3,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: '604800000' }, // 7 days
      { name: 'cleanup.policy', value: 'delete' },
    ],
  },
  {
    topic: 'whale.alerts',
    numPartitions: 3,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: '604800000' }, // 7 days
      { name: 'cleanup.policy', value: 'delete' },
    ],
  },
  {
    topic: 'wallet.activity',
    numPartitions: 3,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: '604800000' }, // 7 days
      { name: 'cleanup.policy', value: 'delete' },
    ],
  },
  {
    topic: 'system.alerts',
    numPartitions: 3,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: '2592000000' }, // 30 days
      { name: 'cleanup.policy', value: 'delete' },
    ],
  },
  {
    topic: 'user.events',
    numPartitions: 3,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: '604800000' }, // 7 days
      { name: 'cleanup.policy', value: 'delete' },
    ],
  },
];

async function setupKafkaTopics() {
  try {
    logger.info('Setting up Kafka topics for notification-hub...');
    
    const kafkaConfig = createKafkaConfig();
    const kafka = createKafka(kafkaConfig);
    
    // Connect to Kafka
    await kafka.connect();
    logger.info('Connected to Kafka');
    
    // Check existing topics
    const existingTopics = await kafka.listTopics();
    logger.info(`Existing topics: ${existingTopics.join(', ')}`);
    
    // Filter out topics that already exist
    const topicsToCreate = REQUIRED_TOPICS.filter(
      topic => !existingTopics.includes(topic.topic)
    );
    
    if (topicsToCreate.length === 0) {
      logger.info('All required topics already exist');
      await kafka.disconnect();
      return;
    }
    
    logger.info(`Creating ${topicsToCreate.length} topics...`);
    
    // Create topics
    await kafka.createTopics(topicsToCreate);
    
    logger.info('Topics created successfully:');
    topicsToCreate.forEach(topic => {
      logger.info(`  - ${topic.topic} (${topic.numPartitions} partitions, ${topic.replicationFactor} replicas)`);
    });
    
    // Verify topics were created
    const updatedTopics = await kafka.listTopics();
    const missingTopics = REQUIRED_TOPICS.filter(
      topic => !updatedTopics.includes(topic.topic)
    );
    
    if (missingTopics.length > 0) {
      logger.error(`Failed to create topics: ${missingTopics.map(t => t.topic).join(', ')}`);
      process.exit(1);
    }
    
    logger.info('All topics verified successfully');
    
    // Disconnect
    await kafka.disconnect();
    logger.info('Kafka topic setup completed successfully');
    
  } catch (error) {
    logger.error(`Error setting up Kafka topics: ${error}`);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupKafkaTopics().catch(console.error);
}

export { setupKafkaTopics }; 