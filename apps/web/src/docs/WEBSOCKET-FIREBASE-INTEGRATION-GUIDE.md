# WebSocket + Firebase Integration Guide

## 🎯 **Tổng quan**

Service tích hợp WebSocket + Firebase này cung cấp:

- **📊 Real-time data**: Price OHLCV, order book, trades qua WebSocket (< 1ms latency)
- **🔔 Push notifications**: Firebase FCM cho notification khi offline
- **🔄 Auto fallback**: Tự động chuyển đổi giữa WebSocket và Firebase
- **⚡ Ultra-low latency**: Dùng WebSocket khi online, Firebase khi offline
- **📱 Cross-platform**: Hỗ trợ web, mobile, desktop

## 🚀 **Cài đặt Dependencies**

```bash
# WebSocket client
npm install socket.io-client

# Firebase SDK
npm install firebase

# React hooks (nếu dùng React)
npm install react
```

## 🔧 **Setup Firebase**

### 1. Firebase Console Setup
```javascript
// firebase-config.js
export const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### 2. Firebase Service Worker (public/firebase-messaging-sw.js)
```javascript
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  // Your config
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/firebase-logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

## 📦 **Cách sử dụng**

### 1. App Provider Setup
```tsx
// app/layout.tsx hoặc _app.tsx
import { WebSocketFirebaseProvider } from '@/contexts/websocket-firebase-context';
import { firebaseConfig } from '@/config/firebase';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WebSocketFirebaseProvider
          websocketUrl={process.env.NEXT_PUBLIC_WEBSOCKET_URL}
          firebaseConfig={firebaseConfig}
          jwtToken={session?.accessToken}
          userId={session?.user?.id}
          enabled={!!session?.user}
        >
          {children}
        </WebSocketFirebaseProvider>
      </body>
    </html>
  );
}
```

### 2. Trading Component Example
```tsx
// components/trading/price-ticker.tsx
import { useTradingData } from '@/contexts/websocket-firebase-context';

export function PriceTicker() {
  const { getPriceForSymbol, subscribeToPrice } = useTradingData();

  useEffect(() => {
    // Subscribe to price updates
    const symbols = ['BTC-USDC', 'ETH-USDC', 'SOL-USDC'];
    symbols.forEach(symbol => subscribeToPrice(symbol));
  }, [subscribeToPrice]);

  const btcPrice = getPriceForSymbol('BTC-USDC');

  return (
    <div>
      <h3>BTC Price</h3>
      <p>${btcPrice?.price.toFixed(2)}</p>
      <p className={btcPrice?.change > 0 ? 'text-green-500' : 'text-red-500'}>
        {btcPrice?.change > 0 ? '+' : ''}{btcPrice?.change.toFixed(2)}%
      </p>
    </div>
  );
}
```

### 3. Notification Component
```tsx
// components/notifications/notification-center.tsx
import { useNotifications } from '@/contexts/websocket-firebase-context';

export function NotificationCenter() {
  const { 
    tradeNotifications, 
    systemAlerts, 
    getLatestTradeNotifications 
  } = useNotifications();

  const recentTrades = getLatestTradeNotifications(5);

  return (
    <div>
      <h3>Recent Trades</h3>
      {recentTrades.map((trade, index) => (
        <div key={index} className="notification-item">
          <span>{trade.symbol}</span>
          <span>{trade.side} {trade.amount}</span>
          <span>${trade.price.toFixed(4)}</span>
          {trade.personal && <span className="badge">Your Trade</span>}
        </div>
      ))}
    </div>
  );
}
```

### 4. Portfolio Component
```tsx
// components/portfolio/portfolio-summary.tsx
import { usePortfolioData } from '@/contexts/websocket-firebase-context';

export function PortfolioSummary() {
  const { portfolioUpdate, subscribeToPortfolio } = usePortfolioData();

  useEffect(() => {
    subscribeToPortfolio();
  }, [subscribeToPortfolio]);

  if (!portfolioUpdate) return <div>Loading...</div>;

  return (
    <div>
      <h3>Portfolio Value</h3>
      <p>${portfolioUpdate.totalValue.toFixed(2)}</p>
      <p className={portfolioUpdate.pnl > 0 ? 'text-green-500' : 'text-red-500'}>
        P&L: {portfolioUpdate.pnl > 0 ? '+' : ''}${portfolioUpdate.pnl.toFixed(2)}
      </p>
      <div>
        <h4>Positions</h4>
        {portfolioUpdate.positions.map((position, index) => (
          <div key={index}>
            <span>{position.symbol}</span>
            <span>{position.amount}</span>
            <span>${position.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 5. Connection Status Component
```tsx
// components/status/connection-indicator.tsx
import { useConnectionStatus } from '@/contexts/websocket-firebase-context';

