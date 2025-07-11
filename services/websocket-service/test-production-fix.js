#!/usr/bin/env node

const WebSocket = require('ws');

console.log('🧪 Testing Production WebSocket Fix...');
console.log('URL: wss://ws.moonx.farm/');
console.log('Expected: Should connect successfully to nginx → /ws backend');

function testConnection() {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let connected = false;
    let authRequested = false;
    let messages = [];
    
    const ws = new WebSocket('wss://ws.moonx.farm/');
    
    const timeout = setTimeout(() => {
      ws.close();
      resolve({
        success: false,
        error: 'Connection timeout (10s)',
        duration: Date.now() - startTime,
        messages: messages
      });
    }, 10000);
    
    ws.on('open', () => {
      connected = true;
      clearTimeout(timeout);
      console.log('✅ WebSocket connected successfully!');
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        messages.push(message);
        console.log('📨 Received:', JSON.stringify(message, null, 2));
        
        if (message.method === 'auth.required' || message.method === 'auth_required') {
          authRequested = true;
          console.log('🔑 Auth required - sending test auth...');
          
          // Send dummy auth (will fail but proves connection works)
          const authMessage = {
            jsonrpc: "2.0",
            method: "authenticate",
            params: { token: "test-token" },
            id: 1
          };
          
          ws.send(JSON.stringify(authMessage));
          console.log('🔑 Auth request sent');
        }
        
        if (message.error || message.result) {
          console.log('📨 Auth response received');
          setTimeout(() => {
            ws.close();
            resolve({
              success: true,
              connected: connected,
              authRequested: authRequested,
              authResponseReceived: true,
              duration: Date.now() - startTime,
              messages: messages
            });
          }, 1000);
        }
        
      } catch (error) {
        console.log('❌ Message parse error:', error.message);
        messages.push({ error: error.message, raw: data.toString() });
      }
    });
    
    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      console.log(`🔌 Connection closed: ${code} ${reason.toString()}`);
      
      if (connected) {
        resolve({
          success: true,
          connected: connected,
          authRequested: authRequested,
          duration: Date.now() - startTime,
          messages: messages,
          closeCode: code,
          closeReason: reason.toString()
        });
      } else {
        resolve({
          success: false,
          connected: false,
          error: `Connection closed: ${code} ${reason.toString()}`,
          duration: Date.now() - startTime,
          messages: messages
        });
      }
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.log('❌ WebSocket error:', error.message);
      resolve({
        success: false,
        connected: false,
        error: error.message,
        duration: Date.now() - startTime,
        messages: messages
      });
    });
  });
}

// Run test
testConnection().then(result => {
  console.log('\n📊 Test Results:');
  console.log('================');
  console.log('Success:', result.success);
  console.log('Connected:', result.connected);
  console.log('Auth Requested:', result.authRequested);
  console.log('Duration:', result.duration + 'ms');
  console.log('Messages Received:', result.messages.length);
  
  if (result.error) {
    console.log('Error:', result.error);
  }
  
  if (result.closeCode) {
    console.log('Close Code:', result.closeCode);
    console.log('Close Reason:', result.closeReason);
  }
  
  console.log('\n🎯 Expected Results:');
  console.log('- Connected: true');
  console.log('- Auth Requested: true');
  console.log('- Messages: auth_required + auth response');
  console.log('- No 504 Gateway Timeout errors');
  
  if (result.success && result.connected && result.authRequested) {
    console.log('\n🎉 SUCCESS: Nginx configuration fix works!');
    console.log('✅ WebSocket connects to wss://ws.moonx.farm/');
    console.log('✅ Nginx successfully routes to backend /ws');
    console.log('✅ Backend processes WebSocket connections');
  } else {
    console.log('\n❌ FAILED: Issues still exist');
    console.log('- Check nginx configuration');
    console.log('- Check backend service');
    console.log('- Check SSL certificates');
  }
  
  process.exit(result.success ? 0 : 1);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
}); 