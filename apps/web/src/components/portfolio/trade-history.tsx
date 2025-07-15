'use client'

import { useState, useMemo } from 'react'
import { useTradeHistory } from '@/hooks/useTradeHistory'
import { RefreshCw, TrendingUp, TrendingDown, ArrowRightLeft, Share2, Copy, Download, Camera, Twitter, Send, Trophy, ExternalLink } from 'lucide-react'
import { formatUnits } from 'ethers'
import { toPng } from 'html-to-image'

export function TradeHistory() {
  const { trades, isLoading, error, refresh, refreshing, cacheAge } = useTradeHistory()
  const [selectedTrade, setSelectedTrade] = useState<any>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [shareCardRef, setShareCardRef] = useState<HTMLDivElement | null>(null)

  // Default to empty array if no data
  const data = useMemo(() => trades || [], [trades])

  // Sort trades by timestamp (newest first)
  const sortedTrades = useMemo(() => {
    return data.sort((a, b) => new Date((b as any).timestamp).getTime() - new Date((a as any).timestamp).getTime())
  }, [data])

  // Format currency
  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    }
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  // Format token amounts
  const formatTokenAmount = (amount: string | number, decimals: number = 18) => {
    try {
      if (!amount) return '0'
      
      const amountStr = amount.toString()
      
      if (amountStr.includes('.') && parseFloat(amountStr) < 1000000) {
        const num = parseFloat(amountStr)
        if (num < 0.0001) return '< 0.0001'
        if (num < 1) return num.toFixed(6).replace(/\.?0+$/, '')
        if (num < 1000) return num.toFixed(4).replace(/\.?0+$/, '')
        return num.toFixed(2)
      }
      
      const formatted = formatUnits(amountStr, decimals)
      const num = parseFloat(formatted)
      
      if (num < 0.0001) return '< 0.0001'
      if (num < 1) return num.toFixed(6).replace(/\.?0+$/, '')
      if (num < 1000) return num.toFixed(4).replace(/\.?0+$/, '')
      if (num < 1000000) return `${(num / 1000).toFixed(2)}K`
      return `${(num / 1000000).toFixed(2)}M`
    } catch {
      return amount?.toString() || '0'
    }
  }

  // Share functions
  const shareTransaction = (trade: any) => {
    setSelectedTrade(trade)
    setShowShareModal(true)
  }

  const generateShareImage = async () => {
    if (!shareCardRef || !selectedTrade) return

    setIsGenerating(true)
    try {
      const dataUrl = await toPng(shareCardRef, {
        quality: 0.95,
        width: 600,
        height: 400,
        backgroundColor: '#0a0a0a',
        pixelRatio: 2,
      })

      const link = document.createElement('a')
      link.download = `moonx-farm-trade-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error('Error generating share image:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const getShareText = (trade: any) => {
    const pnl = trade.pnl?.netPnlUSD || trade.profitLoss || 0
    const pnlPercent = trade.pnl?.pnlPercent || 0
    const isProfit = pnl >= 0
    const emoji = isProfit ? '🚀' : '😅'
    
    return `${emoji} Just ${isProfit ? 'made' : 'lost'} ${formatCurrency(Math.abs(pnl))} ${pnlPercent !== 0 ? `(${formatPercentage(pnlPercent)})` : ''} swapping ${trade.fromToken?.symbol} → ${trade.toToken?.symbol} on MoonX Farm!

💎 Trade Value: ${formatCurrency(trade.valueUSD || 0)}
🌙 Join MoonX Farm and start farming profits!
#MoonXFarm #DeFi #CryptoTrading #WAGMI`
  }

  const shareToTwitter = () => {
    if (!selectedTrade) return
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(getShareText(selectedTrade))}`
    window.open(twitterUrl, '_blank')
  }

  const shareToTelegram = () => {
    if (!selectedTrade) return
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(getShareText(selectedTrade))}`
    window.open(telegramUrl, '_blank')
  }

  const copyToClipboard = () => {
    if (!selectedTrade) return
    navigator.clipboard.writeText(getShareText(selectedTrade))
  }

  // Get block explorer URL
  const getBlockExplorerUrl = (chainId: number, txHash: string) => {
    const explorerMap: { [key: number]: string } = {
      1: 'https://etherscan.io',
      56: 'https://bscscan.com',
      8453: 'https://basescan.org',
      137: 'https://polygonscan.com',
      42161: 'https://arbiscan.io',
      10: 'https://optimistic.etherscan.io',
    }
    
    const baseUrl = explorerMap[chainId] || explorerMap[1]
    return `${baseUrl}/tx/${txHash}`
  }

  // Calculate cache freshness
  const isDataFresh = cacheAge < 2 * 60 * 1000 // 2 minutes
  const cacheMinutes = Math.floor(cacheAge / 60000)

  // Shimmer loading overlay component
  const ShimmerOverlay = () => (
    <div className="absolute inset-0 bg-card/50 backdrop-blur-sm rounded-xl overflow-hidden">
      <div className="h-full w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-shimmer bg-[length:200%_100%]" />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary/70" />
          <h2 className="text-lg font-semibold">Recent Trades</h2>
          {!isDataFresh && !refreshing && !isLoading && (
            <span className="text-xs text-muted-foreground bg-muted/20 px-2 py-1 rounded">
              {cacheMinutes}m ago
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">
            {data.length} total trades
          </div>
          <button
            onClick={() => refresh()}
            disabled={refreshing || isLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border/50 rounded-lg hover:bg-muted/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing || isLoading ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && !refreshing && !isLoading && (
        <div className="bg-error/10 border border-error/20 rounded-xl p-4 text-center">
          <div className="text-error font-medium mb-2">Failed to load trades</div>
          <div className="text-sm text-muted-foreground">Please try refreshing</div>
        </div>
      )}

      {/* Main Trades Container */}
      <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl p-6 space-y-4 relative">
        {(isLoading || refreshing) && <ShimmerOverlay />}
        
        {/* Loading State */}
        {isLoading && !data.length && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-muted/20 border border-border/30 rounded-lg p-4">
                <div className="animate-pulse space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-muted/30 rounded-lg"></div>
                      <div className="space-y-1">
                        <div className="h-4 bg-muted/30 rounded w-24"></div>
                        <div className="h-3 bg-muted/30 rounded w-32"></div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="h-4 bg-muted/30 rounded w-16"></div>
                      <div className="h-3 bg-muted/30 rounded w-12"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Trades List */}
        {sortedTrades.length > 0 ? (
          <div className="space-y-3">
                          {sortedTrades.slice(0, 10).map((trade, index) => {
                const pnl = trade.pnl?.netPnlUSD || trade.profitLoss || 0
                const pnlPercent = trade.pnl ? ((pnl / (trade.pnl.realizedPnlUSD || 1)) * 100) : 0
                const isProfit = pnl >= 0
                const txHash = trade.txHash
                
                return (
                  <div
                    key={`${txHash}-${index}`}
                    className="bg-muted/20 border border-border/30 rounded-lg p-4 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isProfit ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
                        }`}>
                          <ArrowRightLeft className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {trade.fromToken?.symbol || 'Unknown'} → {trade.toToken?.symbol || 'Unknown'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTokenAmount(trade.fromToken?.amount || 0, trade.fromToken?.decimals)} → {formatTokenAmount(trade.toToken?.amount || 0, trade.toToken?.decimals)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              {trade.timestamp ? new Date(trade.timestamp).toLocaleString() : 'Unknown time'}
                            </span>
                            {trade.chainId && txHash && (
                              <a
                                href={getBlockExplorerUrl(trade.chainId, txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 hover:text-primary transition-colors"
                              >
                                <ExternalLink className="h-3 w-3" />
                                View
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className={`font-bold text-sm ${isProfit ? 'text-success' : 'text-error'}`}>
                            {isProfit ? '+' : ''}{formatCurrency(pnl)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {Math.abs(pnlPercent) > 0.01 ? formatPercentage(pnlPercent) : 'N/A'}
                          </div>
                        </div>
                        <button
                          onClick={() => shareTransaction(trade)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted/20 rounded"
                        >
                          <Share2 className="h-4 w-4 text-muted-foreground hover:text-primary" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            
            {sortedTrades.length > 10 && (
              <div className="text-center py-3 text-sm text-muted-foreground">
                Showing 10 of {sortedTrades.length} trades
              </div>
            )}
          </div>
        ) : !isLoading && (
          <div className="text-center py-8">
            <Trophy className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Trades Yet</h3>
            <p className="text-sm text-muted-foreground">
              Your trading history will appear here once you start trading
            </p>
          </div>
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && selectedTrade && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border/50 rounded-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Share Trade</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>

            {/* Trade Preview */}
            <div className="bg-muted/20 border border-border/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{selectedTrade.fromToken?.symbol}</span>
                  <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{selectedTrade.toToken?.symbol}</span>
                </div>
                <div className={`font-bold ${(selectedTrade.pnl?.netPnlUSD || selectedTrade.profitLoss || 0) >= 0 ? 'text-success' : 'text-error'}`}>
                  {formatCurrency(selectedTrade.pnl?.netPnlUSD || selectedTrade.profitLoss || 0)}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Value: {formatCurrency(selectedTrade.valueUSD || 0)}
              </div>
            </div>

            {/* Share Options */}
            <div className="space-y-3">
              <button
                onClick={shareToTwitter}
                className="w-full flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors"
              >
                <Twitter className="h-5 w-5 text-blue-500" />
                <span>Share on Twitter</span>
              </button>

              <button
                onClick={shareToTelegram}
                className="w-full flex items-center gap-3 p-3 bg-blue-400/10 border border-blue-400/20 rounded-lg hover:bg-blue-400/20 transition-colors"
              >
                <Send className="h-5 w-5 text-blue-400" />
                <span>Share on Telegram</span>
              </button>

              <button
                onClick={copyToClipboard}
                className="w-full flex items-center gap-3 p-3 bg-muted/20 border border-border/50 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <Copy className="h-5 w-5" />
                <span>Copy Text</span>
              </button>

              <button
                onClick={generateShareImage}
                disabled={isGenerating}
                className="w-full flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Camera className="h-5 w-5 text-primary" />
                    <span>Download Image</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Share Card */}
      <div ref={setShareCardRef} className="absolute -left-[9999px] top-0 opacity-0 pointer-events-none">
        {selectedTrade && (
          <div className="w-[600px] h-[400px] bg-gradient-to-br from-black via-gray-900 to-black p-6 text-white">
            <div className="text-center mb-6">
              <div className="text-xl font-bold mb-1">🌙 MoonX Farm</div>
              <div className="text-gray-400 text-sm">Trade Result</div>
            </div>
            
            <div className="text-center mb-6">
              <div className="text-3xl mb-2">
                {(selectedTrade.pnl?.netPnlUSD || selectedTrade.profitLoss || 0) >= 0 ? '🚀' : '😅'}
              </div>
              <div className="text-2xl font-bold mb-1">
                {selectedTrade.fromToken?.symbol} → {selectedTrade.toToken?.symbol}
              </div>
              <div className={`text-xl font-bold ${(selectedTrade.pnl?.netPnlUSD || selectedTrade.profitLoss || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(selectedTrade.pnl?.netPnlUSD || selectedTrade.profitLoss || 0)}
              </div>
              <div className="text-gray-400 text-sm mt-1">
                Trade Value: {formatCurrency(selectedTrade.valueUSD || 0)}
              </div>
            </div>

            <div className="text-center text-sm text-gray-500">
              Join MoonX Farm and start farming profits! 🚀
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 