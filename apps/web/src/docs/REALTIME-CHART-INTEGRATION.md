# 🔄 Real-time Chart Integration với WebSocket

## 📋 **Tổng quan**

Tài liệu này mô tả cách tích hợp WebSocket để lấy dữ liệu chart price thật cho limit order và DCA interfaces.

## 🏗️ **Kiến trúc hệ thống**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Backend API   │    │ WebSocket       │    │   Frontend      │
│   (Historical)  │    │ (Real-time)     │    │   (Chart)       │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │  Bitquery   │ │    │ │Price Updates│ │    │ │Chart Data   │ │
│ │  DexScreener│ │    │ │OHLCV Stream │ │    │ │Fusion       │ │
│ │  Fallback   │ │    │ │Order Events │ │    │ │Real-time    │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                        ┌─────────────────┐
                        │   Chart UI      │
                        │                 │
                        │ Historical + RT │
                        │ Data Fusion     │
                        └─────────────────┘
```

## 🔧 **Cách hoạt động**

### 1. **Data Loading Strategy**
- **Historical Data**: Load từ API (getDCAChartData) khi component mount
- **Real-time Data**: Stream từ WebSocket khi có kết nối
- **Data Fusion**: Combine historical + real-time để có chart data hoàn chỉnh

### 2. **Real-time Chart Updates**
```typescript
// Logic update trong useEffect
useEffect(() => {
  if (toToken && fromToken) {
    const symbol = `${fromToken.symbol}-${toToken.symbol}`
    const realtimePrice = getPriceForSymbol(symbol)
    
    if (realtimePrice && priceData.length > 0) {
      const currentTime = Date.now()
      const lastCandle = priceData[priceData.length - 1]
      const timeDiff = currentTime - lastCandle.timestamp
      
      if (timeDiff < 300000) { // < 5 phút
        // Update candle hiện tại
        updateLastCandle(realtimePrice)
      } else {
        // Tạo candle mới
        createNewCandle(realtimePrice)
      }
    }
  }
}, [priceUpdates, priceData])
```

### 3. **Data Source Priority**
1. **🟢 websocket-realtime**: Dữ liệu live từ WebSocket (ưu tiên cao nhất)
2. **🔵 bitquery**: Real OHLCV data từ API
3. **🟡 dexscreener**: Current price data từ DEX
4. **🟠 fallback**: Simulated data (development)

## 📱 **Components tích hợp**

### **LimitOrderInterface**
```typescript
// Real-time price updates
const { priceUpdates, getPriceForSymbol } = useTradingData()

// Update chart với real-time data
useEffect(() => {
  const realtimePrice = getPriceForSymbol(symbol)
  if (realtimePrice) {
    updateChartData(realtimePrice)
    setDataSource('websocket-realtime')
  }
}, [priceUpdates])
```

### **DCAInterface**
```typescript
// Tương tự logic cho DCA strategy
const { priceUpdates, getPriceForSymbol } = useTradingData()

// Update DCA visualization với real-time data
useEffect(() => {
  const realtimePrice = getPriceForSymbol(symbol)
  if (realtimePrice) {
    updateDCAChart(realtimePrice)
    setDataSource('websocket-realtime')
  }
}, [priceUpdates])
```

## 🎯 **Data Flow**

### **Price Data Flow**
```
WebSocket Gateway → Firebase Service → Context → Component → Chart
     |                    |              |          |         |
  price_update      PriceUpdate      priceUpdates  useEffect  setPriceData
     |                    |              |          |         |
  OHLCV data        symbol, price    Map<symbol>   fusion    TradingView
