# Chart Integration với WebSocket Real-time Data

## Tổng quan

Hệ thống chart integration đã được optimize để hiển thị dữ liệu real-time từ WebSocket với performance tối ưu:

- **Limit Order Interface**: `apps/web/src/components/orders/limit-order-interface.tsx`
- **DCA Interface**: `apps/web/src/components/orders/dca-interface.tsx`

## Tính năng chính

### 1. Real-time Price Updates
- WebSocket connection tự động kết nối khi chọn token pairs
- Chart data được update real-time từ WebSocket
- Fallback sang historical data khi WebSocket offline

### 2. Data Source Hierarchy
1. **🟢 Live WebSocket** - Real-time data với độ trễ < 1ms
2. **🔵 Real OHLCV** - Bitquery API data
3. **🟡 Real Data** - DexScreener current price
4. **🟠 Simulated** - Fallback data

### 3. Performance Optimizations
- **Debounced Updates**: Chart updates được debounce 100ms
- **Smart Candle Merging**: Update candle hiện tại nếu < 5 phút, tạo candle mới nếu > 5 phút
- **Memory Management**: Giữ tối đa 200 candles trong memory
- **Optimized Effects**: Reduce unnecessary re-renders

## Cách sử dụng

### 1. Wrap với WebSocket Provider

```tsx
import { WebSocketProviderWrapper } from '@/providers/websocket-provider'

export default function TradingLayout({ children }: { children: React.ReactNode }) {
  return (
    <WebSocketProviderWrapper>
      {children}
    </WebSocketProviderWrapper>
  )
}
```

### 2. Sử dụng Components

```tsx
import { LimitOrderInterface } from '@/components/orders/limit-order-interface'
import { DCAInterface } from '@/components/orders/dca-interface'

// Trong page component
<LimitOrderInterface />
<DCAInterface />
```

### 3. WebSocket Connection Status

Các components tự động hiển thị:
- 🟢 **Real-time** - WebSocket connected
- 🟡 **Offline** - WebSocket disconnected

## Features

### Limit Order Interface
- **Interactive Chart**: Click để set price levels
- **Order Level Markers**: Target, Take Profit, Stop Loss
- **Real-time Notifications**: Order status updates
- **Price Change Indicators**: % change from current price

### DCA Interface  
- **DCA Execution Visualization**: Blue markers show purchase points
- **Strategy Summary**: Total investment, frequency, executions
- **Real-time Execution Updates**: DCA execution notifications
- **Performance Tracking**: ROI, average price, total tokens

## Technical Details

### WebSocket Integration
- Tự động subscribe khi chọn token pairs
- Unsubscribe khi component unmount
- JWT token từ localStorage
- User ID từ auth context

### Chart Data Flow
1. Load historical data từ API
2. Subscribe WebSocket cho token pair
3. Merge real-time data vào chart
4. Update markers và indicators
5. Show notifications cho orders/DCA

### Error Handling
- Fallback data khi API fails
- Retry logic cho WebSocket connection
- Graceful degradation khi offline
- Loading states cho better UX

## Environment Variables Required

```env
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3001
NEXT_PUBLIC_FIREBASE_API_KEY=your_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Kết luận

Hệ thống đã được optimize để cung cấp trải nghiệm trading real-time với:
- Performance cao
- Error handling tốt
- Real-time notifications
- Interactive charts
- Data source indicators

Chỉ cần import và sử dụng components, WebSocket integration sẽ hoạt động tự động! 