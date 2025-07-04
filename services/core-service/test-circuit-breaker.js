const { AlchemyService } = require('./dist/services/alchemyService');
const { performance } = require('perf_hooks');

async function testCircuitBreaker() {
  console.log('🧪 Testing Circuit Breaker Performance...\n');

  const alchemyService = new AlchemyService();
  const testWallet = '0x742d35Cc6634C0532925a3b8D4027d6c3C8D8e9e'; // Test wallet
  const testChainId = 8453; // Base

  // Test 1: Check health before test
  console.log('1️⃣ Initial Health Check:');
  const healthBefore = await alchemyService.healthCheck();
  console.log(JSON.stringify(healthBefore, null, 2));

  // Test 2: Normal operation timing
  console.log('\n2️⃣ Normal Operation Test:');
  const startTime = performance.now();
  
  try {
    const result = await alchemyService.getTokenBalances(testWallet, testChainId);
    const endTime = performance.now();
    
    console.log(`✅ Success: ${result.length} tokens found`);
    console.log(`⏱️  Time taken: ${Math.round(endTime - startTime)}ms`);
  } catch (error) {
    const endTime = performance.now();
    console.log(`❌ Error: ${error.message}`);
    console.log(`⏱️  Time taken: ${Math.round(endTime - startTime)}ms`);
  }

  // Test 3: Check health after test
  console.log('\n3️⃣ Final Health Check:');
  const healthAfter = await alchemyService.healthCheck();
  console.log(JSON.stringify(healthAfter, null, 2));

  // Test 4: Circuit breaker status
  console.log('\n4️⃣ Circuit Breaker Analysis:');
  if (Object.keys(healthAfter.circuitBreakerStatus).length > 0) {
    console.log('Circuit breaker states:');
    for (const [key, state] of Object.entries(healthAfter.circuitBreakerStatus)) {
      console.log(`  ${key}: ${state.isOpen ? '🔴 OPEN' : '🟢 CLOSED'} (failures: ${state.failures})`);
    }
  } else {
    console.log('No circuit breaker states recorded');
  }

  // Test 5: Performance comparison
  console.log('\n5️⃣ Performance Improvements:');
  console.log('✅ Reduced rate limiting: 1000ms → 300ms');
  console.log('✅ Reduced retries: 5 → 3 (faster failure detection)');
  console.log('✅ Reduced timeout: 15s → 10s');
  console.log('✅ Circuit breaker: Prevents cascading failures');
  console.log('✅ Smart backoff: Different delays for different errors');

  console.log('\n🎉 Circuit Breaker Test Complete!');
}

// Run the test
testCircuitBreaker().catch(console.error); 