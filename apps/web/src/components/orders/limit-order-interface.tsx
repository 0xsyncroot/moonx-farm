'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { Clock, Target, AlertCircle, TrendingUp, TrendingDown, DollarSign, Zap, ChevronDown, Check } from 'lucide-react'
import { TokenSelector } from '@/components/swap/token-selector'
import { TradingViewChart, useChartMarkers } from '@/components/charts/tradingview-chart'
import { cn } from '@/lib/utils'
import { Token } from '@/hooks/use-tokens'
import { getDCAChartData, PriceDataPoint } from '@/lib/price-data-api'

const ORDER_TYPES = [
  { value: 'limit', label: 'Limit Order', icon: Target },
  { value: 'stop', label: 'Stop Loss', icon: TrendingDown },
  { value: 'take_profit', label: 'Take Profit', icon: TrendingUp }
]

const EXPIRY_OPTIONS = [
  { value: '1', label: '1 Day', description: 'Order expires in 24 hours' },
  { value: '3', label: '3 Days', description: 'Order expires in 3 days' },
  { value: '7', label: '1 Week', description: 'Order expires in 7 days' },
  { value: '30', label: '1 Month', description: 'Order expires in 30 days' },
  { value: 'never', label: 'Never', description: 'Order never expires' }
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
    
    if (targetPrice > 0) {
      addMarker({
        price: targetPrice,
        type: 'dca',
        color: '#10b981',
        label: `Target: $${targetPrice.toFixed(4)}`
      })
    }
    
    if (takeProfitPrice && takeProfitPrice > 0) {
      addMarker({
        price: takeProfitPrice,
        type: 'tp',
        color: '#22c55e',
        label: `TP: $${takeProfitPrice.toFixed(4)}`
      })
    }
    
    if (stopLossPrice && stopLossPrice > 0) {
      addMarker({
        price: stopLossPrice,
        type: 'sl',
        color: '#ef4444',
        label: `SL: $${stopLossPrice.toFixed(4)}`
      })
    }
    
    if (currentPrice > 0) {
      addMarker({
        price: currentPrice,
        type: 'current',
        color: '#f59e0b',
        label: `Current: $${currentPrice.toFixed(4)}`
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
          <span className="text-muted-foreground">Click on chart to set price levels</span>
        </div>
        <div className="flex items-center space-x-2">
          {dataSource === 'bitquery' && (
            <div className="flex items-center space-x-1 bg-blue-50 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 rounded-lg px-2 py-1">
              <Zap className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span className="text-xs text-blue-600 dark:text-blue-400">Real OHLCV</span>
            </div>
          )}
          {dataSource === 'dexscreener' && (
            <div className="flex items-center space-x-1 bg-green-50 dark:bg-green-500/20 border border-green-200 dark:border-green-500/30 rounded-lg px-2 py-1">
              <Zap className="w-3 h-3 text-green-600 dark:text-green-400" />
              <span className="text-xs text-green-600 dark:text-green-400">Real Data</span>
            </div>
          )}
          {dataSource === 'fallback' && (
            <div className="flex items-center space-x-1 bg-yellow-50 dark:bg-yellow-500/20 border border-yellow-200 dark:border-yellow-500/30 rounded-lg px-2 py-1">
              <AlertCircle className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
              <span className="text-xs text-yellow-600 dark:text-yellow-400">Simulated</span>
            </div>
          )}
          <span className="text-muted-foreground">Last {priceData.length} candles</span>
        </div>
      </div>

      {/* Price Level Summary */}
      {(targetPrice > 0 || takeProfitPrice || stopLossPrice) && (
        <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-foreground">Order Levels</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {targetPrice > 0 && (
              <div className="flex items-center justify-between bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-lg p-2">
                <span className="text-green-600 dark:text-green-400">Target Entry</span>
                <span className="text-foreground font-medium">${targetPrice.toFixed(4)}</span>
              </div>
            )}
            {takeProfitPrice && takeProfitPrice > 0 && (
              <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg p-2">
                <span className="text-emerald-600 dark:text-emerald-400">Take Profit</span>
                <span className="text-foreground font-medium">${takeProfitPrice.toFixed(4)}</span>
              </div>
            )}
            {stopLossPrice && stopLossPrice > 0 && (
              <div className="flex items-center justify-between bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-2">
                <span className="text-red-600 dark:text-red-400">Stop Loss</span>
                <span className="text-foreground font-medium">${stopLossPrice.toFixed(4)}</span>
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
  const [showExpiryDropdown, setShowExpiryDropdown] = useState(false)
  
  // Token selector states
  const [showFromTokenSelector, setShowFromTokenSelector] = useState(false)
  const [showToTokenSelector, setShowToTokenSelector] = useState(false)
  
  // Price data state
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([])
  const [isLoadingPriceData, setIsLoadingPriceData] = useState(false)
  const [dataSource, setDataSource] = useState<string>('fallback')
  const [currentPrice, setCurrentPrice] = useState(0)

  // Load price data when token changes
  useEffect(() => {
    if (!toToken || !fromToken) return

    const loadPriceData = async () => {
      setIsLoadingPriceData(true)
      try {
        const response = await getDCAChartData(
          `${fromToken.symbol}/${toToken.symbol}`, 
          toToken.address, 
          'daily',
          fromToken,
          toToken
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
  }, [toToken, fromToken])

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

  // Token selection handlers
  const handleFromTokenSelect = (token: Token) => {
    setFromToken(token)
    setShowFromTokenSelector(false)
  }

  const handleToTokenSelect = (token: Token) => {
    setToToken(token)
    setShowToTokenSelector(false)
  }

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Order Configuration */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-6 space-y-6">
            <h2 className="text-xl font-semibold text-foreground flex items-center space-x-2">
              <Target className="w-5 h-5 text-primary" />
              <span>Limit Order Setup</span>
            </h2>

            {/* Order Type Selection */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground/80">Order Type</label>
              <div className="grid grid-cols-1 gap-3">
                {ORDER_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setOrderType(type.value)}
                    className={cn(
                      "flex items-center space-x-3 p-4 rounded-xl border transition-all duration-200 group shadow-sm hover:shadow-md",
                      orderType === type.value
                        ? "bg-primary/10 border-primary/50 text-primary ring-2 ring-primary/20"
                        : "bg-card/50 border-border text-foreground/70 hover:bg-card/80 hover:border-border/80 hover:text-foreground"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg transition-colors",
                      orderType === type.value 
                        ? "bg-primary/20" 
                        : "bg-muted/50 group-hover:bg-muted"
                    )}>
                      <type.icon className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">{type.label}</div>
                      <div className="text-xs opacity-70 mt-0.5">
                        {type.value === 'limit' && 'Execute when target price is reached'}
                        {type.value === 'stop' && 'Sell when price drops below threshold'}
                        {type.value === 'take_profit' && 'Sell when price reaches profit target'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* From Token */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground/80">Sell</label>
              <div className="relative group">
                <input
                  type="number"
                  placeholder="0.0"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  className="w-full pr-36 pl-4 py-4 bg-card/80 hover:bg-card border border-border hover:border-border/80 focus:border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200 text-foreground font-medium placeholder:text-muted-foreground shadow-sm hover:shadow-md focus:shadow-lg"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <button
                    onClick={() => setShowFromTokenSelector(true)}
                    className="flex items-center space-x-2 px-3 py-2 bg-muted/80 hover:bg-muted border border-border hover:border-border/80 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    {fromToken ? (
                      <>
                        {fromToken.logoURI ? (
                          <Image
                            src={fromToken.logoURI}
                            alt={fromToken.symbol}
                            width={20}
                            height={20}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold">
                            {fromToken.symbol.charAt(0)}
                          </div>
                        )}
                        <span className="text-sm font-semibold text-foreground">{fromToken.symbol}</span>
                      </>
                    ) : (
                      <>
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">?</span>
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Select</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              </div>
            </div>

            {/* To Token */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground/80">Buy</label>
              <div className="relative group">
                <div className="w-full pr-36 pl-4 py-4 bg-muted/40 border border-border rounded-xl text-foreground/80 flex items-center font-medium shadow-sm">
                  {toAmount}
                </div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <button
                    onClick={() => setShowToTokenSelector(true)}
                    className="flex items-center space-x-2 px-3 py-2 bg-muted/80 hover:bg-muted border border-border hover:border-border/80 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    {toToken ? (
                      <>
                        {toToken.logoURI ? (
                          <Image
                            src={toToken.logoURI}
                            alt={toToken.symbol}
                            width={20}
                            height={20}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                            {toToken.symbol.charAt(0)}
                          </div>
                        )}
                        <span className="text-sm font-semibold text-foreground">{toToken.symbol}</span>
                      </>
                    ) : (
                      <>
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">?</span>
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Select</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Target Price */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-foreground/80">Target Price</label>
                {currentPrice > 0 && (
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-muted/50 rounded-md">
                    Current: ${currentPrice.toFixed(4)}
                  </span>
                )}
              </div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                  <DollarSign className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                </div>
                <input
                  type="number"
                  placeholder="0.0000"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-card/80 hover:bg-card border border-border hover:border-border/80 focus:border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200 text-foreground font-medium placeholder:text-muted-foreground shadow-sm hover:shadow-md focus:shadow-lg"
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              </div>
              {targetPriceNum && currentPrice > 0 && (
                <div className={cn(
                  "text-sm font-semibold px-3 py-2 rounded-lg border",
                  priceChange > 0 
                    ? "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20" 
                    : "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"
                )}>
                  {priceChange > 0 ? '+' : ''}{priceChange.toFixed(2)}% from current price
                </div>
              )}
            </div>

            {/* Advanced Options Toggle */}
            <div className="pt-2">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 border border-primary/20 hover:border-primary/30 rounded-xl transition-all duration-200 group"
              >
                <span className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Advanced Options (TP/SL)
                </span>
                <ChevronDown className={cn(
                  "w-4 h-4 transition-transform duration-200",
                  showAdvanced && "rotate-180"
                )} />
              </button>
            </div>

            {showAdvanced && (
              <div className="space-y-6 border-t border-border pt-6">
                {/* Take Profit */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Take Profit Price
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                      <DollarSign className="w-4 h-4 text-green-600/60 dark:text-green-400/60 group-focus-within:text-green-600 dark:group-focus-within:text-green-400 transition-colors" />
                    </div>
                    <input
                      type="number"
                      placeholder="Optional"
                      value={takeProfitPrice}
                      onChange={(e) => setTakeProfitPrice(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-green-50/50 dark:bg-green-500/5 hover:bg-green-50 dark:hover:bg-green-500/10 border border-green-200 dark:border-green-500/30 hover:border-green-300 dark:hover:border-green-500/50 focus:border-green-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-all duration-200 text-foreground font-medium placeholder:text-green-600/50 dark:placeholder:text-green-400/50 shadow-sm hover:shadow-md focus:shadow-lg"
                    />
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                  </div>
                  <div className="text-xs text-green-600/70 dark:text-green-400/70">
                    Automatically sell when price reaches this level
                  </div>
                </div>

                {/* Stop Loss */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" />
                    Stop Loss Price
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                      <DollarSign className="w-4 h-4 text-red-600/60 dark:text-red-400/60 group-focus-within:text-red-600 dark:group-focus-within:text-red-400 transition-colors" />
                    </div>
                    <input
                      type="number"
                      placeholder="Optional"
                      value={stopLossPrice}
                      onChange={(e) => setStopLossPrice(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-red-50/50 dark:bg-red-500/5 hover:bg-red-50 dark:hover:bg-red-500/10 border border-red-200 dark:border-red-500/30 hover:border-red-300 dark:hover:border-red-500/50 focus:border-red-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all duration-200 text-foreground font-medium placeholder:text-red-600/50 dark:placeholder:text-red-400/50 shadow-sm hover:shadow-md focus:shadow-lg"
                    />
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                  </div>
                  <div className="text-xs text-red-600/70 dark:text-red-400/70">
                    Automatically sell when price drops to this level
                  </div>
                </div>
              </div>
            )}

            {/* Expiry */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground/80">Order Expires In</label>
              <div className="relative">
                <button
                  onClick={() => setShowExpiryDropdown(!showExpiryDropdown)}
                  className="w-full flex items-center justify-between px-4 py-4 bg-card/80 hover:bg-card border border-border hover:border-border/80 focus:border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200 text-foreground font-medium shadow-sm hover:shadow-md focus:shadow-lg group"
                >
                  <div className="flex items-center space-x-3">
                    <Clock className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span>
                      {EXPIRY_OPTIONS.find(opt => opt.value === expiryDays)?.label || '1 Week'}
                    </span>
                  </div>
                  <ChevronDown className={cn(
                    "w-4 h-4 text-muted-foreground group-hover:text-primary transition-all duration-200",
                    showExpiryDropdown && "rotate-180"
                  )} />
                </button>

                {/* Custom Dropdown */}
                {showExpiryDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowExpiryDropdown(false)}
                    />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-20 overflow-hidden">
                      {EXPIRY_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setExpiryDays(option.value)
                            setShowExpiryDropdown(false)
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-b-0",
                            expiryDays === option.value && "bg-primary/10 text-primary"
                          )}
                        >
                          <div>
                            <div className="font-medium text-foreground">{option.label}</div>
                            <div className="text-xs text-muted-foreground">{option.description}</div>
                          </div>
                          {expiryDays === option.value && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Order will be automatically cancelled after this period
              </div>
            </div>

            {/* Order Summary */}
            {fromToken && toToken && fromAmount && targetPrice && (
              <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-foreground">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order Type:</span>
                    <span className="text-foreground font-medium">
                      {priceChange > 0 ? 'Sell High' : 'Buy Low'} Limit
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Execution:</span>
                    <span className="text-foreground font-medium">
                      When {toToken.symbol} reaches ${targetPriceNum?.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gas Fee:</span>
                    <span className="text-green-600 dark:text-green-400 font-medium">FREE (Sponsored)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Create Order Button */}
            <button
              disabled={!fromToken || !toToken || !fromAmount || !targetPrice}
              className={cn(
                "w-full flex items-center justify-center space-x-2 py-4 px-6 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-none",
                (!fromToken || !toToken || !fromAmount || !targetPrice) && "opacity-50 cursor-not-allowed"
              )}
            >
              <DollarSign className="w-5 h-5" />
              <span>Create Limit Order</span>
            </button>

            {/* Info Note */}
            <div className="flex items-start space-x-3 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-orange-700 dark:text-orange-400">
                <p className="font-semibold mb-1">Smart Execution:</p>
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

      {/* Token Selectors */}
      <TokenSelector
        isOpen={showFromTokenSelector}
        onClose={() => setShowFromTokenSelector(false)}
        onSelectToken={handleFromTokenSelect}
        currentToken={fromToken}
        title="Select sell token"
      />

      <TokenSelector
        isOpen={showToTokenSelector}
        onClose={() => setShowToTokenSelector(false)}
        onSelectToken={handleToTokenSelect}
        currentToken={toToken}
        title="Select buy token"
      />
    </div>
  )
} 