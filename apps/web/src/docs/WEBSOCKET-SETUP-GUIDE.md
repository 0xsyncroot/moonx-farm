# 🚀 WebSocket Integration Setup Guide

## 📋 **Overview**

This guide helps you integrate WebSocket real-time functionality into your trading application.

## 🔧 **Step 1: Environment Configuration**

Create `.env.local` file with these variables:

```env
# WebSocket Gateway URL
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3008

# Firebase Configuration for Push Notifications
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123def456
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Firebase Cloud Messaging VAPID Key (for web push notifications)
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your-vapid-key
```

## 🏗️ **Step 2: Provider Setup**

### Option A: Layout-level Integration (Recommended)

Wrap your trading pages with WebSocket provider:

```tsx
// app/trading/layout.tsx
import { WebSocketProviderWrapper } from '@/providers/websocket-provider';

export default function TradingLayout({ children }: { children: React.ReactNode }) {
  return (
    <WebSocketProviderWrapper enabled={true}>
      {children}
    </WebSocketProviderWrapper>
  );
}
```

**Note**: `WebSocketProviderWrapper` automatically:
- Gets JWT token from `localStorage.getItem('accessToken')`
- Gets user ID from `useAuth()` hook
- Only initializes when user is authenticated

### Option B: App-level Integration

Wrap your entire app (if you want WebSocket everywhere):

```tsx
// app/layout.tsx
import { WebSocketProviderWrapper } from '@/providers/websocket-provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <AuthProvider> {/* Your auth provider */}
          <WebSocketProviderWrapper enabled={true}>
            {children}
          </WebSocketProviderWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
```

## 🎯 **Step 3: Component Usage**

Now your components can use WebSocket hooks safely:

```tsx
// components/orders/limit-order-interface.tsx
import { useTradingData, useConnectionStatus } from '@/contexts/websocket-firebase-context';

export function LimitOrderInterface() {
  const { 
    priceUpdates, 
    orderUpdates, 
    subscribeToPrice,
    subscribeToOrderUpdates 
  } = useTradingData();
  
  const { isWebSocketConnected } = useConnectionStatus();

  // Use the hooks safely - they'll return defaults if no provider
  return (
    <div>
      {isWebSocketConnected ? 'Connected' : 'Offline'}
      {/* Your component JSX */}
    </div>
  );
}
```

## 🔧 **Step 4: Development Mode**

WebSocket will automatically work when user is authenticated. For development:

```tsx
// app/trading/layout.tsx (All Environments)
export default function TradingLayout({ children }: { children: React.ReactNode }) {
  return (
    <WebSocketProviderWrapper enabled={true}>
      {children}
    </WebSocketProviderWrapper>
  );
}
```

**Development Requirements:**
- User must be logged in (Privy + Backend auth)
- JWT token must be in localStorage
- Backend WebSocket Gateway must be running on port 3008

## 🚨 **Troubleshooting**

### Error: "useWebSocketFirebaseContext must be used within a WebSocketFirebaseProvider"

**Solution**: Wrap your component/page with `WebSocketProviderWrapper`

```tsx
// ❌ Wrong - No Provider
function MyTradingPage() {
  const { priceUpdates } = useTradingData(); // Error!
  return <div>...</div>;
}

// ✅ Correct - With Provider
function MyTradingPage() {
  return (
    <WebSocketProviderWrapper enabled={true}>
      <TradingComponent />
    </WebSocketProviderWrapper>
  );
}
```

**Common Causes:**
- User not logged in (no JWT token in localStorage)
- Auth system not initialized
- WebSocketProviderWrapper not added to layout

### WebSocket Not Connecting

1. **Check Environment Variables**:
   ```bash
   echo $NEXT_PUBLIC_WEBSOCKET_URL
   ```

2. **Verify WebSocket Gateway is Running**:
   ```bash
   curl http://localhost:3008/health
   ```

3. **Check Authentication & JWT Token Status**:
   ```tsx
   import { JWTTokenDebug } from '@/components/debug/jwt-token-debug';
   import { WebSocketStatus } from '@/components/websocket/websocket-status';
   import { useWebSocketStatus } from '@/providers/websocket-provider';
   
   function DebugPage() {
     const { isConfigured, hasFirebaseConfig, hasWebSocketUrl } = useWebSocketStatus();
     
     return (
       <div className="space-y-6">
         {/* JWT & Auth Debug */}
         <JWTTokenDebug />
         
         {/* WebSocket Status */}
         <WebSocketStatus />
         
         {/* Configuration Status */}
         <div className="p-4 border rounded-lg">
           <p>WebSocket URL: {hasWebSocketUrl ? '✅' : '❌'}</p>
           <p>Firebase Config: {hasFirebaseConfig ? '✅' : '❌'}</p>
           <p>Fully Configured: {isConfigured ? '✅' : '❌'}</p>
         </div>
       </div>
     );
   }
   ```

## 🎛️ **Configuration Options**

### WebSocketProviderWrapper Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `enabled` | `boolean` | ❌ | Enable/disable WebSocket connection (default: true) |
| `children` | `ReactNode` | ✅ | Child components |

**Automatic Data Sources:**
- `jwtToken`: Automatically loaded from `localStorage.getItem('accessToken')`
- `userId`: Automatically loaded from `useAuth()` hook (`backendUser.id`)
- Authentication status checked via `isAuthenticated` from `useAuth()`

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_WEBSOCKET_URL` | ✅ | WebSocket Gateway URL |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | ✅ | Firebase project API key |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ✅ | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | ✅ | Firebase VAPID key for web push |

## 🔄 **Integration Checklist**

- [ ] Environment variables configured
- [ ] WebSocket Gateway running and accessible
- [ ] Firebase project setup with FCM enabled
- [ ] Provider wrapper added to layout/page
- [ ] Auth data (userId, jwtToken) available
- [ ] Components using hooks properly
- [ ] Real-time updates working
- [ ] Push notifications enabled

## 📚 **Related Documentation**

- [WebSocket Gateway Client Integration](./WEBSOCKET-FIREBASE-INTEGRATION-GUIDE.md)
- [Firebase Push Notification Setup](./FIREBASE-SETUP.md)
- [Trading Components Usage](./TRADING-COMPONENTS.md)

---

**🎉 Ready to trade with real-time updates!** 