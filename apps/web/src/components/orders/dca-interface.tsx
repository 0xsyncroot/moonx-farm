'use client'

import { useState, useEffect, useMemo } from 'react'
import { Repeat, Clock, Calendar, TrendingUp, AlertCircle, DollarSign, BarChart3, ChevronDown } from 'lucide-react'
import { TokenSelector } from '@/components/swap/token-selector'
import { TradingViewChart, useChartMarkers } from '@/components/charts/tradingview-chart'
import { cn, formatCurrency } from '@/lib/utils'
import { Token } from '@/hooks/use-tokens'
import { getDCAChartData, PriceDataPoint } from '@/lib/price-data-api'

const DCA_FREQUENCIES = [
  { value: 'hourly', label: 'Every Hour', duration: 1 * 60 * 60 * 1000 },
  { value: 'daily', label: 'Daily', duration: 24 * 60 * 60 * 1000 },
  { value: 'weekly', label: 'Weekly', duration: 7 * 24 * 60 * 60 * 1000 },
  { value: 'monthly', label: 'Monthly', duration: 30 * 24 * 60 * 60 * 1000 }
]

interface DCAChartProps {
  priceData: PriceDataPoint[]
  projectedInvestment: number
  frequency: string
  duration: number
  isLoading: boolean
  dataSource: string
}

function DCAChart({ priceData, projectedInvestment, frequency, duration, isLoading, dataSource }: DCAChartProps) {
  const { markers, addMarker, clearMarkers } = useChartMarkers()

  // Simulate DCA execution points
  useEffect(() => {
    clearMarkers()
    
    if (priceData.length === 0 || projectedInvestment <= 0) return

    const frequencyDuration = DCA_FREQUENCIES.find(f => f.value === frequency)?.duration || DCA_FREQUENCIES[1].duration
    const totalExecutions = Math.floor(duration / frequencyDuration)
    const executionInterval = Math.floor(priceData.length / Math.max(totalExecutions, 1))

    // Add DCA execution markers
    for (let i = 0; i < Math.min(totalExecutions, 8); i++) {
      const dataPoint = priceData[i * executionInterval]
      if (dataPoint) {
        addMarker({
          price: dataPoint.close,
          type: 'dca',
          color: '#3b82f6',
          label: `DCA Buy #${i + 1}: $${dataPoint.close.toFixed(4)}`
        })
      }
    }

    // Add current price marker
    if (priceData.length > 0) {
      const currentPrice = priceData[priceData.length - 1].close
      addMarker({
        price: currentPrice,
        type: 'current',
        color: '#f59e0b',
        label: `Current: $${currentPrice.toFixed(4)}`
      })
    }
  }, [priceData, projectedInvestment, frequency, duration, addMarker, clearMarkers])

  return (
    <div className="space-y-4">
      <TradingViewChart
        data={priceData}
        markers={markers}
        height={400}
        title="DCA Strategy Visualization"
        showMarkers={true}
        loading={isLoading}
        className="w-full"
      />
      
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-2">
          <span className="text-muted-foreground">Blue markers show DCA purchase points</span>
        </div>
        <div className="flex items-center space-x-2">
          {dataSource === 'bitquery' && (
            <div className="flex items-center space-x-1 bg-blue-50 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 rounded-lg px-2 py-1">
              <TrendingUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span className="text-xs text-blue-600 dark:text-blue-400">Real OHLCV</span>
            </div>
          )}
          {dataSource === 'dexscreener' && (
            <div className="flex items-center space-x-1 bg-green-50 dark:bg-green-500/20 border border-green-200 dark:border-green-500/30 rounded-lg px-2 py-1">
              <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />
              <span className="text-xs text-green-600 dark:text-green-400">Real Data</span>
            </div>
          )}
          {dataSource === 'fallback' && (
            <div className="flex items-center space-x-1 bg-yellow-50 dark:bg-yellow-500/20 border border-yellow-200 dark:border-yellow-500/30 rounded-lg px-2 py-1">
              <AlertCircle className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
              <span className="text-xs text-yellow-600 dark:text-yellow-400">Simulated</span>
            </div>
          )}
          <span className="text-muted-foreground">Historical simulation</span>
        </div>
      </div>
    </div>
  )
}

