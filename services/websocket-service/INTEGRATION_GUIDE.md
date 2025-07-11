# Integration Guide

## 🚀 Quick Start

### 1. Cài đặt Client
```bash
npm install ws
```

### 2. Kết nối WebSocket
```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3001/ws');
```

### 3. Luồng Authentication
```javascript
ws.onopen = function() {
  console.log('Connected, waiting for auth request');
};

ws.onmessage = function(event) {
  const message = JSON.parse(event.data);
  
  if (message.method === 'auth.required') {
    // Server yêu cầu xác thực
    ws.send(JSON.stringify({
      jsonrpc: "2.0",
      method: "auth.authenticate",
      params: { token: "your-jwt-token" },
      id: 1
    }));
  }
  
  if (message.result && message.result.success) {
    console.log('Authenticated successfully');
    // Bây giờ có thể subscribe channels
    subscribeToChannels();
  }
};
```

### 4. Subscribe Channels
```javascript
function subscribeToChannels() {
  // Subscribe to prices
  ws.send(JSON.stringify({
    jsonrpc: "2.0",
    method: "subscribe",
    params: { channel: "prices" },
    id: 2
  }));
  
  // Subscribe to chain stats
  ws.send(JSON.stringify({
    jsonrpc: "2.0",
    method: "subscribe",
    params: { channel: "chain_stats" },
    id: 3
  }));
}
```

## 📡 Supported Channels

### Public Channels
- `prices` - Cập nhật giá token
- `chain_stats` - Thống kê blockchain
- `bridge_stats` - Thống kê bridge
- `stats_overview` - Tổng quan thống kê

### Authenticated Channels
- `orders` - Cập nhật đơn hàng
- `portfolio` - Cập nhật portfolio
- `trades` - Cập nhật giao dịch
- `user:{userId}` - Tin nhắn riêng tư

## 🔄 Message Flow

```
1. Client → Connect → Server
2. Server → auth.required → Client
3. Client → auth.authenticate → Server
4. Server → auth.success → Client
5. Client → subscribe → Server
6. Server → subscription.confirmed → Client
7. Kafka → event → Server → Client (subscribers only)
```

## 🎯 Use Cases

### Case 1: Chain Stats Monitoring
```javascript
// Subscribe to chain stats
ws.send(JSON.stringify({
  jsonrpc: "2.0",
  method: "subscribe",
  params: { channel: "chain_stats" },
  id: 1
}));

// Handle chain stats updates
ws.onmessage = function(event) {
  const message = JSON.parse(event.data);
  
  if (message.method === 'chain_stats_update') {
    console.log('Chain stats:', message.params);
    // Update UI with new stats
  }
};
```

### Case 2: Portfolio Tracking
```javascript
// Subscribe to portfolio updates
ws.send(JSON.stringify({
  jsonrpc: "2.0",
  method: "subscribe",
  params: { channel: "portfolio" },
  id: 2
}));

// Handle portfolio updates
ws.onmessage = function(event) {
  const message = JSON.parse(event.data);
  
  if (message.method === 'portfolio_update') {
    console.log('Portfolio update:', message.params);
    // Update user portfolio display
  }
};
```

### Case 3: Order Management
```javascript
// Subscribe to order updates
ws.send(JSON.stringify({
  jsonrpc: "2.0",
  method: "subscribe",
  params: { channel: "orders" },
  id: 3
}));

// Handle order updates
ws.onmessage = function(event) {
  const message = JSON.parse(event.data);
  
  if (message.method === 'order_update') {
    console.log('Order update:', message.params);
    // Update order status in UI
  }
};
```

## 🔧 Advanced Configuration

### Connection Options
```javascript
const ws = new WebSocket('ws://localhost:3001/ws', {
  perMessageDeflate: false,
  maxPayload: 1024 * 1024, // 1MB
  handshakeTimeout: 30000,
  headers: {
    'User-Agent': 'MoonX-Client/1.0.0'
  }
});
```

### Heartbeat Implementation
```javascript
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      jsonrpc: "2.0",
      method: "heartbeat",
      params: { timestamp: Date.now() },
      id: Date.now()
    }));
  }
}, 30000); // Every 30 seconds
```

### Reconnection Logic
```javascript
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

function connect() {
  const ws = new WebSocket('ws://localhost:3001/ws');
  
  ws.onopen = function() {
    console.log('Connected');
    reconnectAttempts = 0;
  };
  
  ws.onclose = function() {
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      setTimeout(connect, 1000 * reconnectAttempts); // Exponential backoff
    }
  };
  
  ws.onerror = function(error) {
    console.error('WebSocket error:', error);
  };
}
```

## 🎨 Frontend Integration

