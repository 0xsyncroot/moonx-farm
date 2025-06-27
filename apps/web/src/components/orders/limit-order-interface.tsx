'use client'

import { useState, useEffect, useMemo } from 'react'
import { Clock, Target, AlertCircle, TrendingUp, TrendingDown, DollarSign, Zap } from 'lucide-react'
import { TokenSelector } from '@/components/swap/token-selector'
import { TradingViewChart, useChartMarkers } from '@/components/charts/tradingview-chart'
import { cn, formatCurrency } from '@/lib/utils'
import { Token } from '@/hooks/use-tokens'
import { getDCAChartData, PriceDataPoint } from '@/lib/price-data-api'

const ORDER_TYPES = [
  { value: 'limit', label: 'Limit Order', icon: Target },
  { value: 'stop', label: 'Stop Loss', icon: TrendingDown },
  { value: 'take_profit', label: 'Take Profit', icon: TrendingUp }
]

interface LimitChartProps {
  priceData: PriceDataPoint[]
  targetPrice: number
  takeProfitPrice?: number
  stopLossPrice?: number
  currentPrice: number
  isLoading: boolean
  onPriceClick: (price: number) => void
  dataSource: string
}

function LimitChart({ 
  priceData, 
  targetPrice, 
  takeProfitPrice, 
  stopLossPrice, 
  currentPrice, 
  isLoading, 
  onPriceClick,
  dataSource 
}: LimitChartProps) {
  const { markers, addMarker, clearMarkers } = useChartMarkers()

  // Update markers when prices change
  useEffect(() => {
    clearMarkers()
    
    // Add current price marker
    if (currentPrice > 0) {
      addMarker({
        price: currentPrice,
        type: 'current',
        color: '#ff7842',
        label: `Current: $${currentPrice.toFixed(4)}`
      })
    }
    
    // Add target price marker
    if (targetPrice > 0) {
      addMarker({
        price: targetPrice,
        type: 'dca',
        color: '#10b981',
        label: `Target: $${targetPrice.toFixed(4)}`
      })
    }
    
    // Add take profit marker
    if (takeProfitPrice && takeProfitPrice > 0) {
      addMarker({
        price: takeProfitPrice,
        type: 'tp',
        color: '#22c55e',
        label: `TP: $${takeProfitPrice.toFixed(4)}`
      })
    }
    
    // Add stop loss marker
    if (stopLossPrice && stopLossPrice > 0) {
      addMarker({
        price: stopLossPrice,
        type: 'sl',
        color: '#ef4444',
        label: `SL: $${stopLossPrice.toFixed(4)}`
      })
    }
  }, [targetPrice, takeProfitPrice, stopLossPrice, currentPrice, addMarker, clearMarkers])

  return (
    <div className="space-y-4">
      <TradingViewChart
        data={priceData}
        markers={markers}
        height={400}
        title="Price Chart & Order Levels"
        showMarkers={true}
        onPriceClick={onPriceClick}
        loading={isLoading}
        className="w-full"
      />
      
      {/* Data Source and Chart Info */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-2">
          <span className="text-white/60">Click on chart to set price levels</span>
        </div>
        <div className="flex items-center space-x-2">
          {dataSource === 'dexscreener' && (
            <div className="flex items-center space-x-1 bg-green-500/20 border border-green-500/30 rounded-lg px-2 py-1">
              <Zap className="w-3 h-3 text-green-400" />
              <span className="text-xs text-green-400">Real Data</span>
            </div>
          )}
          <span className="text-white/60">Last {priceData.length} candles</span>
        </div>
      </div>

      {/* Price Level Summary */}
      {(targetPrice > 0 || takeProfitPrice || stopLossPrice) && (
        <div className="bg-gray-800/30 rounded-xl p-4 space-y-3">
          <h3 className="font-medium text-white">Order Levels</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {targetPrice > 0 && (
              <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-lg p-2">
                <span className="text-green-400">Target Entry</span>
                <span className="text-white font-medium">${targetPrice.toFixed(4)}</span>
              </div>
            )}
            {takeProfitPrice && takeProfitPrice > 0 && (
              <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
                <span className="text-emerald-400">Take Profit</span>
                <span className="text-white font-medium">${takeProfitPrice.toFixed(4)}</span>
              </div>
            )}
            {stopLossPrice && stopLossPrice > 0 && (
              <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                <span className="text-red-400">Stop Loss</span>
                <span className="text-white font-medium">${stopLossPrice.toFixed(4)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function LimitOrderInterface() {
  const [fromToken, setFromToken] = useState<Token | null>(null)
  const [toToken, setToToken] = useState<Token | null>(null)
  const [fromAmount, setFromAmount] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [takeProfitPrice, setTakeProfitPrice] = useState('')
  const [stopLossPrice, setStopLossPrice] = useState('')
  const [orderType, setOrderType] = useState('limit')
  const [expiryDays, setExpiryDays] = useState('7')
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Price data state
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([])
  const [isLoadingPriceData, setIsLoadingPriceData] = useState(false)
  const [dataSource, setDataSource] = useState<string>('fallback')
  const [currentPrice, setCurrentPrice] = useState(0)

  // Load price data when token changes
  useEffect(() => {
    if (!toToken) return

    const loadPriceData = async () => {
      setIsLoadingPriceData(true)
      try {
        const response = await getDCAChartData(
          toToken.symbol, 
          toToken.address, 
          'daily'
        )
        setPriceData(response.data)
        setDataSource(response.source)
        
        // Set current price from latest data
        if (response.data.length > 0) {
          setCurrentPrice(response.data[response.data.length - 1].close)
        }
      } catch (error) {
        console.error('Failed to load price data:', error)
        setPriceData([])
        setDataSource('fallback')
      } finally {
        setIsLoadingPriceData(false)
      }
    }

    loadPriceData()
  }, [toToken])

  const targetPriceNum = parseFloat(targetPrice)
  const takeProfitNum = parseFloat(takeProfitPrice)
  const stopLossNum = parseFloat(stopLossPrice)
  const priceChange = targetPriceNum && currentPrice ? ((targetPriceNum - currentPrice) / currentPrice) * 100 : 0

  const toAmount = useMemo(() => {
    if (!fromAmount || !targetPrice) return '0.0'
    return (parseFloat(fromAmount) * parseFloat(targetPrice)).toFixed(4)
  }, [fromAmount, targetPrice])

  // Handle chart clicks for setting price levels
  const handleChartPriceClick = (price: number) => {
    if (!targetPrice) {
      setTargetPrice(price.toFixed(4))
    } else if (!takeProfitPrice && price > targetPriceNum) {
      setTakeProfitPrice(price.toFixed(4))
    } else if (!stopLossPrice && price < targetPriceNum) {
      setStopLossPrice(price.toFixed(4))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white">
          Limit Orders & Advanced Trading
        </h1>
        <p className="text-white/60 max-w-2xl mx-auto">
          Set target prices, take profits, and stop losses with advanced charting tools powered by DexScreener data.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Order Configuration */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 space-y-6">
            <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
              <Target className="w-5 h-5 text-orange-500" />
              <span>Order Setup</span>
            </h2>

            {/* Order Type Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Order Type</label>
              <div className="grid grid-cols-1 gap-2">
                {ORDER_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setOrderType(type.value)}
                    className={cn(
                      "flex items-center space-x-2 p-3 rounded-lg border transition-colors",
                      orderType === type.value
                        ? "bg-orange-500/20 border-orange-500/50 text-orange-400"
                        : "bg-gray-800/50 border-gray-700/50 text-white/70 hover:bg-gray-800/70"
                    )}
                  >
                    <type.icon className="w-4 h-4" />
                    <span className="text-sm">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* From Token */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Sell</label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="0.0"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 pr-32 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <TokenSelector
                    isOpen={false}
                    onClose={() => {}}
                    onSelectToken={setFromToken}
                    currentToken={fromToken}
                    title="Select sell token"
                  />
                </div>
              </div>
            </div>

            {/* To Token */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Buy</label>
              <div className="relative">
                <div className="w-full bg-gray-700/30 border border-gray-700/50 rounded-xl px-4 py-3 pr-32 text-white/70 flex items-center">
                  {toAmount}
                </div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <TokenSelector
                    isOpen={false}
                    onClose={() => {}}
                    onSelectToken={setToToken}
                    currentToken={toToken}
                    title="Select buy token"
                  />
                </div>
              </div>
            </div>

            {/* Target Price */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-white/70">Target Price</label>
                {currentPrice > 0 && (
                  <span className="text-xs text-white/60">
                    Current: ${currentPrice.toFixed(4)}
                  </span>
                )}
              </div>
              <input
                type="number"
                placeholder="0.0"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50"
              />
              {targetPriceNum && currentPrice > 0 && (
                <div className={cn(
                  "text-sm font-medium",
                  priceChange > 0 ? "text-green-400" : "text-red-400"
                )}>
                  {priceChange > 0 ? '+' : ''}{priceChange.toFixed(2)}% from current price
                </div>
              )}
            </div>

            {/* Advanced Options Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full text-left text-sm text-orange-400 hover:text-orange-300 transition-colors"
            >
              {showAdvanced ? '↑ Hide' : '↓ Show'} Advanced Options (TP/SL)
            </button>

            {showAdvanced && (
              <div className="space-y-4 border-t border-gray-700/50 pt-4">
                {/* Take Profit */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-green-400">Take Profit Price</label>
                  <input
                    type="number"
                    placeholder="Optional"
                    value={takeProfitPrice}
                    onChange={(e) => setTakeProfitPrice(e.target.value)}
                    className="w-full bg-gray-800/50 border border-green-500/30 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
                  />
                </div>

                {/* Stop Loss */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-red-400">Stop Loss Price</label>
                  <input
                    type="number"
                    placeholder="Optional"
                    value={stopLossPrice}
                    onChange={(e) => setStopLossPrice(e.target.value)}
                    className="w-full bg-gray-800/50 border border-red-500/30 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50"
                  />
                </div>
              </div>
            )}

            {/* Expiry */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Order Expires In</label>
              <select
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50"
              >
                <option value="1">1 Day</option>
                <option value="3">3 Days</option>
                <option value="7">1 Week</option>
                <option value="30">1 Month</option>
                <option value="never">Never</option>
              </select>
            </div>

            {/* Order Summary */}
            {fromToken && toToken && fromAmount && targetPrice && (
              <div className="bg-gray-800/30 rounded-xl p-4 space-y-3">
                <h3 className="font-medium text-white">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/60">Order Type:</span>
                    <span className="text-white font-medium">
                      {priceChange > 0 ? 'Sell High' : 'Buy Low'} Limit
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Execution:</span>
                    <span className="text-white font-medium">
                      When {toToken.symbol} reaches ${targetPriceNum?.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Gas Fee:</span>
                    <span className="text-green-400 font-medium">FREE (Sponsored)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Create Order Button */}
            <button
              disabled={!fromToken || !toToken || !fromAmount || !targetPrice}
              className={cn(
                "w-full flex items-center justify-center space-x-2 py-4 rounded-xl font-medium transition-all",
                !fromToken || !toToken || !fromAmount || !targetPrice
                  ? "bg-gray-700/50 text-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:from-orange-600 hover:to-pink-600 shadow-lg shadow-orange-500/25"
              )}
            >
              <DollarSign className="w-4 h-4" />
              <span>Create Limit Order</span>
            </button>

            {/* Info Note */}
            <div className="flex items-start space-x-2 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-orange-400">
                <p className="font-medium mb-1">Smart Execution:</p>
                <p>Orders execute automatically when conditions are met. Click chart to set price levels quickly.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="lg:col-span-2">
          <LimitChart
            priceData={priceData}
            targetPrice={targetPriceNum || 0}
            takeProfitPrice={takeProfitNum}
            stopLossPrice={stopLossNum}
            currentPrice={currentPrice}
            isLoading={isLoadingPriceData}
            onPriceClick={handleChartPriceClick}
            dataSource={dataSource}
          />
        </div>
      </div>
    </div>
  )
} 