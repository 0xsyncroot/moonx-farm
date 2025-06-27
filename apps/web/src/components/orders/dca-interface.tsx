'use client'

import { useState, useMemo, useEffect } from 'react'
import { Repeat, Calendar, AlertCircle, ChevronDown, TrendingUp, BarChart3, Info, Play, Clock, Zap } from 'lucide-react'
import { TokenSelector } from '@/components/swap/token-selector'
import { TradingViewChart, useChartMarkers } from '@/components/charts/tradingview-chart'
import { cn, formatCurrency } from '@/lib/utils'
import { Token } from '@/hooks/use-tokens'
import { getDCAChartData, calculateDCASimulation, PriceDataResponse, PriceDataPoint } from '@/lib/price-data-api'

const FREQUENCIES = [
  { label: 'Daily', value: 'daily', seconds: 86400, icon: Calendar },
  { label: 'Weekly', value: 'weekly', seconds: 604800, icon: Calendar },
  { label: 'Bi-weekly', value: 'biweekly', seconds: 1209600, icon: Calendar },
  { label: 'Monthly', value: 'monthly', seconds: 2592000, icon: Calendar },
]

interface TokenButtonProps {
  token: Token | null
  onSelect: (token: Token) => void
  label: string
  placeholder: string
}

function TokenButton({ token, onSelect, label, placeholder }: TokenButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-white/70">{label}</label>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-between bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 hover:bg-gray-800/70 transition-colors"
      >
        {token ? (
          <div className="flex items-center space-x-3">
            {token.logoURI ? (
              <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                {token.symbol.charAt(0)}
              </div>
            )}
            <div className="text-left">
              <div className="font-medium text-white">{token.symbol}</div>
              <div className="text-sm text-white/60">{token.name}</div>
            </div>
          </div>
        ) : (
          <span className="text-white/50">{placeholder}</span>
        )}
        <ChevronDown className="w-5 h-5 text-white/50" />
      </button>
      
      <TokenSelector
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSelectToken={(selectedToken) => {
          onSelect(selectedToken)
          setIsOpen(false)
        }}
        currentToken={token}
        title={`Select ${label}`}
      />
    </div>
  )
}

interface DCAAnalysisProps {
  priceData: PriceDataPoint[]
  frequency: string
  amount: number
  isLoading: boolean
  dataSource: string
}

