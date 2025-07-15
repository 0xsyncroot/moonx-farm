'use client'

import { useState, useRef } from 'react'
import { Share2, Download, Camera, Twitter, Send, Copy, TrendingUp, TrendingDown, Zap, Trophy, Target, Activity } from 'lucide-react'
import { toPng } from 'html-to-image'

interface PnLShareProps {
  pnlData: {
    totalPnL: number
    totalPnLPercent: number
    realizedPnL: number
    unrealizedPnL: number
    totalTrades: number
    winRate: number
    totalVolume: number
    biggestWin: number
    timeframe: string
  }
  portfolioValue: number
  username?: string
}

export function PnLShare({ pnlData, portfolioValue, username = 'Anonymous Trader' }: PnLShareProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const shareCardRef = useRef<HTMLDivElement>(null)

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

  const generateShareImage = async () => {
    if (!shareCardRef.current) return

    setIsGenerating(true)
    try {
      const dataUrl = await toPng(shareCardRef.current, {
        quality: 0.95,
        width: 600,
        height: 800,
        backgroundColor: '#0a0a0a',
        pixelRatio: 2,
      })

      // Create download link
      const link = document.createElement('a')
      link.download = `moonx-farm-pnl-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error('Error generating share image:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const shareText = `💰 Just made ${formatCurrency(pnlData.totalPnL)} (${formatPercentage(pnlData.totalPnLPercent)}) on MoonX Farm! 

🎯 Win Rate: ${pnlData.winRate.toFixed(1)}%
💎 Total Volume: ${formatCurrency(pnlData.totalVolume)}
🚀 ${pnlData.totalTrades} trades in ${pnlData.timeframe}

Join me on MoonX Farm and start farming profits! 🌙
#MoonXFarm #DeFi #CryptoWins #WAGMI`

  const shareToTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`
    window.open(twitterUrl, '_blank')
  }

  const shareToTelegram = () => {
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(shareText)}`
    window.open(telegramUrl, '_blank')
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareText)
  }

  const isProfit = pnlData.totalPnL >= 0
  const getPnLEmoji = () => {
    if (pnlData.totalPnL >= 10000) return '🚀'
    if (pnlData.totalPnL >= 5000) return '💎'
    if (pnlData.totalPnL >= 1000) return '🔥'
    if (pnlData.totalPnL >= 0) return '✅'
    return '😅'
  }

  return (
    <div className="space-y-4">
      {/* Share Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setShowShareDialog(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-lg hover:from-primary/90 hover:to-primary/70 transition-all duration-200 shadow-lg hover:shadow-primary/20"
        >
          <Share2 className="h-4 w-4" />
          Share PnL
        </button>

        <button
          onClick={generateShareImage}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-muted/20 border border-border/50 rounded-lg hover:bg-muted/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Generating...
            </>
          ) : (
            <>
              <Camera className="h-4 w-4" />
              Download Image
            </>
          )}
        </button>
      </div>

      {/* Share Dialog */}
      {showShareDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border/50 rounded-xl p-6 max-w-md w-full space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Share Your Success</h3>
              <button
                onClick={() => setShowShareDialog(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
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
                className="w-full flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span>Generating Image...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5 text-primary" />
                    <span>Download Image</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Share Card for Image Generation */}
      <div ref={shareCardRef} className="absolute -left-[9999px] top-0 opacity-0 pointer-events-none">
        <div className="w-[600px] h-[800px] bg-gradient-to-br from-black via-gray-900 to-black p-8 text-white font-sans">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-2xl font-bold mb-2">🌙 MoonX Farm</div>
            <div className="text-gray-400">Trading Results</div>
          </div>

          {/* Main PnL */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">{getPnLEmoji()}</div>
            <div className={`text-5xl font-bold mb-2 ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(pnlData.totalPnL)}
            </div>
            <div className={`text-2xl ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
              {formatPercentage(pnlData.totalPnLPercent)}
            </div>
            <div className="text-gray-400 text-lg mt-2">
              {pnlData.timeframe} Performance
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{pnlData.winRate.toFixed(1)}%</div>
              <div className="text-gray-400">Win Rate</div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{pnlData.totalTrades}</div>
              <div className="text-gray-400">Total Trades</div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{formatCurrency(pnlData.totalVolume)}</div>
              <div className="text-gray-400">Volume</div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400">{formatCurrency(pnlData.biggestWin)}</div>
              <div className="text-gray-400">Best Trade</div>
            </div>
          </div>

          {/* Bottom */}
          <div className="text-center">
            <div className="text-gray-400 mb-2">by {username}</div>
            <div className="text-sm text-gray-500">
              Join MoonX Farm and start farming profits! 🚀
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 