### React Hook
```javascript
import { useState, useEffect } from 'react';

function useWebSocket(url, token) {
  const [ws, setWs] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [data, setData] = useState(null);
  
  useEffect(() => {
    const websocket = new WebSocket(url);
    
    websocket.onopen = () => {
      setIsConnected(true);
      setWs(websocket);
    };
    
    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.method === 'auth.required') {
        websocket.send(JSON.stringify({
          jsonrpc: "2.0",
          method: "auth.authenticate",
          params: { token },
          id: 1
        }));
      }
      
      setData(message);
    };
    
    websocket.onclose = () => {
      setIsConnected(false);
    };
    
    return () => {
      websocket.close();
    };
  }, [url, token]);
  
  return { ws, isConnected, data };
}
```

### Vue.js Composition API
```javascript
import { ref, onMounted, onUnmounted } from 'vue';

export function useWebSocket(url, token) {
  const ws = ref(null);
  const isConnected = ref(false);
  const data = ref(null);
  
  onMounted(() => {
    ws.value = new WebSocket(url);
    
    ws.value.onopen = () => {
      isConnected.value = true;
    };
    
    ws.value.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.method === 'auth.required') {
        ws.value.send(JSON.stringify({
          jsonrpc: "2.0",
          method: "auth.authenticate",
          params: { token },
          id: 1
        }));
      }
      
      data.value = message;
    };
    
    ws.value.onclose = () => {
      isConnected.value = false;
    };
  });
  
  onUnmounted(() => {
    if (ws.value) {
      ws.value.close();
    }
  });
  
  return { ws, isConnected, data };
}
```

## ❌ Error Handling

### Connection Errors
```javascript
ws.onerror = function(error) {
  console.error('WebSocket error:', error);
  // Handle connection errors
};

ws.onclose = function(event) {
  console.log('Connection closed:', event.code, event.reason);
  
  if (event.code === 1006) {
    console.log('Abnormal closure, attempting reconnect');
    // Implement reconnection logic
  }
};
```

### Authentication Errors
```javascript
ws.onmessage = function(event) {
  const message = JSON.parse(event.data);
  
  if (message.error) {
    console.error('WebSocket error:', message.error);
    
    if (message.error.code === -32603) {
      console.log('Authentication failed, redirecting to login');
      // Redirect to login page
    }
  }
};
```

## 📊 Performance Tips

### 1. Message Batching
```javascript
const messageQueue = [];
let batchTimeout;

function sendMessage(message) {
  messageQueue.push(message);
  
  if (!batchTimeout) {
    batchTimeout = setTimeout(() => {
      // Send all messages in batch
      messageQueue.forEach(msg => ws.send(JSON.stringify(msg)));
      messageQueue.length = 0;
      batchTimeout = null;
    }, 10); // 10ms batch window
  }
}
```

### 2. Memory Management
```javascript
// Limit message history
const maxMessages = 1000;
let messageHistory = [];

ws.onmessage = function(event) {
  const message = JSON.parse(event.data);
  
  messageHistory.push(message);
  
  if (messageHistory.length > maxMessages) {
    messageHistory.shift(); // Remove oldest message
  }
};
```

### 3. Selective Subscription
```javascript
// Only subscribe to needed channels
const requiredChannels = ['prices', 'chain_stats'];

requiredChannels.forEach(channel => {
  ws.send(JSON.stringify({
    jsonrpc: "2.0",
    method: "subscribe",
    params: { channel },
    id: Date.now()
  }));
});
```

## 🔍 Testing

### Unit Test Example
```javascript
const WebSocket = require('ws');

describe('WebSocket Integration', () => {
  let ws;
  
  beforeEach(() => {
    ws = new WebSocket('ws://localhost:3001/ws');
  });
  
  afterEach(() => {
    ws.close();
  });
  
  it('should authenticate successfully', (done) => {
    ws.onopen = () => {
      // Wait for auth.required
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.method === 'auth.required') {
        ws.send(JSON.stringify({
          jsonrpc: "2.0",
          method: "auth.authenticate",
          params: { token: "test-token" },
          id: 1
        }));
      }
      
      if (message.result && message.result.success) {
        done();
      }
    };
  });
});
```

## 🚨 Common Issues

### Issue 1: Connection Timeout
```javascript
// Set connection timeout
const connectionTimeout = setTimeout(() => {
  ws.close();
  console.error('Connection timeout');
}, 10000);

ws.onopen = function() {
  clearTimeout(connectionTimeout);
};
```

### Issue 2: Authentication Timeout
```javascript
let authTimeout;

ws.onmessage = function(event) {
  const message = JSON.parse(event.data);
  
  if (message.method === 'auth.required') {
    authTimeout = setTimeout(() => {
      console.error('Authentication timeout');
      ws.close();
    }, message.params.timeout || 10000);
  }
  
  if (message.result && message.result.success) {
    clearTimeout(authTimeout);
  }
};
```

### Issue 3: Message Queue Overflow
```javascript
const maxQueueSize = 1000;
let messageQueue = [];

function addToQueue(message) {
  if (messageQueue.length >= maxQueueSize) {
    messageQueue.shift(); // Remove oldest
  }
  messageQueue.push(message);
}
``` 