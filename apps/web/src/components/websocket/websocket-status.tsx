'use client'

import { useState, useEffect } from 'react'
import { Wifi, WifiOff, Activity, Clock, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTradingData, useConnectionStatus } from '@/contexts/websocket-firebase-context'

export function WebSocketStatus() {
  const { priceUpdates, orderUpdates } = useTradingData()
  const { isWebSocketConnected, isFirebaseReady, isOnline } = useConnectionStatus()
  
  const [priceUpdateCount, setPriceUpdateCount] = useState(0)
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null)
  
  // Track price updates
  useEffect(() => {
    if (priceUpdates.size > 0) {
      setPriceUpdateCount(prev => prev + 1)
      setLastPriceUpdate(new Date())
    }
  }, [priceUpdates])

  const connectionStatus = isWebSocketConnected ? 'connected' : 'disconnected'
  const statusColor = isWebSocketConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
  const statusBg = isWebSocketConnected ? 'bg-green-50 dark:bg-green-500/10' : 'bg-red-50 dark:bg-red-500/10'
  const statusBorder = isWebSocketConnected ? 'border-green-200 dark:border-green-500/30' : 'border-red-200 dark:border-red-500/30'

  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">WebSocket Status</h3>
        <div className="flex items-center space-x-2">
          {isWebSocketConnected ? (
            <Wifi className={cn("w-4 h-4", statusColor)} />
          ) : (
            <WifiOff className={cn("w-4 h-4", statusColor)} />
          )}
          <span className={cn("text-xs font-medium capitalize", statusColor)}>
            {connectionStatus}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Connection Status */}
        <div className={cn("p-3 rounded-lg border", statusBg, statusBorder)}>
          <div className="flex items-center space-x-2">
            <Activity className={cn("w-4 h-4", statusColor)} />
            <span className="text-xs font-medium text-foreground">Connection</span>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">WebSocket:</span>
              <span className={cn("font-medium", statusColor)}>
                {isWebSocketConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Firebase:</span>
              <span className={cn("font-medium", isFirebaseReady ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400')}>
                {isFirebaseReady ? 'Ready' : 'Loading'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Online:</span>
              <span className={cn("font-medium", isOnline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Data */}
        <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-medium text-foreground">Real-time Data</span>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Price Updates:</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {priceUpdateCount}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Order Updates:</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {orderUpdates.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Last Activity */}
      {lastPriceUpdate && (
        <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
          <div className="flex items-center space-x-2">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Last price update:</span>
          </div>
          <span className="text-xs font-medium text-foreground">
            {lastPriceUpdate.toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Active Symbols */}
      {priceUpdates.size > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Active Symbols:</div>
          <div className="flex flex-wrap gap-1">
            {Array.from(priceUpdates.keys()).map(symbol => (
              <span key={symbol} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-md font-medium">
                {symbol}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 