#!/usr/bin/env node

const { KafkaManager } = require('@moonx-farm/infrastructure');
const { v4: uuidv4 } = require('uuid');
const { websocketConfig } = require('../dist/config/index.js');

// Test events data
const TEST_EVENTS = [
  {
    eventType: 'price.updated',
    data: {
      token: 'ETH',
      chainId: 1,
      price: '3000.00',
      priceUsd: '3000.00',
      change24h: '0.05',
      volume24h: '1000000',
      exchange: 'uniswap'
    }
  },
  {
    eventType: 'order.created',
    data: {
      orderId: 'order-123',
      userId: 'user-456',
      tokenIn: 'ETH',
      tokenOut: 'USDT',
      amountIn: '1.0',
      amountOutExpected: '3000.0',
      chainId: 1,
      orderType: 'market',
      status: 'pending'
    },
    options: { userId: 'user-456' }
  },
  {
    eventType: 'portfolio.updated',
    data: {
      userId: 'user-456',
      chainId: 1,
      tokens: [
        { token: 'ETH', balance: '5.0', valueUsd: '15000.0' },
        { token: 'USDT', balance: '10000.0', valueUsd: '10000.0' }
      ],
      totalValueUsd: '25000.0',
      change24h: '0.02',
      updateReason: 'trade_executed'
    },
    options: { userId: 'user-456' }
  },
  {
    eventType: 'trade.executed',
    data: {
      tradeId: 'trade-789',
      orderId: 'order-123',
      userId: 'user-456',
      tokenIn: 'ETH',
      tokenOut: 'USDT',
      amountIn: '1.0',
      amountOut: '2980.0',
      chainId: 1,
      txHash: '0x123abc...',
      executionPrice: '2980.0',
      fees: '20.0',
      slippage: '0.67'
    },
    options: { userId: 'user-456' }
  },
  {
    eventType: 'system.health_check',
    data: {
      service: 'websocket-service',
      status: 'healthy',
      timestamp: Date.now(),
      metrics: {
        activeConnections: 100,
        processedEvents: 1000,
        errorRate: 0.001
      }
    }
  }
];

// Create event envelope
function createEventEnvelope(eventType, data, options = {}) {
  const eventId = uuidv4();
  const correlationId = options.correlationId || uuidv4();
  const timestamp = Date.now();

  // Determine data classification
  const dataClassificationMap = {
    'price.updated': 'public',
    'order.created': 'confidential',
    'order.updated': 'confidential',
    'order.cancelled': 'confidential',
    'portfolio.updated': 'restricted',
    'trade.executed': 'confidential',
    'trade.failed': 'confidential',
    'user.connected': 'internal',
    'user.disconnected': 'internal',
    'system.health_check': 'internal',
    'system.error': 'internal'
  };

  // Generate partition key
  function generatePartitionKey(eventType, userId) {
    if (userId && ['order.created', 'order.updated', 'order.cancelled', 'portfolio.updated', 'trade.executed', 'trade.failed'].includes(eventType)) {
      return userId;
    }
    if (eventType === 'price.updated') {
      return 'prices';
    }
    if (eventType.startsWith('system.')) {
      return 'system';
    }
    return 'default';
  }

  const metadata = {
    eventId,
    eventType,
    eventVersion: '1.0.0',
    correlationId,
    causationId: options.causationId,
    timestamp,
    source: 'websocket-service',
    sourceVersion: '1.0.0',
    tenantId: options.tenantId,
    userId: options.userId,
    sessionId: options.sessionId,
    dataClassification: dataClassificationMap[eventType] || 'internal',
    sequence: timestamp,
    partition: generatePartitionKey(eventType, options.userId),
    context: options.context
  };

  return {
    metadata,
    data
  };
}

