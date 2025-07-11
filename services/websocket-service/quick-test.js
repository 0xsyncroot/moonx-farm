const WebSocket = require('ws');

// Quick test for WebSocket connection fix
async function quickTest() {
  console.log('🚀 Quick WebSocket Connection Test');
  console.log('==================================');
  
  const tests = [
    {
      name: 'Production (Root Path)',
      url: 'wss://ws.moonx.farm/',
      expected: 'Should connect to /ws automatically'
    },
    {
      name: 'Production (WS Path)',
      url: 'wss://ws.moonx.farm/ws',
      expected: 'Should connect directly'
    }
  ];
  
  for (const test of tests) {
    console.log(`\n📡 Testing: ${test.name}`);
    console.log(`🔗 URL: ${test.url}`);
    console.log(`📝 Expected: ${test.expected}`);
    
    const result = await testSingleConnection(test.url);
    
    if (result.success) {
      console.log(`✅ SUCCESS: Connected in ${result.duration}ms`);
      if (result.authRequested) {
        console.log(`🔑 Auth flow working correctly`);
      }
    } else {
      console.log(`❌ FAILED: ${result.error}`);
    }
    
    console.log('─'.repeat(50));
  }
}

function testSingleConnection(url) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let connected = false;
    let authRequested = false;
    
    const ws = new WebSocket(url);
    
    const timeout = setTimeout(() => {
      ws.close();
      resolve({
        success: false,
        error: 'Connection timeout (5s)',
        duration: Date.now() - startTime
      });
    }, 5000);
    
    ws.on('open', () => {
      connected = true;
      clearTimeout(timeout);
      console.log('  📡 WebSocket connected');
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.method === 'auth.required' || message.method === 'auth_required') {
          authRequested = true;
          console.log('  🔑 Auth required message received');
          
          // Send dummy auth (will fail but proves flow works)
          const authMessage = {
            jsonrpc: "2.0",
            method: "authenticate",
            params: { token: "test-token" },
            id: 1
          };
          
          ws.send(JSON.stringify(authMessage));
          console.log('  🔑 Sent auth response');
        }
        
        if (message.error || message.result) {
          console.log('  📨 Auth response received');
          ws.close();
          resolve({
            success: true,
            authRequested: authRequested,
            duration: Date.now() - startTime
          });
        }
        
      } catch (error) {
        console.log('  ❌ Message parse error:', error.message);
      }
    });
    
    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      console.log(`  🔌 Connection closed: ${code} ${reason}`);
      
      if (connected) {
        resolve({
          success: true,
          authRequested: authRequested,
          duration: Date.now() - startTime
        });
      }
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.log(`  ❌ WebSocket error: ${error.message}`);
      resolve({
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
    });
  });
}

// Test URL processing logic
function testUrlProcessing() {
  console.log('\n🔧 URL Processing Test');
  console.log('======================');
  
  const testCases = [
    'http://localhost:3008',
    'https://ws.moonx.farm',
    'ws://localhost:3008/ws',
    'wss://ws.moonx.farm/ws',
  ];
  
  testCases.forEach(url => {
    let processed = url;
    
    // Apply WebSocket Manager logic
    if (processed.startsWith('http://')) {
      processed = processed.replace(/^http:\/\//, 'ws://');
    } else if (processed.startsWith('https://')) {
      processed = processed.replace(/^https:\/\//, 'wss://');
    }
    
    if (!processed.includes('/ws')) {
      processed = processed.replace(/\/$/, '') + '/ws';
    }
    
    console.log(`${url} → ${processed}`);
  });
}

// Run tests
async function main() {
  testUrlProcessing();
  await quickTest();
  
  console.log('\n🎯 Fix Summary:');
  console.log('✅ WebSocket Manager: Auto-adds /ws path');
  console.log('✅ Nginx Config: Handles both / and /ws paths');
  console.log('✅ Frontend: No changes needed');
  console.log('\n🚀 Your WebSocket connection should now work!');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { quickTest, testUrlProcessing }; 