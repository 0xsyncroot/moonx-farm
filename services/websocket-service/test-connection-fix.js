const WebSocket = require('ws');

// Test WebSocket connection fix
class ConnectionTester {
  constructor() {
    this.testResults = [];
  }

  async testConnection(name, url, token = 'test-token') {
    console.log(`\n🧪 Testing ${name}...`);
    console.log(`📡 URL: ${url}`);
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      let connected = false;
      let authRequested = false;
      let authResponseReceived = false;
      
      const ws = new WebSocket(url);
      
      const timeout = setTimeout(() => {
        if (!connected) {
          console.log(`❌ ${name}: Connection timeout`);
          ws.close();
          resolve({
            name,
            url,
            success: false,
            error: 'Connection timeout',
            duration: Date.now() - startTime
          });
        }
      }, 10000);
      
      ws.on('open', () => {
        console.log(`✅ ${name}: WebSocket connected`);
        connected = true;
        clearTimeout(timeout);
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log(`📨 ${name}: Received message:`, message);
          
          // Check for auth required message
          if (message.method === 'auth.required' || message.method === 'auth_required') {
            console.log(`🔑 ${name}: Authentication required`);
            authRequested = true;
            
            // Send auth message
            const authMessage = {
              jsonrpc: "2.0",
              method: "authenticate",
              params: {
                token: token
              },
              id: Date.now()
            };
            
            ws.send(JSON.stringify(authMessage));
            console.log(`🔑 ${name}: Sent authentication`);
          }
          
          // Check for auth response
          if (message.result || message.error) {
            authResponseReceived = true;
            console.log(`🔑 ${name}: Authentication response received`);
            
            // Close connection after getting response
            setTimeout(() => {
              ws.close();
              resolve({
                name,
                url,
                success: true,
                connected: true,
                authRequested,
                authResponseReceived,
                duration: Date.now() - startTime
              });
            }, 1000);
          }
          
        } catch (error) {
          console.log(`❌ ${name}: Failed to parse message:`, error.message);
        }
      });
      
      ws.on('close', (code, reason) => {
        console.log(`🔌 ${name}: Connection closed:`, code, reason.toString());
        
        if (!authResponseReceived) {
          resolve({
            name,
            url,
            success: connected && authRequested,
            connected,
            authRequested,
            authResponseReceived,
            error: !connected ? 'Connection failed' : !authRequested ? 'Auth not requested' : 'Auth response not received',
            duration: Date.now() - startTime
          });
        }
      });
      
      ws.on('error', (error) => {
        console.log(`❌ ${name}: WebSocket error:`, error.message);
        clearTimeout(timeout);
        resolve({
          name,
          url,
          success: false,
          error: error.message,
          duration: Date.now() - startTime
        });
      });
    });
  }

  async runAllTests() {
    console.log('🚀 WebSocket Connection Fix Test');
    console.log('=================================');
    
    const testCases = [
      {
        name: 'Direct Service (with /ws)',
        url: 'ws://localhost:3008/ws'
      },
      {
        name: 'Direct Service (without /ws)',
        url: 'ws://localhost:3008'
      },
      {
        name: 'Production (with /ws)',
        url: 'wss://ws.moonx.farm/ws'
      },
      {
        name: 'Production (without /ws)',
        url: 'wss://ws.moonx.farm'
      }
    ];
    
    for (const testCase of testCases) {
      const result = await this.testConnection(testCase.name, testCase.url);
      this.testResults.push(result);
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    this.printResults();
  }

  printResults() {
    console.log('\n📊 Test Results Summary');
    console.log('=======================');
    
    this.testResults.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.name}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Success: ${result.success ? '✅' : '❌'}`);
      console.log(`   Connected: ${result.connected ? '✅' : '❌'}`);
      console.log(`   Auth Requested: ${result.authRequested ? '✅' : '❌'}`);
      console.log(`   Auth Response: ${result.authResponseReceived ? '✅' : '❌'}`);
      console.log(`   Duration: ${result.duration}ms`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    // Summary
    const successful = this.testResults.filter(r => r.success).length;
    const total = this.testResults.length;
    
    console.log(`\n🎯 Overall Results: ${successful}/${total} tests passed`);
    
    if (successful === total) {
      console.log('🎉 All tests passed! WebSocket connection fix is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Please check the configuration.');
    }
  }
}

// Test WebSocket Manager URL processing
function testUrlProcessing() {
  console.log('\n🔧 Testing URL Processing Logic');
  console.log('==============================');
  
  const testUrls = [
    'http://localhost:3008',
    'https://ws.moonx.farm',
    'ws://localhost:3008/ws',
    'wss://ws.moonx.farm/ws',
    'localhost:3008',
    'ws.moonx.farm'
  ];
  
  testUrls.forEach(url => {
    let processedUrl = url;
    
    // Simulate WebSocket Manager logic
    if (processedUrl.startsWith('http://')) {
      processedUrl = processedUrl.replace(/^http:\/\//, 'ws://');
    } else if (processedUrl.startsWith('https://')) {
      processedUrl = processedUrl.replace(/^https:\/\//, 'wss://');
    } else if (!processedUrl.startsWith('ws://') && !processedUrl.startsWith('wss://')) {
      processedUrl = `ws://${processedUrl}`;
    }
    
    // Add /ws path if not present
    if (!processedUrl.includes('/ws')) {
      processedUrl = processedUrl.replace(/\/$/, '') + '/ws';
    }
    
    console.log(`${url} → ${processedUrl}`);
  });
}

// Run tests
async function main() {
  // Test URL processing logic
  testUrlProcessing();
  
  // Test actual connections
  const tester = new ConnectionTester();
  await tester.runAllTests();
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = ConnectionTester; 