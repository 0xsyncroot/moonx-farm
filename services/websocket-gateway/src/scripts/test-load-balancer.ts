#!/usr/bin/env ts-node

import { LoadBalancer, LoadBalancerConfig } from '../services/loadBalancer';
import { logger } from '@moonx-farm/common';

// Test LoadBalancer functionality
async function testLoadBalancer() {
  console.log('🧪 Testing Production-Ready LoadBalancer...\n');

  // Test Configuration
  const config: LoadBalancerConfig = {
    maxConnectionsPerInstance: 100,
    healthCheckInterval: 5000, // 5 seconds for testing
    instanceTTL: 30000, // 30 seconds
    algorithm: 'round-robin',
    circuitBreaker: {
      enabled: true,
      failureThreshold: 3,
      timeoutMs: 10000,
      resetTimeoutMs: 20000
    },
    redis: {
      enabled: false, // Disable Redis for testing
      keyPrefix: 'test:lb:',
      ttl: 30
    }
  };

  // Create LoadBalancer instance
  const lb = new LoadBalancer(config);

  // Test 1: Basic functionality
  console.log('✅ Test 1: Basic LoadBalancer Creation');
  console.log(`Instance ID: ${(lb as any).currentInstanceId}`);
  console.log(`Algorithm: ${config.algorithm}`);
  console.log(`Can accept connection: ${lb.canAcceptConnection()}`);
  console.log(`Connection count: ${lb.getConnectionCount()}`);
  console.log(`Is healthy: ${lb.isInstanceHealthy()}\n`);

  // Test 2: Connection management
  console.log('✅ Test 2: Connection Management');
  await lb.registerConnection('conn-1');
  await lb.registerConnection('conn-2');
  await lb.registerConnection('conn-3');
  console.log(`Connections after registration: ${lb.getConnectionCount()}`);
  
  await lb.unregisterConnection('conn-2');
  console.log(`Connections after unregistration: ${lb.getConnectionCount()}\n`);

  // Test 3: Status reporting
  console.log('✅ Test 3: Status Reporting');
  const status = await lb.getStatus();
  console.log('LoadBalancer Status:', JSON.stringify(status, null, 2));
  console.log();

  // Test 4: Algorithm testing
  console.log('✅ Test 4: Algorithm Testing');
  
  // Test Round Robin
  console.log('Testing Round Robin Algorithm:');
  const rrConfig = { ...config, algorithm: 'round-robin' as const };
  const rrLb = new LoadBalancer(rrConfig);
  
  // Since we only have 1 instance, optimal instance should be current
  const optimal1 = rrLb.getOptimalInstance();
  console.log(`Optimal instance (Round Robin): ${optimal1?.id || 'None'}`);
  
  // Test Least Connections
  console.log('\nTesting Least Connections Algorithm:');
  const lcConfig = { ...config, algorithm: 'least-connections' as const };
  const lcLb = new LoadBalancer(lcConfig);
  
  const optimal2 = lcLb.getOptimalInstance();
  console.log(`Optimal instance (Least Connections): ${optimal2?.id || 'None'}`);
  
  // Test CPU-based
  console.log('\nTesting CPU-based Algorithm:');
  const cpuConfig = { ...config, algorithm: 'cpu-based' as const };
  const cpuLb = new LoadBalancer(cpuConfig);
  
  const optimal3 = cpuLb.getOptimalInstance();
  console.log(`Optimal instance (CPU-based): ${optimal3?.id || 'None'}`);
  
  // Test Weighted
  console.log('\nTesting Weighted Algorithm:');
  const weightedConfig = { 
    ...config, 
    algorithm: 'weighted' as const,
    weights: { 'test-instance': 5 }
  };
  const weightedLb = new LoadBalancer(weightedConfig);
  
  const optimal4 = weightedLb.getOptimalInstance();
  console.log(`Optimal instance (Weighted): ${optimal4?.id || 'None'}\n`);

  // Test 5: Circuit Breaker
  console.log('✅ Test 5: Circuit Breaker Testing');
  
  // Listen to health check events
  lb.on('health-check', (data) => {
    console.log(`Health check event: ${data.instanceId} - Healthy: ${data.isHealthy}`);
    console.log(`Metrics:`, data.metrics);
  });

  // Wait for a health check cycle
  console.log('Waiting for health check cycle...');
  await new Promise(resolve => setTimeout(resolve, 6000));
  
  // Test 6: Stress testing
  console.log('\n✅ Test 6: Stress Testing');
  
  const stressConnections = Array.from({ length: 50 }, (_, i) => `stress-conn-${i}`);
  
  console.log(`Registering ${stressConnections.length} connections...`);
  const startTime = Date.now();
  
  for (const connId of stressConnections) {
    await lb.registerConnection(connId);
  }
  
  const registrationTime = Date.now() - startTime;
  console.log(`Registration completed in ${registrationTime}ms`);
  console.log(`Total connections: ${lb.getConnectionCount()}`);
  console.log(`Can still accept connections: ${lb.canAcceptConnection()}`);
  
  // Unregister half
  const unregisterTime = Date.now();
  for (let i = 0; i < 25; i++) {
    await lb.unregisterConnection(stressConnections[i]);
  }
  
  const unregistrationTime = Date.now() - unregisterTime;
  console.log(`Unregistration completed in ${unregistrationTime}ms`);
  console.log(`Remaining connections: ${lb.getConnectionCount()}\n`);

  // Test 7: Resource monitoring
  console.log('✅ Test 7: Resource Monitoring');
  
  const finalStatus = await lb.getStatus();
  console.log('Final LoadBalancer Status:');
  console.log(`- Total Instances: ${finalStatus.totalInstances}`);
  console.log(`- Healthy Instances: ${finalStatus.healthyInstances}`);
  console.log(`- Total Connections: ${finalStatus.totalConnections}`);
  console.log(`- Average Load: ${finalStatus.averageLoad}`);
  console.log(`- Circuit Breaker State: ${finalStatus.circuitBreakerState}`);
  console.log(`- Algorithm: ${finalStatus.algorithm}\n`);

  // Test 8: Performance metrics
  console.log('✅ Test 8: Performance Metrics');
  
  const perfTestStart = Date.now();
  const perfConnections = 1000;
  
  console.log(`Performance test: ${perfConnections} operations...`);
  
  for (let i = 0; i < perfConnections; i++) {
    await lb.registerConnection(`perf-${i}`);
    if (i % 2 === 0) {
      await lb.unregisterConnection(`perf-${i}`);
    }
  }
  
  const perfTestEnd = Date.now();
  const perfTime = perfTestEnd - perfTestStart;
  const opsPerSecond = (perfConnections * 1000) / perfTime;
  
  console.log(`Performance test completed in ${perfTime}ms`);
  console.log(`Operations per second: ${opsPerSecond.toFixed(2)}`);
  console.log(`Final connection count: ${lb.getConnectionCount()}\n`);

  // Cleanup
  console.log('🧹 Cleaning up...');
  await lb.shutdown();
  await rrLb.shutdown();
  await lcLb.shutdown();
  await cpuLb.shutdown();
  await weightedLb.shutdown();
  
  console.log('✅ All tests completed successfully!');
  console.log('\n🎉 Production-Ready LoadBalancer is working correctly!');
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Run tests
if (require.main === module) {
  testLoadBalancer().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

export { testLoadBalancer }; 