const WebSocket = require('ws');

// Test client cho WebSocket service
class WebSocketTestClient {
  constructor(url, token) {
    this.url = url;
    this.token = token;
    this.ws = null;
    this.connected = false;
    this.authenticated = false;
    this.messages = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log('🔌 Connecting to WebSocket:', this.url);
      
      this.ws = new WebSocket(this.url);
      
      this.ws.on('open', () => {
        console.log('✅ WebSocket connected');
        this.connected = true;
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('📨 Received message:', JSON.stringify(message, null, 2));
          
          this.messages.push(message);
          
          // Handle auth.required message
          if (message.method === 'auth.required' || message.method === 'auth_required') {
            console.log('🔑 Authentication required, sending token...');
            this.authenticate();
          }
          
          // Handle auth success
          if (message.result && message.result.clientId) {
            console.log('✅ Authentication successful');
            this.authenticated = true;
            this.testSubscriptions();
          }
          
          // Handle auth failure
          if (message.error && message.error.code) {
            console.log('❌ Authentication failed:', message.error.message);
          }
          
        } catch (error) {
          console.log('❌ Failed to parse message:', error.message);
          console.log('Raw message:', data.toString());
        }
      });

      this.ws.on('close', (code, reason) => {
        console.log('🔌 WebSocket closed:', code, reason.toString());
        this.connected = false;
        this.authenticated = false;
      });

      this.ws.on('error', (error) => {
        console.log('❌ WebSocket error:', error.message);
        reject(error);
      });

      // Connection timeout
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  authenticate() {
    if (!this.ws || !this.connected) {
      console.log('❌ Cannot authenticate - not connected');
      return;
    }

    const authMessage = {
      jsonrpc: "2.0",
      method: "authenticate",
      params: {
        token: this.token
      },
      id: Date.now()
    };

    console.log('🔑 Sending authentication message...');
    this.ws.send(JSON.stringify(authMessage));
  }

  testSubscriptions() {
    if (!this.ws || !this.authenticated) {
      console.log('❌ Cannot subscribe - not authenticated');
      return;
    }

    console.log('📡 Testing subscriptions...');
    
    // Subscribe to prices
    const subscribeMessage = {
      jsonrpc: "2.0",
      method: "subscribe",
      params: {
        channel: "prices"
      },
      id: Date.now()
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    console.log('📡 Subscribed to prices channel');
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }

  // Test with different scenarios
  async runTests() {
    try {
      console.log('🧪 Starting WebSocket tests...');
      
      await this.connect();
      console.log('✅ Connection test passed');
      
      // Wait for auth and subscription
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      if (this.authenticated) {
        console.log('✅ Authentication test passed');
      } else {
        console.log('❌ Authentication test failed');
      }
      
      console.log('📊 Total messages received:', this.messages.length);
      
      this.disconnect();
      
    } catch (error) {
      console.log('❌ Test failed:', error.message);
      this.disconnect();
    }
  }
}

// Test function
async function runWebSocketTests() {
  console.log('🚀 Starting WebSocket Service Tests');
  console.log('=====================================');
  
  const configs = [
    {
      name: 'Local Development',
      url: 'ws://localhost:3008/ws',
      token: 'test-token-123' // Dummy token for testing
    },
    {
      name: 'Production (via nginx)',
      url: 'wss://ws.moonx.farm/',
      token: 'test-token-123' // Dummy token for testing
    }
  ];

  for (const config of configs) {
    console.log(`\n🧪 Testing ${config.name}...`);
    console.log('URL:', config.url);
    
    const client = new WebSocketTestClient(config.url, config.token);
    await client.runTests();
    
    console.log('---');
  }
}

// Run tests if called directly
if (require.main === module) {
  runWebSocketTests().catch(console.error);
}

module.exports = WebSocketTestClient; 