function DCAAnalysis({ priceData, frequency, amount, isLoading, dataSource }: DCAAnalysisProps) {
  const { markers, addMarker, clearMarkers } = useChartMarkers()
  
  // Calculate DCA simulation
  const simulation = useMemo(() => {
    if (priceData.length === 0 || amount <= 0) {
      return {
        totalInvested: 0,
        currentValue: 0,
        totalReturn: 0,
        returnPercentage: 0,
        averagePrice: 0,
        totalTokens: 0,
        purchaseCount: 0
      }
    }
    return calculateDCASimulation(priceData, amount, frequency as any)
  }, [priceData, frequency, amount])

  // Add DCA purchase markers
  useEffect(() => {
    if (priceData.length === 0) return
    
    clearMarkers()
    
    const frequencyMap = {
      daily: 1,
      weekly: 7,
      biweekly: 14,
      monthly: 30
    } as const
    
    const frequencyDays = frequencyMap[frequency as keyof typeof frequencyMap] || 7
    
    // Add purchase point markers
    for (let i = 0; i < priceData.length; i += frequencyDays) {
      if (i < priceData.length) {
        addMarker({
          price: priceData[i].close,
          type: 'dca',
          color: '#10b981',
          label: `DCA Buy #${Math.floor(i / frequencyDays) + 1}`
        })
      }
    }
    
    // Add average price line marker
    if (simulation.averagePrice > 0) {
      addMarker({
        price: simulation.averagePrice,
        type: 'current',
        color: '#8b5cf6',
        label: `Avg Price: $${simulation.averagePrice.toFixed(4)}`
      })
    }
  }, [priceData, frequency, simulation.averagePrice, addMarker, clearMarkers])

  if (isLoading) {
    return (
      <TradingViewChart
        data={[]}
        loading={true}
        title="DCA Performance Analysis"
        height={400}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* TradingView Chart */}
      <TradingViewChart
        data={priceData}
        markers={markers}
        height={400}
        title="DCA Performance Analysis"
        className="w-full"
      />
      
      {/* Data Source Badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-5 h-5 text-orange-500" />
          <span className="text-lg font-semibold text-white">Analysis Results</span>
        </div>
        {dataSource === 'fallback' && (
          <div className="flex items-center space-x-1 bg-yellow-500/20 border border-yellow-500/30 rounded-lg px-2 py-1">
            <Info className="w-3 h-3 text-yellow-400" />
            <span className="text-xs text-yellow-400">Demo Data</span>
          </div>
        )}
        {dataSource === 'dexscreener' && (
          <div className="flex items-center space-x-1 bg-green-500/20 border border-green-500/30 rounded-lg px-2 py-1">
            <Zap className="w-3 h-3 text-green-400" />
            <span className="text-xs text-green-400">Real Data</span>
          </div>
        )}
      </div>

      {/* DCA Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 rounded-xl p-4">
          <div className="text-sm text-white/60">Total Invested</div>
          <div className="text-xl font-bold text-white">{formatCurrency(simulation.totalInvested)}</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4">
          <div className="text-sm text-white/60">Current Value</div>
          <div className="text-xl font-bold text-white">{formatCurrency(simulation.currentValue)}</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4">
          <div className="text-sm text-white/60">Total Return</div>
          <div className={cn(
            "text-xl font-bold",
            simulation.totalReturn >= 0 ? "text-green-400" : "text-red-400"
          )}>
            {simulation.totalReturn >= 0 ? '+' : ''}{formatCurrency(simulation.totalReturn)}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4">
          <div className="text-sm text-white/60">Return %</div>
          <div className={cn(
            "text-xl font-bold",
            simulation.returnPercentage >= 0 ? "text-green-400" : "text-red-400"
          )}>
            {simulation.returnPercentage >= 0 ? '+' : ''}{simulation.returnPercentage.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* DCA Strategy Info */}
      <div className="bg-gray-800/30 rounded-xl p-4 space-y-3">
        <h3 className="font-medium text-white flex items-center space-x-2">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <span>Strategy Performance</span>
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-white/60">Average Purchase Price:</span>
              <span className="text-white font-medium">${simulation.averagePrice.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Total Tokens Acquired:</span>
              <span className="text-white font-medium">{simulation.totalTokens.toFixed(6)}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-white/60">Purchase Count:</span>
              <span className="text-white font-medium">{simulation.purchaseCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Data Source:</span>
              <span className="text-white font-medium capitalize">{dataSource}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function DCAInterface() {
  const [fromToken, setFromToken] = useState<Token | null>(null)
  const [toToken, setToToken] = useState<Token | null>(null)
  const [amount, setAmount] = useState('100')
  const [frequency, setFrequency] = useState('weekly')
  const [duration, setDuration] = useState('90') // days
  const [isActive, setIsActive] = useState(false)
  
  // Real price data state
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([])
  const [isLoadingPriceData, setIsLoadingPriceData] = useState(false)
  const [dataSource, setDataSource] = useState<string>('fallback')

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

  const totalDCAValue = useMemo(() => {
    if (!amount || !frequency || !duration) return 0
    
    const freq = FREQUENCIES.find(f => f.value === frequency)
    if (!freq) return 0
    
    const totalExecutions = Math.floor((parseInt(duration) * 24 * 60 * 60) / freq.seconds)
    return totalExecutions * parseFloat(amount)
  }, [amount, frequency, duration])

  const estimatedExecutions = useMemo(() => {
    if (!frequency || !duration) return 0
    
    const freq = FREQUENCIES.find(f => f.value === frequency)
    if (!freq) return 0
    
    return Math.floor((parseInt(duration) * 24 * 60 * 60) / freq.seconds)
  }, [frequency, duration])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white">
          Dollar Cost Averaging (DCA)
        </h1>
        <p className="text-white/60 max-w-2xl mx-auto">
          Automate your investment strategy by purchasing tokens at regular intervals, 
          reducing the impact of volatility over time with real DexScreener data.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* DCA Configuration */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 space-y-6">
            <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
              <Repeat className="w-5 h-5 text-orange-500" />
              <span>DCA Setup</span>
            </h2>

            {/* Pay With */}
            <TokenButton
              token={fromToken}
              onSelect={setFromToken}
              label="Pay with"
              placeholder="Select payment token"
            />

            {/* Buy Token */}
            <TokenButton
              token={toToken}
              onSelect={setToToken}
              label="Buy token"
              placeholder="Select token to buy"
            />

            {/* Amount per Purchase */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Amount per purchase</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100"
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60">
                  USD
                </div>
              </div>
            </div>

            {/* Frequency */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Purchase frequency</label>
              <div className="grid grid-cols-2 gap-2">
                {FREQUENCIES.map((freq) => (
                  <button
                    key={freq.value}
                    onClick={() => setFrequency(freq.value)}
                    className={cn(
                      "flex items-center justify-center space-x-2 p-3 rounded-lg border transition-colors",
                      frequency === freq.value
                        ? "bg-orange-500/20 border-orange-500/50 text-orange-400"
                        : "bg-gray-800/50 border-gray-700/50 text-white/70 hover:bg-gray-800/70"
                    )}
                  >
                    <freq.icon className="w-4 h-4" />
                    <span className="text-sm">{freq.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">DCA duration (days)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="90"
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50"
              />
            </div>

            {/* Summary */}
            <div className="bg-gray-800/30 rounded-xl p-4 space-y-3">
              <h3 className="font-medium text-white">DCA Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Total investment:</span>
                  <span className="text-white font-medium">{formatCurrency(totalDCAValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Estimated executions:</span>
                  <span className="text-white font-medium">{estimatedExecutions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Next purchase:</span>
                  <span className="text-white font-medium">
                    {isActive ? 'In 24 hours' : 'Not scheduled'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={() => setIsActive(!isActive)}
              disabled={!fromToken || !toToken || !amount}
              className={cn(
                "w-full flex items-center justify-center space-x-2 py-4 rounded-xl font-medium transition-all",
                !fromToken || !toToken || !amount
                  ? "bg-gray-700/50 text-gray-400 cursor-not-allowed"
                  : isActive
                  ? "bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30"
                  : "bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:from-orange-600 hover:to-pink-600 shadow-lg shadow-orange-500/25"
              )}
            >
              {isActive ? (
                <>
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                  <span>Stop DCA</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Start DCA</span>
                </>
              )}
            </button>

            {isActive && (
              <div className="flex items-center space-x-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <Clock className="w-4 h-4" />
                <span>DCA strategy is active</span>
              </div>
            )}
          </div>
        </div>

        {/* Chart and Analysis */}
        <div className="lg:col-span-2">
          <DCAAnalysis
            priceData={priceData}
            frequency={frequency}
            amount={parseFloat(amount) || 0}
            isLoading={isLoadingPriceData}
            dataSource={dataSource}
          />
        </div>
      </div>
    </div>
  )
} 