export function DCAInterface() {
  const [buyToken, setBuyToken] = useState<Token | null>(null)
  const [sellToken, setSellToken] = useState<Token | null>(null)
  const [investmentAmount, setInvestmentAmount] = useState('')
  const [frequency, setFrequency] = useState('daily')
  const [totalDuration, setTotalDuration] = useState('30') // days
  const [maxSlippage, setMaxSlippage] = useState('1.0')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Token selector states
  const [showSellTokenSelector, setShowSellTokenSelector] = useState(false)
  const [showBuyTokenSelector, setShowBuyTokenSelector] = useState(false)
  
  // Price data state
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([])
  const [isLoadingPriceData, setIsLoadingPriceData] = useState(false)
  const [dataSource, setDataSource] = useState<string>('fallback')
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)

  // Load price data when token changes
  useEffect(() => {
    if (!buyToken || !sellToken) return

    const loadPriceData = async () => {
      setIsLoadingPriceData(true)
      try {
        const response = await getDCAChartData(
          `${buyToken.symbol}/${sellToken.symbol}`, 
          buyToken.address, 
          'daily',
          buyToken,
          sellToken
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
  }, [buyToken, sellToken])

  const investmentAmountNum = parseFloat(investmentAmount) || 0
  const totalDurationNum = parseFloat(totalDuration) || 1
  const durationMs = totalDurationNum * 24 * 60 * 60 * 1000

  const frequencyConfig = DCA_FREQUENCIES.find(f => f.value === frequency) || DCA_FREQUENCIES[1]
  const totalExecutions = Math.floor(durationMs / frequencyConfig.duration)
  const amountPerExecution = investmentAmountNum / Math.max(totalExecutions, 1)

  const dcaStats = {
    totalInvestment: investmentAmountNum,
    executionCount: totalExecutions,
    amountPerExecution: amountPerExecution,
    totalDays: totalDurationNum,
    frequency: frequencyConfig.label
  }

  // Token selection handlers
  const handleSellTokenSelect = (token: Token) => {
    setSellToken(token)
    setShowSellTokenSelector(false)
  }

  const handleBuyTokenSelect = (token: Token) => {
    setBuyToken(token)
    setShowBuyTokenSelector(false)
  }

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-6">
        {/* DCA Configuration */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-6 space-y-6">
            <h2 className="text-xl font-semibold text-foreground flex items-center space-x-2">
              <Repeat className="w-5 h-5 text-primary" />
              <span>DCA Strategy</span>
            </h2>

            {/* Sell Token */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/70">Pay With</label>
              <div className="relative">
                <button
                  onClick={() => setShowSellTokenSelector(true)}
                  className="w-full flex items-center justify-between p-4 bg-card/50 hover:bg-card/80 border border-border rounded-xl transition-all duration-200 group"
                >
                  {sellToken ? (
                    <div className="flex items-center space-x-3">
                      {sellToken.logoURI ? (
                        <img src={sellToken.logoURI} alt={sellToken.symbol} className="w-10 h-10 rounded-full ring-2 ring-border" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg">
                          {sellToken.symbol.charAt(0)}
                        </div>
                      )}
                      <div className="text-left">
                        <div className="font-semibold text-foreground">{sellToken.symbol}</div>
                        <div className="text-sm text-muted-foreground">{sellToken.name}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <span className="text-muted-foreground font-medium">Select payment token</span>
                    </div>
                  )}
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </button>
              </div>
            </div>

            {/* Buy Token */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/70">Buy Token</label>
              <div className="relative">
                <button
                  onClick={() => setShowBuyTokenSelector(true)}
                  className="w-full flex items-center justify-between p-4 bg-card/50 hover:bg-card/80 border border-border rounded-xl transition-all duration-200 group"
                >
                  {buyToken ? (
                    <div className="flex items-center space-x-3">
                      {buyToken.logoURI ? (
                        <img src={buyToken.logoURI} alt={buyToken.symbol} className="w-10 h-10 rounded-full ring-2 ring-border" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                          {buyToken.symbol.charAt(0)}
                        </div>
                      )}
                      <div className="text-left">
                        <div className="font-semibold text-foreground">{buyToken.symbol}</div>
                        <div className="text-sm text-muted-foreground">{buyToken.name}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <span className="text-muted-foreground font-medium">Select token to buy</span>
                    </div>
                  )}
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </button>
              </div>
            </div>

            {/* Investment Amount */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/70">Total Investment Amount</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="number"
                  placeholder="1000"
                  value={investmentAmount}
                  onChange={(e) => setInvestmentAmount(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-card/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                This amount will be split across all DCA executions
              </div>
            </div>

            {/* Frequency */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/70">Purchase Frequency</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-card/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 text-foreground appearance-none cursor-pointer"
                >
                  {DCA_FREQUENCIES.map((freq) => (
                    <option key={freq.value} value={freq.value}>
                      {freq.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/70">Strategy Duration (Days)</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="number"
                  placeholder="30"
                  value={totalDuration}
                  onChange={(e) => setTotalDuration(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-card/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Advanced Options Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full text-left text-sm text-primary hover:text-primary/80 transition-colors"
            >
              {showAdvanced ? '↑ Hide' : '↓ Show'} Advanced Options
            </button>

            {showAdvanced && (
              <div className="space-y-4 border-t border-border pt-4">
                {/* Max Slippage */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/70">Max Slippage (%)</label>
                  <input
                    type="number"
                    placeholder="1.0"
                    value={maxSlippage}
                    onChange={(e) => setMaxSlippage(e.target.value)}
                    className="w-full px-4 py-3 bg-card/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                {/* Price Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-green-600 dark:text-green-400">Min Price</label>
                    <input
                      type="number"
                      placeholder="Optional"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className="w-full px-4 py-3 bg-card/50 border border-green-200 dark:border-green-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all duration-200 text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-red-600 dark:text-red-400">Max Price</label>
                    <input
                      type="number"
                      placeholder="Optional"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="w-full px-4 py-3 bg-card/50 border border-red-200 dark:border-red-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all duration-200 text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* DCA Summary */}
            {investmentAmount && (
              <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Strategy Summary
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Investment:</span>
                    <span className="text-foreground font-semibold">
                      {formatCurrency(dcaStats.totalInvestment)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Frequency:</span>
                    <span className="text-foreground font-medium">{dcaStats.frequency}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Executions:</span>
                    <span className="text-foreground font-medium">{dcaStats.executionCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Amount per execution:</span>
                    <span className="text-foreground font-semibold">
                      {formatCurrency(dcaStats.amountPerExecution)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="text-foreground font-medium">{dcaStats.totalDays} days</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-muted-foreground">Gas Fee:</span>
                    <span className="text-green-600 dark:text-green-400 font-semibold">FREE (Sponsored)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Create DCA Button */}
            <button
              disabled={!sellToken || !buyToken || !investmentAmount}
              className={cn(
                "w-full flex items-center justify-center space-x-2 py-4 px-6 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-none",
                (!sellToken || !buyToken || !investmentAmount) && "opacity-50 cursor-not-allowed"
              )}
            >
              <Repeat className="w-5 h-5" />
              <span>Start DCA Strategy</span>
            </button>

            {/* Info Note */}
            <div className="flex items-start space-x-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700 dark:text-blue-400">
                <p className="font-semibold mb-1">Smart DCA:</p>
                <p>Strategy executes automatically at your chosen frequency. You can pause or modify anytime.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="lg:col-span-2">
          <DCAChart
            priceData={priceData}
            projectedInvestment={investmentAmountNum}
            frequency={frequency}
            duration={durationMs}
            isLoading={isLoadingPriceData}
            dataSource={dataSource}
          />
        </div>
      </div>

      {/* Token Selectors */}
      <TokenSelector
        isOpen={showSellTokenSelector}
        onClose={() => setShowSellTokenSelector(false)}
        onSelectToken={handleSellTokenSelect}
        currentToken={sellToken}
        title="Select payment token"
      />

      <TokenSelector
        isOpen={showBuyTokenSelector}
        onClose={() => setShowBuyTokenSelector(false)}
        onSelectToken={handleBuyTokenSelect}
        currentToken={buyToken}
        title="Select token to buy"
      />
    </div>
  )
} 