```

### **Chart Update Process**
1. **Historical Load**: `getDCAChartData()` → `setPriceData()`
2. **WebSocket Subscribe**: `subscribeToPrice(symbol)`
3. **Real-time Receive**: `price_update` event
4. **Data Fusion**: Combine historical + real-time
5. **Chart Update**: `setPriceData()` với merged data
6. **UI Indicator**: `setDataSource('websocket-realtime')`

## 🔥 **Key Features**

### **1. Smart Candle Management**
- **Update Mode**: < 5 phút → update candle hiện tại
- **New Candle Mode**: > 5 phút → tạo candle mới
- **OHLCV Fusion**: Merge real-time price vào OHLCV data

### **2. Data Source Indicators**
```typescript
// Visual indicators cho user
{dataSource === 'websocket-realtime' && (
  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">
    <Zap className="w-3 h-3 text-emerald-600" />
    <span className="text-xs text-emerald-600">Live WebSocket</span>
  </div>
)}
```

### **3. Connection Status**
- **WebSocket Connection**: Real-time indicator
- **Firebase Ready**: Push notification status
- **Online Status**: Network connectivity

## 🛠️ **Implementation Details**

### **PriceDataPoint Structure**
```typescript
interface PriceDataPoint {
  timestamp: number
  date: string          // ISO date string
  open: number         // Opening price
  high: number         // Highest price
  low: number          // Lowest price
  close: number        // Closing price (real-time updated)
  volume: number       // Trading volume
}
```

### **Real-time Update Logic**
```typescript
const updateChartData = (realtimePrice: PriceUpdate) => {
  const currentTime = Date.now()
  const lastCandle = priceData[priceData.length - 1]
  const timeDiff = currentTime - lastCandle.timestamp
  
  if (timeDiff < 300000) {
    // Update existing candle
    const updatedCandle = {
      ...lastCandle,
      close: realtimePrice.price,
      high: Math.max(lastCandle.high, realtimePrice.price),
      low: Math.min(lastCandle.low, realtimePrice.price),
      volume: realtimePrice.volume || lastCandle.volume
    }
    updateLastCandle(updatedCandle)
  } else {
    // Create new candle
    const newCandle = {
      timestamp: currentTime,
      date: new Date(currentTime).toISOString().split('T')[0],
      open: realtimePrice.price,
      high: realtimePrice.price,
      low: realtimePrice.price,
      close: realtimePrice.price,
      volume: realtimePrice.volume || 0
    }
    addNewCandle(newCandle)
  }
}
```

## 🧪 **Testing & Debugging**

### **WebSocket Status Component**
```typescript
import { WebSocketStatus } from '@/components/websocket/websocket-status'

// Hiển thị trạng thái connection và data flow
<WebSocketStatus />
```

### **Debug Information**
- **Connection Status**: WebSocket, Firebase, Online
- **Data Metrics**: Price updates, Order updates, DCA executions
- **Active Symbols**: Các symbol đang subscribe
- **Last Activity**: Thời gian update cuối cùng

## 🔧 **Configuration**

### **Environment Variables**
```env
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3008
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
```

### **Symbol Format**
```typescript
// Format cho WebSocket subscription
const symbol = `${fromToken.symbol}-${toToken.symbol}`
// Example: "ETH-USDC", "BTC-USDT"
```

## 🚀 **Performance Optimizations**

### **1. Efficient Updates**
- Chỉ update khi có thay đổi thực sự
- Merge real-time data thay vì replace toàn bộ
- Limit số lượng candles (200 candles max)

### **2. Connection Management**
- Auto-reconnect WebSocket
- Graceful fallback khi offline
- Smart subscription management

### **3. Memory Management**
- Cleanup subscriptions khi unmount
- Limit historical data size
- Efficient Map operations cho priceUpdates

## 📊 **Chart Integration**

### **TradingView Integration**
```typescript
<TradingViewChart
  data={priceData}          // Historical + Real-time merged
  markers={markers}         // Price level markers
  onPriceClick={handleClick} // Interactive price setting
  loading={isLoading}       // Loading state
  className="w-full"
/>
```

### **Markers & Indicators**
- **Current Price**: Yellow marker (real-time)
- **Target Price**: Green marker (limit order)
- **Take Profit**: Emerald marker (TP level)
- **Stop Loss**: Red marker (SL level)
- **DCA Points**: Blue markers (DCA executions)

## 🎉 **Result**

### **User Experience**
- ✅ **Real-time price updates** trên chart
- ✅ **Live data indicators** để user biết trạng thái
- ✅ **Smooth transitions** giữa historical và real-time
- ✅ **Connection status** hiển thị rõ ràng
- ✅ **Interactive chart** với price level setting

### **Technical Benefits**
- ✅ **Low latency** price updates (<1s)
- ✅ **Efficient data fusion** between API và WebSocket
- ✅ **Robust error handling** và fallback mechanisms
- ✅ **Scalable architecture** cho multiple symbols
- ✅ **Memory efficient** chart data management

---

**🎯 Kết quả: Trading interfaces với real-time chart data hoàn chỉnh, hiệu suất cao và trải nghiệm người dùng tốt!** 