export function ConnectionIndicator() {
  const { 
    isWebSocketConnected, 
    isFirebaseReady, 
    isOnline, 
    error 
  } = useConnectionStatus();

  return (
    <div className="flex items-center space-x-2">
      <div className={`w-3 h-3 rounded-full ${isWebSocketConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span>WebSocket: {isWebSocketConnected ? 'Connected' : 'Disconnected'}</span>
      
      <div className={`w-3 h-3 rounded-full ${isFirebaseReady ? 'bg-blue-500' : 'bg-gray-500'}`} />
      <span>Firebase: {isFirebaseReady ? 'Ready' : 'Not Ready'}</span>
      
      <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
      <span>{isOnline ? 'Online' : 'Offline'}</span>
      
      {error && (
        <span className="text-red-500 text-sm">Error: {error}</span>
      )}
    </div>
  );
}
```

## ⚙️ **Configuration**

### Environment Variables
```env
# WebSocket Gateway URL
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3007

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your-vapid-key

# Auth Service
NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:3001
```

### Notification Settings
```tsx
// Customize notification behavior
const { updateConfig } = useWebSocketFirebaseContext();

// Update settings
updateConfig({
  enablePriceAlerts: true,
  enableTradeNotifications: true,
  enablePortfolioUpdates: true,
  enableSystemAlerts: true,
  offlineNotifications: true
});
```

## 🔄 **Data Flow**

### Real-time Flow (Online)
```
1. User online → WebSocket connects
2. Subscribe to rooms: price:BTC-USDC, user:123, portfolio:123
3. Backend pushes updates → WebSocket → React state update
4. UI updates immediately (< 1ms latency)
```

### Offline Flow (Offline)
```
1. User offline → WebSocket disconnects
2. Backend detects offline → Sends FCM notification
3. Firebase receives → Shows push notification
4. User returns online → WebSocket reconnects → Sync data
```

## 📊 **Event Types**

### Price Updates
```typescript
interface PriceUpdate {
  symbol: string;        // 'BTC-USDC'
  price: number;         // 45000.50
  change: number;        // +2.5 (percentage)
  volume: number;        // 1234567.89
  timestamp: number;     // Unix timestamp
}
```

### Trade Notifications
```typescript
interface TradeNotification {
  symbol: string;        // 'BTC-USDC'
  price: number;         // 45000.00
  amount: number;        // 0.1
  side: 'buy' | 'sell';  // Trade side
  personal?: boolean;    // User's own trade
  timestamp: number;
}
```

### Portfolio Updates
```typescript
interface PortfolioUpdate {
  totalValue: number;    // Total portfolio value
  positions: Array<{
    symbol: string;
    amount: number;
    value: number;
  }>;
  pnl: number;          // Profit/Loss
  timestamp: number;
}
```

## 🚨 **Error Handling**

### Connection Errors
```tsx
const { error, connectionStatus } = useConnectionStatus();

useEffect(() => {
  if (error) {
    console.error('WebSocket error:', error);
    
    // Handle different error types
    if (error.includes('401')) {
      // Token expired - refresh token
      refreshAuthToken();
    } else if (error.includes('429')) {
      // Rate limited - retry later
      setTimeout(() => window.location.reload(), 5000);
    }
  }
}, [error]);
```

### Token Refresh
```tsx
const service = useWebSocketFirebaseContext();

// Listen for token expiry
useEffect(() => {
  const handleTokenExpired = async () => {
    try {
      const newToken = await refreshAuthToken();
      // Reinitialize service with new token
      window.location.reload();
    } catch (error) {
      // Redirect to login
      router.push('/login');
    }
  };

  service.on('token-expired', handleTokenExpired);
  return () => service.removeListener('token-expired', handleTokenExpired);
}, []);
```

## 📱 **Mobile Integration**

### React Native
```tsx
// Similar setup but with React Native Firebase
import messaging from '@react-native-firebase/messaging';

// Request permission
const requestPermission = async () => {
  const authStatus = await messaging().requestPermission();
  const enabled = 
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    console.log('Authorization status:', authStatus);
  }
};
```

## 🎯 **Best Practices**

### 1. Performance Optimization
```tsx
// Debounce price updates to prevent excessive re-renders
const debouncedPriceUpdate = useMemo(
  () => debounce((prices) => {
    updatePriceDisplay(prices);
  }, 100),
  []
);
```

### 2. Memory Management
```tsx
// Limit notification history to prevent memory leaks
const maxNotifications = 100;
const maxAlerts = 50;

// Clean up old notifications
useEffect(() => {
  const cleanup = setInterval(() => {
    if (tradeNotifications.length > maxNotifications) {
      clearOldNotifications();
    }
  }, 60000); // Every minute

  return () => clearInterval(cleanup);
}, []);
```

### 3. Offline Handling
```tsx
// Show offline indicator
const { isOnline } = useConnectionStatus();

return (
  <div>
    {!isOnline && (
      <div className="offline-banner">
        📱 You're offline. Push notifications are active.
      </div>
    )}
    {/* Your app content */}
  </div>
);
```

## 🔧 **Troubleshooting**

### Common Issues

1. **WebSocket không connect**
   - Kiểm tra `NEXT_PUBLIC_WEBSOCKET_URL`
   - Kiểm tra JWT token hợp lệ
   - Kiểm tra network/firewall

2. **Firebase notifications không hoạt động**
   - Kiểm tra permission granted
   - Kiểm tra VAPID key
   - Kiểm tra service worker

3. **Performance issues**
   - Debounce price updates
   - Limit notification history
   - Optimize re-renders

### Debug Mode
```tsx
// Enable debug logging
const service = new WebSocketFirebaseService(
  websocketUrl,
  firebaseConfig,
  jwtToken,
  userId
);

// Listen to all events for debugging
service.on('*', (event, data) => {
  console.log('WebSocket event:', event, data);
});
```

## 🎉 **Kết luận**

Service này cung cấp giải pháp complete cho real-time trading với:
- ⚡ Ultra-low latency WebSocket cho trading
- 🔔 Firebase push notifications cho offline
- 🔄 Auto fallback và reconnection
- 📱 Cross-platform support
- 🎯 Type-safe React hooks

Chỉ cần wrap app với Provider và sử dụng hooks trong components! 