async function testSingleTopicPattern() {
  console.log('🚀 Testing Kafka Single Topic Pattern...');
  
  try {
    // Initialize Kafka
    const brokers = websocketConfig.kafka.brokers ? websocketConfig.kafka.brokers.split(',') : ['localhost:9092'];
    const mainTopic = websocketConfig.kafka.mainTopic;
    
    console.log('📡 Kafka Configuration:');
    console.log('  Brokers:', brokers);
    console.log('  Main Topic:', mainTopic);
    console.log('  Consumer Group:', websocketConfig.kafka.consumerGroup);
    
    const kafkaManager = new KafkaManager({
      brokers: brokers,
      clientId: 'event-test-client',
      connectionTimeout: 10000,
      requestTimeout: 10000,
    });

    console.log('🔌 Connecting to Kafka...');
    await kafkaManager.connect();

    // Check if topic exists
    const topics = await kafkaManager.listTopics();
    if (!topics.includes(mainTopic)) {
      console.error(`❌ Topic ${mainTopic} does not exist!`);
      console.log('💡 Please run: npm run create-topics');
      return;
    }

    console.log('✅ Topic exists, proceeding with tests...');
    
    // Send test events
    console.log('📤 Sending test events...');
    
    for (let i = 0; i < TEST_EVENTS.length; i++) {
      const testEvent = TEST_EVENTS[i];
      const envelope = createEventEnvelope(
        testEvent.eventType,
        testEvent.data,
        testEvent.options || {}
      );
      
      console.log(`📨 Sending event ${i + 1}/${TEST_EVENTS.length}:`, {
        eventType: envelope.metadata.eventType,
        eventId: envelope.metadata.eventId,
        partition: envelope.metadata.partition,
        dataClassification: envelope.metadata.dataClassification
      });

      await kafkaManager.send(mainTopic, envelope, {
        key: envelope.metadata.partition,
        headers: {
          'content-type': 'application/json',
          'event-type': envelope.metadata.eventType,
          'correlation-id': envelope.metadata.correlationId
        }
      });

      // Add delay between events
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('✅ All test events sent successfully!');
    
    // Send a batch of price updates to test high throughput
    console.log('🔄 Sending batch of price updates...');
    
    const priceUpdateBatch = [];
    const tokens = ['ETH', 'USDT', 'USDC', 'DAI', 'WBTC'];
    
    for (let i = 0; i < 10; i++) {
      const token = tokens[i % tokens.length];
      const basePrice = token === 'ETH' ? 3000 : token === 'WBTC' ? 45000 : 1;
      const price = (basePrice + (Math.random() - 0.5) * basePrice * 0.1).toFixed(2);
      
      const priceData = {
        token,
        chainId: 1,
        price: price,
        priceUsd: price,
        change24h: ((Math.random() - 0.5) * 0.2).toFixed(4),
        volume24h: (Math.random() * 1000000).toFixed(0),
        exchange: 'uniswap'
      };
      
      const envelope = createEventEnvelope('price.updated', priceData);
      priceUpdateBatch.push(envelope);
    }
    
    // Send batch
    for (const envelope of priceUpdateBatch) {
      await kafkaManager.send(mainTopic, envelope, {
        key: envelope.metadata.partition,
        headers: {
          'content-type': 'application/json',
          'event-type': envelope.metadata.eventType,
          'correlation-id': envelope.metadata.correlationId
        }
      });
    }
    
    console.log(`✅ Sent ${priceUpdateBatch.length} price updates in batch`);
    
    // Test error event
    console.log('🚨 Testing error event...');
    
    const errorEvent = createEventEnvelope('system.error', {
      error: 'Test error message',
      stack: 'Error stack trace...',
      service: 'websocket-service',
      severity: 'medium',
      affectedUsers: ['user-123', 'user-456'],
      metadata: {
        errorType: 'TestError',
        timestamp: Date.now(),
        testMode: true
      }
    });
    
    await kafkaManager.send(mainTopic, errorEvent, {
      key: errorEvent.metadata.partition,
      headers: {
        'content-type': 'application/json',
        'event-type': errorEvent.metadata.eventType,
        'correlation-id': errorEvent.metadata.correlationId
      }
    });
    
    console.log('✅ Error event sent');
    
    await kafkaManager.disconnect();
    
    console.log('🎉 Test completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log(`  - Sent ${TEST_EVENTS.length} different event types`);
    console.log(`  - Sent ${priceUpdateBatch.length} price updates in batch`);
    console.log('  - Sent 1 error event');
    console.log('  - All events use message envelope pattern');
    console.log('  - Events are partitioned by user/type');
    console.log('');
    console.log('🔍 To monitor events:');
    console.log(`  kafka-console-consumer --bootstrap-server ${brokers[0]} --topic ${mainTopic} --from-beginning`);
    console.log('');
    console.log('🌐 Check WebSocket service:');
    console.log('  curl http://localhost:3008/health');
    console.log('  curl http://localhost:3008/metrics');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Make sure Kafka is running on:', websocketConfig.kafka.brokers);
    } else if (error.message.includes('UnknownTopicOrPartition')) {
      console.error('💡 Topic might not exist. Run: npm run create-topics');
    }
    
    process.exit(1);
  }
}

// Export function for use in other modules
module.exports = { testSingleTopicPattern, createEventEnvelope };

// Run if called directly
if (require.main === module) {
  testSingleTopicPattern()
    .then(() => {
      console.log('🏁 Test script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test script failed:', error);
      process.exit(1);
    });
} 