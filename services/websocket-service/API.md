# WebSocket API Documentation

## 🔌 Connection

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');
```

## 🔐 Authentication

### 1. Client Connect
```javascript
ws.onopen = function() {
  console.log('Connected, waiting for auth request...');
};
```

### 2. Server yêu cầu auth
```json
{
  "jsonrpc": "2.0",
  "method": "auth.required",
  "params": {
    "timeout": 10000
  }
}
```

### 3. Client gửi token
```json
{
  "jsonrpc": "2.0",
  "method": "auth.authenticate",
  "params": {
    "token": "your-jwt-token"
  },
  "id": 1
}
```

### 4. Server xác nhận
```json
{
  "jsonrpc": "2.0",
  "result": {
    "success": true,
    "user": {
      "id": "user_123",
      "address": "0x..."
    }
  },
  "id": 1
}
```

## 📡 Subscription

### Subscribe to channel
```json
{
  "jsonrpc": "2.0",
  "method": "subscribe",
  "params": {
    "channel": "prices"
  },
  "id": 2
}
```

### Subscription confirmed
```json
{
  "jsonrpc": "2.0",
  "result": {
    "channel": "prices",
    "subscribed": true
  },
  "id": 2
}
```

### Unsubscribe
```json
{
  "jsonrpc": "2.0",
  "method": "unsubscribe",
  "params": {
    "channel": "prices"
  },
  "id": 3
}
```

## 💓 Heartbeat

```json
{
  "jsonrpc": "2.0",
  "method": "heartbeat",
  "params": {
    "timestamp": 1701234567890
  },
  "id": 4
}
```

## 📨 Message Types

### Price Update
```json
{
  "jsonrpc": "2.0",
  "method": "price_update",
  "params": {
    "token": "ETH",
    "chainId": 8453,
    "price": "2150.45",
    "change24h": "5.2%"
  }
}
```

### Order Update
```json
{
  "jsonrpc": "2.0",
  "method": "order_update",
  "params": {
    "orderId": "order_123",
    "status": "filled",
    "tokenIn": "ETH",
    "tokenOut": "USDC",
    "amountIn": "1.0",
    "amountOut": "2150.45"
  }
}
```

### Chain Stats
```json
{
  "jsonrpc": "2.0",
  "method": "chain_stats_update",
  "params": {
    "chainId": 8453,
    "blockNumber": 12345678,
    "gasPrice": "0.001",
    "tps": 2.5
  }
}
```

## 🎯 Channels

- `prices` - Cập nhật giá token
- `orders` - Cập nhật đơn hàng  
- `portfolio` - Cập nhật portfolio
- `trades` - Cập nhật giao dịch
- `chain_stats` - Thống kê blockchain
- `bridge_stats` - Thống kê bridge
- `stats_overview` - Tổng quan thống kê
- `user:{userId}` - Tin nhắn riêng tư

## ❌ Error Handling

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": "Channel parameter is required"
  },
  "id": 1
}
```

### Error Codes
- `-32700` - Parse error
- `-32600` - Invalid request
- `-32601` - Method not found
- `-32602` - Invalid params
- `-32603` - Internal error

## 🔗 Complete Example

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.onopen = function() {
  console.log('Connected');
};

ws.onmessage = function(event) {
  const message = JSON.parse(event.data);
  
  if (message.method === 'auth.required') {
    // Authenticate
    ws.send(JSON.stringify({
      jsonrpc: "2.0",
      method: "auth.authenticate",
      params: { token: "your-jwt-token" },
      id: 1
    }));
  }
  
  if (message.result && message.result.success) {
    // Subscribe to prices
    ws.send(JSON.stringify({
      jsonrpc: "2.0",
      method: "subscribe",
      params: { channel: "prices" },
      id: 2
    }));
  }
  
  if (message.method === 'price_update') {
    console.log('Price update:', message.params);
  }
};
``` 