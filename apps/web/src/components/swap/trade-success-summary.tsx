'use client'

import React from 'react'
import { Quote } from '@/lib/api-client'
import { TrendingUp, TrendingDown, Clock, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TradeSuccessSummaryProps {
  quote: Quote
  executionTime?: number
  className?: string
}

export function TradeSuccessSummary({ 
  quote, 
  executionTime, 
  className 
}: TradeSuccessSummaryProps) {
  // Calculate trade metrics
  const fromValue = quote.fromToken?.priceUSD 
    ? (quote.fromToken.priceUSD * parseFloat(quote.fromAmount || '0')) / Math.pow(10, quote.fromToken.decimals || 18)
    : 0
  
  const toValue = quote.toToken?.priceUSD 
    ? (quote.toToken.priceUSD * parseFloat(quote.toAmount || '0')) / Math.pow(10, quote.toToken.decimals || 18)
    : 0
  
  const priceImpact = parseFloat(quote.priceImpact || '0')
  const isPositiveImpact = priceImpact < 0
  const impactColor = isPositiveImpact ? 'text-green-600' : priceImpact > 3 ? 'text-red-600' : 'text-yellow-600'
  
  const exchangeRate = quote.toToken && quote.fromToken
    ? (parseFloat(quote.toAmount || '0') / Math.pow(10, quote.toToken.decimals || 18)) / 
      (parseFloat(quote.fromAmount || '0') / Math.pow(10, quote.fromToken.decimals || 18))
    : 0

  return (
    <div className={cn(
      "bg-white/5 border border-white/10 rounded-xl p-4 space-y-3",
      className
    )}>
      {/* Trade Summary Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Trade Summary</h3>
        <div className="flex items-center gap-2">
          {executionTime && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              <span>{(executionTime / 1000).toFixed(1)}s</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-xs text-blue-400">
            <Zap className="w-3 h-3" />
            <span>{quote.provider}</span>
          </div>
        </div>
      </div>

      {/* Exchange Rate */}
      <div className="flex items-center justify-between py-2 border-b border-white/5">
        <span className="text-sm text-gray-400">Exchange Rate</span>
        <span className="text-sm text-white font-mono">
          1 {quote.fromToken?.symbol} = {exchangeRate.toFixed(6)} {quote.toToken?.symbol}
        </span>
      </div>

      {/* Trade Values */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">You Paid</span>
          <div className="text-right">
            <div className="text-sm text-white font-mono">
              {(parseFloat(quote.fromAmount || '0') / Math.pow(10, quote.fromToken?.decimals || 18)).toFixed(6)} {quote.fromToken?.symbol}
            </div>
            {fromValue > 0 && (
              <div className="text-xs text-gray-400">${fromValue.toFixed(2)}</div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">You Received</span>
          <div className="text-right">
            <div className="text-sm text-green-400 font-mono">
              {(parseFloat(quote.toAmount || '0') / Math.pow(10, quote.toToken?.decimals || 18)).toFixed(6)} {quote.toToken?.symbol}
            </div>
            {toValue > 0 && (
              <div className="text-xs text-gray-400">${toValue.toFixed(2)}</div>
            )}
          </div>
        </div>
      </div>

      {/* Price Impact */}
      {priceImpact !== 0 && (
        <div className="flex items-center justify-between py-2 border-t border-white/5">
          <span className="text-sm text-gray-400">Price Impact</span>
          <div className={cn("flex items-center gap-1 text-sm font-mono", impactColor)}>
            {isPositiveImpact ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span>{Math.abs(priceImpact).toFixed(2)}%</span>
          </div>
        </div>
      )}

      {/* Slippage */}
      {quote.slippageTolerance && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Slippage Tolerance</span>
          <span className="text-sm text-white font-mono">{quote.slippageTolerance}%</span>
        </div>
      )}

      {/* Network Fee (placeholder) */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Network Fee</span>
        <span className="text-sm text-gray-400">~$2.50</span>
      </div>
    </div>
  )
} 