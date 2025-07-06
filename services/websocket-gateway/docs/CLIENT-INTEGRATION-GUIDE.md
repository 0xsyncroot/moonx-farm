# WebSocket Gateway Client Integration Guide

## 📋 **Table of Contents**

1. [Overview](#overview)
2. [Authentication Flow](#authentication-flow)
3. [Connection Setup](#connection-setup)
4. [Room Management](#room-management)
5. [Real-time Notifications](#real-time-notifications)
6. [Error Handling](#error-handling)
7. [Client Examples](#client-examples)
8. [API Reference](#api-reference)

---

## 🎯 **Overview**

MoonX Farm WebSocket Gateway provides real-time bidirectional communication for:

- **Real-time notifications** (swaps, orders, price alerts)
- **Room management** (user groups, trading rooms)
- **Presence tracking** (online/offline status)
- **Direct messaging** (user-to-user communication)
- **Live updates** (portfolio changes, market data)

**Architecture**: Client ↔ WebSocket Gateway ↔ Redis ↔ Other Services

---

## 🔐 **Authentication Flow**

### Step 1: Obtain JWT Token
First, authenticate with the auth service to get a JWT token:

```javascript
// 1. Authenticate with Privy (frontend)
const privyToken = await privy.getToken();

// 2. Exchange for JWT tokens
const response = await fetch('http://localhost:3001/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ privyToken })
});

const { accessToken, refreshToken } = await response.json();
```

### Step 2: Connect to WebSocket Gateway
Use the JWT token to establish WebSocket connection:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3011', {
  auth: {
    token: accessToken // JWT access token
  },
  transports: ['websocket'], // Use WebSocket only for best performance
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});
```

---

## 🔌 **Connection Setup**

### Basic Connection

```javascript
// Initialize socket connection
const socket = io('http://localhost:3011', {
  auth: { token: accessToken },
  transports: ['websocket']
});

// Connection events
socket.on('connect', () => {
  console.log('✅ Connected to WebSocket Gateway');
  console.log('Connection ID:', socket.id);
});

socket.on('connected', (data) => {
  console.log('🎉 Welcome message:', data);
  // { connectionId, timestamp, serverVersion }
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected:', reason);
});

socket.on('error', (error) => {
  console.error('🚨 Socket error:', error);
});
```

### Authentication Events

```javascript
// Authentication success
socket.on('authenticated', (data) => {
  console.log('🔐 Authenticated as:', data.user);
  // User is now authenticated and can join rooms
});

// Authentication failure
socket.on('auth_error', (error) => {
  console.error('🚫 Authentication failed:', error);
  // Handle token refresh or redirect to login
});

// Token expired
socket.on('token_expired', () => {
  console.warn('⚠️ Token expired, refreshing...');
  // Refresh token and reconnect
  refreshTokenAndReconnect();
});
```

---

## 🏠 **Room Management**

### Join Rooms

```javascript
// Join specific DEX trading rooms
socket.emit('join_room', { room: 'price:BTC-USDC' });    // Price updates
socket.emit('join_room', { room: 'trade:BTC-USDC' });    // Trade notifications
socket.emit('join_room', { room: 'user:your-user-id' }); // Personal notifications
socket.emit('join_room', { room: 'portfolio:your-user-id' }); // Portfolio updates

// Alternative: Use message router for subscriptions
socket.emit('subscribe_price', { symbol: 'BTC-USDC' });
socket.emit('subscribe_trades', { pair: 'BTC-USDC' });
socket.emit('subscribe_portfolio', {});
socket.emit('subscribe_orders', {});

// Room join confirmation
socket.on('room_joined', (data) => {
  console.log('🎯 Joined room:', data);
  // { room: 'price:BTC-USDC' }
});

// Subscription confirmations
socket.on('price_subscribed', (data) => {
  console.log('📈 Price subscribed:', data);
  // { symbol: 'BTC-USDC' }
});

socket.on('trades_subscribed', (data) => {
  console.log('💱 Trades subscribed:', data);
  // { pair: 'BTC-USDC' }
});
```

### Leave Rooms

```javascript
// Leave specific rooms
socket.emit('leave_room', { room: 'price:BTC-USDC' });
socket.emit('leave_room', { room: 'trade:BTC-USDC' });

// Unsubscribe using message router
socket.emit('unsubscribe', { 
  type: 'price', 
  identifier: 'BTC-USDC' 
});

// Room leave confirmation
socket.on('room_left', (data) => {
  console.log('👋 Left room:', data.room);
  // { room: 'price:BTC-USDC' }
});

// Unsubscribe confirmation
socket.on('unsubscribed', (data) => {
  console.log('📤 Unsubscribed:', data);
  // { type: 'price', identifier: 'BTC-USDC' }
});
```

### Valid Room Patterns

```javascript
// Supported room patterns
const validRoomPatterns = {
  // Price updates for trading pairs
  price: 'price:BTC-USDC',
  
  // Trade notifications for pairs
  trade: 'trade:BTC-USDC',
  
  // User personal notifications
  user: 'user:your-user-id',
  
  // Portfolio updates
  portfolio: 'portfolio:your-user-id',
  
  // Chart data (if needed)
  chart: 'chart:BTC',
  
  // Order book updates
  orderbook: 'orderbook:BTC-USDC'
};

// Room name validation
function isValidRoomName(room) {
  const patterns = [
    /^chart:[A-Z]{2,10}$/,
    /^trade:[A-Z]{2,10}-[A-Z]{2,10}$/,
    /^user:[a-zA-Z0-9-]{8,}$/,
    /^portfolio:[a-zA-Z0-9-]{8,}$/,
    /^price:[A-Z]{2,10}-[A-Z]{2,10}$/,
    /^orderbook:[A-Z]{2,10}-[A-Z]{2,10}$/
  ];
  
  return patterns.some(pattern => pattern.test(room));
}
```

---

## 📢 **Real-time Notifications**

### DEX Event Types

```javascript
// Price updates (ultra-low latency)
socket.on('price_update', (data) => {
  console.log('💰 Price update:', data);
  // { symbol, price, change, volume, timestamp }
  updatePriceDisplay(data);
});

// Order book updates
socket.on('order_book_update', (data) => {
  console.log('📊 Order book update:', data);
  // { symbol, bids, asks, timestamp }
  updateOrderBookDisplay(data);
});

// Trade notifications
socket.on('trade_notification', (data) => {
  console.log('💱 Trade notification:', data);
  // { symbol, price, amount, side, timestamp, personal? }
  
  if (data.personal) {
    showPersonalTradeNotification(data);
  } else {
    updateTradeHistory(data);
  }
});

// Portfolio updates
socket.on('portfolio_update', (data) => {
  console.log('💼 Portfolio update:', data);
  // { totalValue, positions, pnl, timestamp }
  updatePortfolioDisplay(data);
});

// System alerts
socket.on('system_alert', (data) => {
  console.log('🚨 System alert:', data);
  // { level, message, timestamp }
  showSystemAlert(data);
});
```

### Subscribe to Real-time Data

```javascript
// Subscribe to event types (using connection manager)
socket.emit('subscribe', {
  types: ['price_updates', 'trade_notifications', 'portfolio_updates', 'system_alerts', 'order_updates']
});

// Subscribe confirmation
socket.on('subscribed', (data) => {
  console.log('✅ Subscribed to:', data.types);
});

// Specific subscriptions using message router
socket.emit('subscribe_price', { symbol: 'BTC-USDC' });
socket.emit('subscribe_trades', { pair: 'ETH-USDC' });
socket.emit('subscribe_portfolio', {});
socket.emit('subscribe_orders', {});

// Subscription confirmations
socket.on('price_subscribed', (data) => {
  console.log('📈 Price subscribed:', data.symbol);
});

socket.on('trades_subscribed', (data) => {
  console.log('💱 Trades subscribed:', data.pair);
});

socket.on('portfolio_subscribed', (data) => {
  console.log('💼 Portfolio subscribed for user:', data.userId);
});

socket.on('orders_subscribed', (data) => {
  console.log('📋 Orders subscribed for user:', data.userId);
});
```

---

## 🚨 **Error Handling**

### Comprehensive Error Handling

```javascript
// Connection errors
socket.on('connect_error', (error) => {
  console.error('🔌 Connection error:', error);
  
  if (error.message.includes('401')) {
    // Token expired, refresh and retry
    refreshTokenAndReconnect();
  } else if (error.message.includes('429')) {
    // Rate limited, wait and retry
    setTimeout(() => socket.connect(), 5000);
  } else {
    // Other errors
    showErrorMessage('Connection failed. Please try again.');
  }
});

// General errors
socket.on('error', (error) => {
  console.error('🚨 Socket error:', error);
  
  switch (error.code) {
    case 'RATE_LIMITED':
      showWarning('Too many requests. Please slow down.');
      break;
    case 'ROOM_NOT_FOUND':
      showError('Room not found or access denied.');
      break;
    case 'INVALID_MESSAGE':
      showError('Invalid message format.');
      break;
    default:
      showError('An unexpected error occurred.');
  }
});

// Token refresh helper
async function refreshTokenAndReconnect() {
  try {
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${refreshToken}` }
    });
    
    const { accessToken: newToken } = await response.json();
    
    // Update socket auth
    socket.auth.token = newToken;
    socket.connect();
    
  } catch (error) {
    console.error('Failed to refresh token:', error);
    // Redirect to login
    window.location.href = '/login';
  }
}
```

---

## 💻 **Client Examples**

### React Hook Example

```tsx
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketProps {
  token: string;
  userId: string;
}

export function useWebSocket({ token, userId }: UseWebSocketProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;

    const socketInstance = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL, {
      auth: { token },
      transports: ['websocket']
    });

    // Connection events
    socketInstance.on('connect', () => {
      console.log('Connected to WebSocket');
      setConnected(true);
      
      // Auto-join user's personal room
      socketInstance.emit('join_room', {
        roomId: `user-${userId}`,
        roomType: 'personal'
      });
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
    });

    // Notification handlers
    socketInstance.on('notification', (data) => {
      setNotifications(prev => [data, ...prev.slice(0, 49)]); // Keep last 50
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token, userId]);

  // Helper functions
  const joinRoom = (roomId: string, roomType: string) => {
    socket?.emit('join_room', { roomId, roomType });
  };

  const leaveRoom = (roomId: string) => {
    socket?.emit('leave_room', { roomId });
  };

  const sendMessage = (roomId: string, message: string) => {
    socket?.emit('room_message', { roomId, message });
  };

  return {
    socket,
    connected,
    notifications,
    joinRoom,
    leaveRoom,
    sendMessage
  };
}
```

### Vue Composable Example

```typescript
import { ref, onMounted, onUnmounted } from 'vue';
import { io, Socket } from 'socket.io-client';

export function useWebSocket(token: string) {
  const socket = ref<Socket | null>(null);
  const connected = ref(false);
  const notifications = ref<any[]>([]);

  onMounted(() => {
    if (!token) return;

    socket.value = io(import.meta.env.VITE_WEBSOCKET_URL, {
      auth: { token },
      transports: ['websocket']
    });

    socket.value.on('connect', () => {
      connected.value = true;
    });

    socket.value.on('disconnect', () => {
      connected.value = false;
    });

    socket.value.on('notification', (data) => {
      notifications.value.unshift(data);
      if (notifications.value.length > 50) {
        notifications.value = notifications.value.slice(0, 50);
      }
    });
  });

  onUnmounted(() => {
    socket.value?.disconnect();
  });

  return {
    socket: readonly(socket),
    connected: readonly(connected),
    notifications: readonly(notifications)
  };
}
```

### Angular Service Example

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket: Socket | null = null;
  private connectedSubject = new BehaviorSubject<boolean>(false);
  private notificationsSubject = new BehaviorSubject<any[]>([]);

  public connected$ = this.connectedSubject.asObservable();
  public notifications$ = this.notificationsSubject.asObservable();

  connect(token: string): void {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(environment.websocketUrl, {
      auth: { token },
      transports: ['websocket']
    });

    this.socket.on('connect', () => {
      this.connectedSubject.next(true);
    });

    this.socket.on('disconnect', () => {
      this.connectedSubject.next(false);
    });

    this.socket.on('notification', (data) => {
      const current = this.notificationsSubject.value;
      this.notificationsSubject.next([data, ...current.slice(0, 49)]);
    });
  }

  joinRoom(roomId: string, roomType: string): void {
    this.socket?.emit('join_room', { roomId, roomType });
  }

  leaveRoom(roomId: string): void {
    this.socket?.emit('leave_room', { roomId });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.connectedSubject.next(false);
  }
}
```

---

## 📖 **API Reference**

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `join_room` | `{ room: string }` | Join a specific room (e.g., "price:BTC-USDC") |
| `leave_room` | `{ room: string }` | Leave a specific room |
| `subscribe` | `{ types: string[] }` | Subscribe to event types |
| `subscribe_price` | `{ symbol: string }` | Subscribe to price updates for symbol |
| `subscribe_trades` | `{ pair: string }` | Subscribe to trade notifications for pair |
| `subscribe_portfolio` | `{}` | Subscribe to portfolio updates |
| `subscribe_orders` | `{}` | Subscribe to order updates |
| `unsubscribe` | `{ type: string, identifier: string }` | Unsubscribe from specific subscription |
| `ping` | `{}` | Heartbeat ping |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | `{ connectionId, timestamp, serverVersion }` | Welcome message |
| `authenticated` | `{ user: object }` | Authentication success |
| `auth_error` | `{ error: string }` | Authentication failed |
| `token_expired` | `{}` | JWT token expired |
| `room_joined` | `{ room: string }` | Room join success |
| `room_left` | `{ room: string }` | Room leave success |
| `subscribed` | `{ types: string[] }` | Event subscription success |
| `price_subscribed` | `{ symbol: string }` | Price subscription success |
| `trades_subscribed` | `{ pair: string }` | Trade subscription success |
| `portfolio_subscribed` | `{ userId: string }` | Portfolio subscription success |
| `orders_subscribed` | `{ userId: string }` | Order subscription success |
| `unsubscribed` | `{ type: string, identifier: string }` | Unsubscribe success |
| `price_update` | `{ symbol, price, change, volume, timestamp }` | Real-time price update |
| `order_book_update` | `{ symbol, bids, asks, timestamp }` | Order book update |
| `trade_notification` | `{ symbol, price, amount, side, personal?, timestamp }` | Trade notification |
| `portfolio_update` | `{ totalValue, positions, pnl, timestamp }` | Portfolio update |
| `system_alert` | `{ level, message, timestamp }` | System alert |
| `pong` | `{ timestamp, serverTime }` | Heartbeat response |
| `error` | `{ message, event? }` | Error message |

### Room Patterns

| Pattern | Description | Example Room ID |
|---------|-------------|-----------------|
| `price:SYMBOL-SYMBOL` | Price updates for trading pair | `price:BTC-USDC` |
| `trade:SYMBOL-SYMBOL` | Trade notifications for pair | `trade:BTC-USDC` |
| `orderbook:SYMBOL-SYMBOL` | Order book updates | `orderbook:ETH-USDC` |
| `user:userId` | User's personal notifications | `user:user-123` |
| `portfolio:userId` | Portfolio updates | `portfolio:user-123` |
| `chart:SYMBOL` | Chart data for symbol | `chart:BTC` |

### Valid Event Types

| Type | Description | Required for |
|------|-------------|--------------|
| `price_updates` | Price update notifications | DEX trading |
| `trade_notifications` | Trade execution notifications | Trade history |
| `portfolio_updates` | Portfolio value changes | Portfolio tracking |
| `system_alerts` | System-wide announcements | Platform updates |
| `order_updates` | Order status changes | Order management |

### Error Codes

| Code | Description | Action |
|------|-------------|---------|
| `AUTH_REQUIRED` | Authentication required | Provide valid token |
| `TOKEN_EXPIRED` | JWT token expired | Refresh token |
| `RATE_LIMITED` | Too many requests | Slow down requests |
| `ROOM_NOT_FOUND` | Room doesn't exist | Check room ID |
| `ACCESS_DENIED` | No access to room | Check permissions |
| `INVALID_MESSAGE` | Invalid message format | Fix message structure |
| `CONNECTION_LIMIT` | Too many connections | Try again later |

---

## 🔧 **Best Practices**

### 1. Connection Management
- Always handle reconnection logic
- Implement exponential backoff for failed connections
- Clean up event listeners on component unmount

### 2. Error Handling
- Handle all error events
- Implement token refresh logic
- Provide user-friendly error messages

### 3. Performance
- Use WebSocket transport only for best performance
- Limit notification history to prevent memory leaks
- Debounce rapid events

### 4. Security
- Never expose JWT tokens in logs
- Implement proper token refresh
- Validate all incoming data

### 5. User Experience
- Show connection status to users
- Provide loading states
- Handle offline/online scenarios

---

## 🚀 **Next Steps**

1. **Test Connection**: Start with basic connection and authentication
2. **Join Rooms**: Implement room joining for your use case
3. **Handle Notifications**: Set up notification handlers
4. **Error Handling**: Implement comprehensive error handling
5. **Production Ready**: Add monitoring and logging

**Need help?** Check the [WebSocket Gateway API documentation](./API-REFERENCE.md) or contact the development team.

---

**Happy coding! 🎉** 