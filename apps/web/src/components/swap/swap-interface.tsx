'use client'

import { useState, useMemo } from 'react'
import { ArrowUpDown, RefreshCw, AlertTriangle, Settings, Zap, ExternalLink } from 'lucide-react'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import Image from 'next/image'
import { TokenSelector } from './token-selector'
import { SwapButton } from './swap-button'
import { SwapSettings } from './swap-settings'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import { useQuote } from '@/hooks/use-quote'
import { useAuth } from '@/hooks/use-auth'
import { Token } from '@/hooks/use-tokens'

// Chain configurations for cross-chain support
const SUPPORTED_CHAINS = {
  1: { name: 'Ethereum', icon: '⟠', color: 'bg-blue-500' },
  8453: { name: 'Base', icon: '🔵', color: 'bg-blue-600' },
  56: { name: 'BSC', icon: '🟡', color: 'bg-yellow-500' },
}

export function SwapInterface() {
  const { client: smartWalletClient } = useSmartWallets()
  const { walletInfo } = useAuth()
  
  const [showFromTokenSelector, setShowFromTokenSelector] = useState(false)
  const [showToTokenSelector, setShowToTokenSelector] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const {
    fromToken,
    toToken,
    amount,
    slippage,
    quote,
    isLoading,
    error,
    isValidRequest,
    exchangeRate,
    priceImpactColor,
    priceImpactSeverity,
    timeUntilExpiry,
    setFromToken,
    setToToken,
    setAmount,
    setSlippage,
    swapTokens,
    refetch,
  } = useQuote()

  // Check if this is a cross-chain swap
  const isCrossChain = fromToken && toToken && fromToken.chainId !== toToken.chainId

  // Get chain info
  const fromChain = fromToken ? SUPPORTED_CHAINS[fromToken.chainId as keyof typeof SUPPORTED_CHAINS] : null
  const toChain = toToken ? SUPPORTED_CHAINS[toToken.chainId as keyof typeof SUPPORTED_CHAINS] : null

  // Calculate minimum received after slippage
  const minReceived = quote ? quote.toAmountMin : 0

  // Format expiry countdown
  const formatTimeUntilExpiry = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    return `${seconds}s`
  }

  const handleRefresh = () => {
    refetch()
  }

  // Default chain ID (ensure it's a number)
  const defaultChainId = useMemo(() => {
    const chainId = walletInfo?.chainId
    if (typeof chainId === 'number') return chainId
    if (typeof chainId === 'string') return parseInt(chainId, 10)
    return 1 // Default to Ethereum
  }, [walletInfo?.chainId])

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Main Swap Card */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 via-gray-800/90 to-gray-900/90 backdrop-blur-xl" />
        <div 
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        />
        
        <div className="relative border border-white/10 rounded-2xl p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">Swap</h2>
              {isCrossChain && (
                <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-[#ff7842]/20 to-purple-500/20 border border-[#ff7842]/30 rounded-full">
                  <Zap className="w-3 h-3 text-[#ff7842]" />
                  <span className="text-xs font-medium text-[#ff7842]">Cross-Chain</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 
                         rounded-lg transition-colors"
                title="Swap Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={handleRefresh}
                disabled={isLoading || !isValidRequest}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 
                         rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh Quote"
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              </button>
            </div>
          </div>

          {/* Cross-Chain Bridge Info */}
          {isCrossChain && fromChain && toChain && (
            <div className="flex items-center justify-center py-2">
              <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
                <div className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full", fromChain.color)} />
                  <span className="text-sm text-gray-300">{fromChain.name}</span>
                </div>
                <ArrowUpDown className="w-3 h-3 text-gray-500" />
                <div className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full", toChain.color)} />
                  <span className="text-sm text-gray-300">{toChain.name}</span>
                </div>
              </div>
            </div>
          )}

          {/* From Token */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">From</span>
              {smartWalletClient?.account?.address && fromToken && (
                <button className="text-gray-400 hover:text-white transition-colors">
                  Balance: {formatNumber(0)} {fromToken.symbol}
                </button>
              )}
            </div>
            
            <div className="relative group">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors">
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="text-2xl font-bold bg-transparent border-0 outline-none 
                             text-white placeholder-gray-500 flex-1 min-w-0"
                  />
                  
                  {/* Token Selector Button */}
                  <button
                    onClick={() => setShowFromTokenSelector(true)}
                    className="flex items-center gap-2 px-3 py-2 ml-3
                             bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg
                             transition-colors group-hover:border-white/20"
                  >
                    {fromToken ? (
                      <>
                        {fromToken.logoURI && (
                          <Image 
                            src={fromToken.logoURI} 
                            alt={fromToken.symbol}
                            width={24}
                            height={24}
                            className="w-6 h-6 rounded-full"
                          />
                        )}
                        <span className="font-semibold text-white">{fromToken.symbol}</span>
                        {fromChain && (
                          <div className={cn("w-2 h-2 rounded-full", fromChain.color)} />
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">Select token</span>
                    )}
                    <span className="text-gray-500">▼</span>
                  </button>
                </div>

                {/* USD Value */}
                {fromToken?.priceUSD && amount && (
                  <p className="text-sm text-gray-400 mt-2">
                    ≈ {formatCurrency(parseFloat(amount) * fromToken.priceUSD)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Swap Arrow with Animation */}
          <div className="flex justify-center py-2">
            <button
              onClick={swapTokens}
              disabled={!fromToken || !toToken}
              className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl
                       transition-all duration-200 hover:scale-110 hover:border-white/20
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                       group"
            >
              <ArrowUpDown className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
            </button>
          </div>

          {/* To Token */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">To</span>
              {smartWalletClient?.account?.address && toToken && (
                <button className="text-gray-400 hover:text-white transition-colors">
                  Balance: {formatNumber(0)} {toToken.symbol}
                </button>
              )}
            </div>
            
            <div className="relative group">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors">
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    placeholder="0.00"
                    value={quote?.toAmount ? formatNumber(quote.toAmount) : ''}
                    readOnly
                    className="text-2xl font-bold bg-transparent border-0 outline-none 
                             text-white placeholder-gray-500 flex-1 min-w-0"
                  />
                  
                  {/* Token Selector Button */}
                  <button
                    onClick={() => setShowToTokenSelector(true)}
                    className="flex items-center gap-2 px-3 py-2 ml-3
                             bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg
                             transition-colors group-hover:border-white/20"
                  >
                    {toToken ? (
                      <>
                        {toToken.logoURI && (
                          <Image 
                            src={toToken.logoURI} 
                            alt={toToken.symbol}
                            width={24}
                            height={24}
                            className="w-6 h-6 rounded-full"
                          />
                        )}
                        <span className="font-semibold text-white">{toToken.symbol}</span>
                        {toChain && (
                          <div className={cn("w-2 h-2 rounded-full", toChain.color)} />
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">Select token</span>
                    )}
                    <span className="text-gray-500">▼</span>
                  </button>
                </div>

                {/* USD Value */}
                {toToken?.priceUSD && quote?.toAmount && (
                  <p className="text-sm text-gray-400 mt-2">
                    ≈ {formatCurrency(quote.toAmount * toToken.priceUSD)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Quote Details */}
          {quote && isValidRequest && (
            <div className="space-y-3 pt-4 border-t border-white/10">
              {/* Exchange Rate */}
              {exchangeRate && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Rate</span>
                  <span className="text-white font-medium">{exchangeRate}</span>
                </div>
              )}

              {/* Price Impact */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Price Impact</span>
                <div className="flex items-center gap-1">
                  <span className={priceImpactColor || 'text-white'}>
                    {quote.priceImpact.toFixed(2)}%
                  </span>
                  {priceImpactSeverity === 'high' && (
                    <AlertTriangle className="w-3 h-3 text-orange-500" />
                  )}
                  {priceImpactSeverity === 'critical' && (
                    <AlertTriangle className="w-3 h-3 text-red-500" />
                  )}
                </div>
              </div>

              {/* Cross-chain Bridge Time */}
              {isCrossChain && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Bridge Time</span>
                  <span className="text-white">~2-5 minutes</span>
                </div>
              )}

              {/* Minimum Received */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">
                  Minimum received (after {slippage}% slippage)
                </span>
                <span className="text-white font-medium">
                  {formatNumber(minReceived)} {toToken?.symbol}
                </span>
              </div>

              {/* Network Fee */}
              {quote.gasEstimate && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Network fee</span>
                  <div className="flex items-center gap-1">
                    <span className="text-white font-medium">
                      {formatCurrency(quote.gasEstimate.gasFeeUSD)}
                    </span>
                    <span className="text-xs text-green-400">Sponsored</span>
                  </div>
                </div>
              )}

              {/* Route Provider */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Route</span>
                <div className="flex items-center gap-1">
                  <span className="text-white font-medium capitalize">{quote.provider}</span>
                  <ExternalLink className="w-3 h-3 text-gray-400" />
                </div>
              </div>

              {/* Quote Expiry */}
              {timeUntilExpiry > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Quote expires in</span>
                  <span className={cn(
                    "font-medium",
                    timeUntilExpiry < 30000 ? "text-red-400" : "text-[#ff7842]"
                  )}>
                    {formatTimeUntilExpiry(timeUntilExpiry)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 
                           rounded-lg text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                {error instanceof Error ? error.message : 'Failed to get quote'}
              </span>
            </div>
          )}

          {/* Swap Button */}
          <SwapButton
            fromToken={fromToken}
            toToken={toToken}
            fromAmount={amount}
            quote={quote || null}
            disabled={!fromToken || !toToken || !amount || amount === '0' || isLoading}
            priceImpactTooHigh={quote?.priceImpact ? quote.priceImpact > 15 : false}
          />
        </div>
      </div>

      {/* Token Selectors */}
      <TokenSelector
        isOpen={showFromTokenSelector}
        onClose={() => setShowFromTokenSelector(false)}
        onSelectToken={(token: Token) => setFromToken(token)}
        currentToken={fromToken}
        chainId={defaultChainId}
        title="Select token to swap from"
      />

      <TokenSelector
        isOpen={showToTokenSelector}
        onClose={() => setShowToTokenSelector(false)}
        onSelectToken={(token: Token) => setToToken(token)}
        currentToken={toToken}
        chainId={defaultChainId}
        title="Select token to swap to"
      />

      {/* Settings Modal */}
      <SwapSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        slippage={slippage || 0}
        onSlippageChange={setSlippage}
      />
    </div>
  )
} 