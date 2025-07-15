'use client'

import { useState, useMemo, useRef } from 'react'
import { useTradeHistory } from '@/hooks/useTradeHistory'
import { RefreshCw, TrendingUp, TrendingDown, ArrowRightLeft, Share2, Copy, Download, Camera, Twitter, Send, Trophy, ExternalLink, X, Zap } from 'lucide-react'
import { formatUnits } from 'ethers'
import { toast } from 'react-hot-toast'

// Enhanced Canvas-based trade card generator
const elementToCanvas = async (element: HTMLElement, options: {
  width: number
  height: number
  backgroundColor: string
  scale: number
}, tradeData?: any): Promise<HTMLCanvasElement> => {
  const { width, height, backgroundColor, scale } = options
  
  // Create canvas
  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }
  
  // Add rounded corners to match UI preview (rounded-xl = 12px radius)
  const cornerRadius = 12
  ctx.beginPath()
  ctx.moveTo(cornerRadius, 0)
  ctx.lineTo(canvas.width - cornerRadius, 0)
  ctx.quadraticCurveTo(canvas.width, 0, canvas.width, cornerRadius)
  ctx.lineTo(canvas.width, canvas.height - cornerRadius)
  ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - cornerRadius, canvas.height)
  ctx.lineTo(cornerRadius, canvas.height)
  ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - cornerRadius)
  ctx.lineTo(0, cornerRadius)
  ctx.quadraticCurveTo(0, 0, cornerRadius, 0)
  ctx.closePath()
  ctx.clip()
  
  // Set background gradient to match UI preview exactly
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '#312e81') // indigo-900
  gradient.addColorStop(0.5, '#581c87') // purple-900  
  gradient.addColorStop(1, '#000000') // black
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  // Helper function to format currency
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
  
  return new Promise((resolve, reject) => {
    try {
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      
      // Add decorative background patterns to match UI preview
      ctx.globalAlpha = 0.1
      
      // Top-left radial gradient (#8B5CF6)
      const radialGrad1 = ctx.createRadialGradient(centerX - 300, centerY - 200, 0, centerX - 300, centerY - 200, 250)
      radialGrad1.addColorStop(0, '#8B5CF6')
      radialGrad1.addColorStop(0.5, 'transparent')
      ctx.fillStyle = radialGrad1
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Top-right radial gradient (#3B82F6)
      const radialGrad2 = ctx.createRadialGradient(centerX + 300, centerY - 200, 0, centerX + 300, centerY - 200, 250)
      radialGrad2.addColorStop(0, '#3B82F6')
      radialGrad2.addColorStop(0.5, 'transparent')
      ctx.fillStyle = radialGrad2
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Bottom-left radial gradient (#10B981)
      const radialGrad3 = ctx.createRadialGradient(centerX - 300, centerY + 200, 0, centerX - 300, centerY + 200, 200)
      radialGrad3.addColorStop(0, '#10B981')
      radialGrad3.addColorStop(0.5, 'transparent')
      ctx.fillStyle = radialGrad3
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      ctx.globalAlpha = 1
      
      // Header - MoonX Farm branding (match UI preview)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 36px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🌙 MoonX Farm', centerX, centerY - 280)
      
      ctx.fillStyle = '#d1d5db' // gray-300
      ctx.font = '18px system-ui, -apple-system, sans-serif'
      ctx.fillText('Professional Trading Platform', centerX, centerY - 245)
      
             // Trade information (in a rounded box like UI preview)
       if (tradeData) {
         const pnl = tradeData.pnl?.netPnlUSD || tradeData.profitLoss || 0
         const isProfit = pnl >= 0
         
         // Draw trade info box background (black/30 with border)
         ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
         ctx.fillRect(centerX - 300, centerY - 120, 600, 240)
         
         // Draw border (white/10)
         ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
         ctx.lineWidth = 2
         ctx.strokeRect(centerX - 300, centerY - 120, 600, 240)
         
         // Emoji indicator
         ctx.fillStyle = '#ffffff'
         ctx.font = '48px system-ui, -apple-system, sans-serif'
         ctx.fillText(isProfit ? '🚀' : '📈', centerX, centerY - 80)
         
         // Trade pair
         ctx.fillStyle = '#ffffff'
         ctx.font = 'bold 36px system-ui, -apple-system, sans-serif'
         const pairText = `${tradeData.fromToken?.symbol || 'Token'} → ${tradeData.toToken?.symbol || 'Token'}`
         ctx.fillText(pairText, centerX, centerY - 30)
         
         // PnL amount
         ctx.fillStyle = isProfit ? '#4ade80' : '#f87171' // green-400 : red-400
         ctx.font = 'bold 32px system-ui, -apple-system, sans-serif'
         const pnlText = `${isProfit ? '+' : ''}${formatCurrency(pnl)}`
         ctx.fillText(pnlText, centerX, centerY + 15)
         
         // Trade value
         ctx.fillStyle = '#9ca3af' // gray-400
         ctx.font = '20px system-ui, -apple-system, sans-serif'
         ctx.fillText(`Trade Value: ${formatCurrency(tradeData.valueUSD || 0)}`, centerX, centerY + 50)
         
       } else {
         // Fallback content
         ctx.fillStyle = '#ffffff'
         ctx.font = 'bold 48px system-ui, -apple-system, sans-serif'
         ctx.fillText('Trade Screenshot', centerX, centerY - 50)
         
         ctx.fillStyle = '#d1d5db'
         ctx.font = '28px system-ui, -apple-system, sans-serif'
         ctx.fillText('Generated by MoonX Farm', centerX, centerY + 50)
       }
      
             // Add decorative blur elements to match UI preview
       ctx.globalAlpha = 0.2
       
       // Top-right decorative element (primary/20)
       ctx.fillStyle = '#3b82f6'
       ctx.beginPath()
       ctx.arc(canvas.width - 100, 100, 30, 0, Math.PI * 2)
       ctx.fill()
       
       // Bottom-left decorative element (purple-500/20)
       ctx.fillStyle = '#8b5cf6'
       ctx.beginPath()
       ctx.arc(100, canvas.height - 100, 40, 0, Math.PI * 2)
       ctx.fill()
       
       ctx.globalAlpha = 1
       
       // Footer
       ctx.fillStyle = '#9ca3af' // gray-400
       ctx.font = '16px system-ui, -apple-system, sans-serif'
       ctx.fillText(new Date().toLocaleString(), centerX, centerY + 150)
       

      
      resolve(canvas)
    } catch (error) {
      reject(error)
    }
  })
}

// Improved Clipboard API with better error handling
const copyCanvasToClipboard = async (canvas: HTMLCanvasElement): Promise<boolean> => {
  try {
    // Check clipboard API support
    if (!navigator.clipboard || !navigator.clipboard.write) {
      console.warn('Clipboard API not supported')
      return false
    }
    
    // Convert canvas to blob with error handling
    const blob = await new Promise<Blob>((resolve, reject) => {
      try {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to convert canvas to blob'))
          }
        }, 'image/png', 1.0)
      } catch (error) {
        reject(error)
      }
    })
    
    // Check if blob was created successfully
    if (!blob || blob.size === 0) {
      throw new Error('Invalid or empty image blob')
    }
    
    // Try to write to clipboard
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob
        })
      ])
      return true
    } catch (clipboardError) {
      console.warn('Clipboard write failed:', clipboardError)
      return false
    }
  } catch (error) {
    console.error('Canvas to clipboard failed:', error)
    return false
  }
}

export function TradeHistory() {
  const { trades, isLoading, error, refresh, refreshing, cacheAge } = useTradeHistory()
  const [selectedTrade, setSelectedTrade] = useState<any>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const shareCardRef = useRef<HTMLDivElement | null>(null)

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

  // Modern Canvas-based image generation (2025 approach)
  const generateShareImage = async () => {
    if (!shareCardRef.current || !selectedTrade) return

    setIsGenerating(true)
    try {
      console.log('🎨 Generating image with modern Canvas API...')

      const canvas = await elementToCanvas(shareCardRef.current, {
        width: 1200,
        height: 900,
        backgroundColor: '#0a0a0a',
        scale: 1
      }, selectedTrade)

      console.log('✅ Canvas generated successfully')

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.download = `moonx-farm-trade-${Date.now()}.png`
          link.href = url
          link.click()
          URL.revokeObjectURL(url)
          toast.success('Image downloaded successfully!')
        } else {
          throw new Error('Failed to generate image blob')
        }
      }, 'image/png', 1.0)

    } catch (error) {
      console.error('❌ Error generating share image:', error)
      toast.error('Failed to generate image. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const copyShareImageToClipboard = async () => {
    if (!shareCardRef.current || !selectedTrade) return

    setIsGenerating(true)
    try {
      // Check if clipboard API is supported
      if (!navigator.clipboard || !navigator.clipboard.write) {
        throw new Error('Clipboard API not supported')
      }

      console.log('🎨 Generating image for clipboard...')

      // FIXED: Temporarily make element visible for proper rendering
      const shareElement = shareCardRef.current
      const originalStyle = {
        position: shareElement.style.position,
        left: shareElement.style.left,
        top: shareElement.style.top,
        opacity: shareElement.style.opacity,
        visibility: shareElement.style.visibility,
        zIndex: shareElement.style.zIndex
      }

      // Make element visible but positioned off-screen
      shareElement.style.position = 'fixed'
      shareElement.style.left = '-9999px'
      shareElement.style.top = '0'
      shareElement.style.opacity = '1'
      shareElement.style.visibility = 'visible'
      shareElement.style.zIndex = '9999'

      // Wait for render
      await new Promise(resolve => setTimeout(resolve, 200))

      // Generate image with modern Canvas API
      const canvas = await elementToCanvas(shareElement, {
        width: 1200,
        height: 900,
        backgroundColor: '#0a0a0a',
        scale: 1
      }, selectedTrade)

      // Restore original styles
      Object.assign(shareElement.style, originalStyle)

      console.log('✅ Canvas generated successfully')

      // Copy to clipboard using modern API
      const success = await copyCanvasToClipboard(canvas)
      
      if (success) {
        console.log('✅ Successfully copied to clipboard')
        toast.success('Image copied to clipboard!')
        return
      } else {
        // Fallback to download
        console.log('🔄 Clipboard failed, falling back to download...')
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.download = `moonx-farm-trade-${Date.now()}.png`
            link.href = url
            link.click()
            URL.revokeObjectURL(url)
            toast.success('Image downloaded as fallback!')
          } else {
            toast.error('Failed to generate image. Please try again.')
          }
        }, 'image/png', 1.0)
      }
    } catch (error) {
      console.error('❌ Copy to clipboard failed:', error)
      
      // Provide specific error messages
      let errorMessage = 'Failed to copy image'
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          errorMessage = 'Clipboard permission denied. Please allow clipboard access.'
        } else if (error.message.includes('not supported')) {
          errorMessage = 'Clipboard not supported in this browser. Try downloading instead.'
        } else if (error.message.includes('Invalid image')) {
          errorMessage = 'Failed to generate image. Please try again.'
        }
      }
      
      toast.error(errorMessage)
      
      // Auto-fallback to download if clipboard fails
      try {
        console.log('🔄 Attempting fallback download...')
        
        // Generate canvas again for download
        const fallbackCanvas = await elementToCanvas(shareCardRef.current!, {
          width: 1200,
          height: 900,
          backgroundColor: '#0a0a0a',
          scale: 1
        }, selectedTrade)

        fallbackCanvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.download = `moonx-farm-trade-${Date.now()}.png`
            link.href = url
            link.click()
            URL.revokeObjectURL(url)
            toast.success('Image downloaded as fallback!')
          } else {
            toast.error('Failed to generate fallback image.')
          }
        }, 'image/png', 1.0)
      } catch (downloadError) {
        console.error('❌ Fallback download also failed:', downloadError)
        toast.error('Both copy and download failed. Please try again.')
      }
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
🌙 Try this pair yourself on MoonX Farm!

Join MoonX Farm and start farming profits!
#MoonXFarm #DeFi #CryptoTrading #WAGMI`
  }

  // Generate swap URL for the trade
  const generateSwapURL = (trade: any) => {
    const baseUrl = window.location.origin
    const params = new URLSearchParams()
    
    // Add from token params
    if (trade.fromToken?.address) {
      params.set('from', trade.fromToken.address)
      // Use token's chainId if available, otherwise fallback to trade.chainId
      const fromChainId = trade.fromToken.chainId || trade.chainId
      if (fromChainId) {
        params.set('fromChain', fromChainId.toString())
      }
    }
    
    // Add to token params
    if (trade.toToken?.address) {
      params.set('to', trade.toToken.address)
      // Use token's chainId if available, otherwise fallback to trade.chainId
      const toChainId = trade.toToken.chainId || trade.chainId
      if (toChainId) {
        params.set('toChain', toChainId.toString())
      }
    }
    
    // Don't add amount as per user request
    // Add default slippage only if different from 0.5
    // params.set('slippage', '0.5')
    
    return `${baseUrl}/swap?${params.toString()}`
  }

  // Generate compact URL display for UI
  const getCompactSwapURL = (trade: any) => {
    const fromSymbol = trade.fromToken?.symbol || 'Token'
    const toSymbol = trade.toToken?.symbol || 'Token'
    return `${fromSymbol}→${toSymbol}`
  }

  const shareToTwitter = () => {
    if (!selectedTrade) return
    const swapUrl = generateSwapURL(selectedTrade)
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(getShareText(selectedTrade))}&url=${encodeURIComponent(swapUrl)}`
    window.open(twitterUrl, '_blank')
  }

  const shareToTelegram = () => {
    if (!selectedTrade) return
    const swapUrl = generateSwapURL(selectedTrade)
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(swapUrl)}&text=${encodeURIComponent(getShareText(selectedTrade))}`
    window.open(telegramUrl, '_blank')
  }

  const shareToFarcaster = () => {
    if (!selectedTrade) return
    const swapUrl = generateSwapURL(selectedTrade)
    const shareText = getShareText(selectedTrade)
    const fullText = `${shareText}\n\n🔗 ${swapUrl}`
    
    // Farcaster share via Warpcast
    const farcasterUrl = `https://farcaster.xyz/~/compose?text=${encodeURIComponent(fullText)}`
    window.open(farcasterUrl, '_blank')
  }

  const copyToClipboard = () => {
    if (!selectedTrade) return
    const shareText = getShareText(selectedTrade)
    const swapUrl = generateSwapURL(selectedTrade)
    const fullText = `${shareText}\n\n🔗 ${swapUrl}`
    navigator.clipboard.writeText(fullText)
    toast.success('Share text copied to clipboard!')
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
    <div className="absolute inset-0 bg-card/50 backdrop-blur-sm rounded-xl overflow-hidden z-10">
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
          <div className="relative">
            {/* Scroll indicators */}
            <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-card/80 to-transparent pointer-events-none z-10"></div>
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-card/80 to-transparent pointer-events-none z-10"></div>
            
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/30">
                          {sortedTrades.map((trade, index) => {
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
            </div>
            
            {/* Footer with total count */}
            {sortedTrades.length > 5 && (
              <div className="text-center py-3 text-sm text-muted-foreground border-t border-border/30 mt-4">
                {sortedTrades.length} total trades • Scroll to see all
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
          <div className="bg-card border border-border/50 rounded-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-primary to-purple-500 rounded-full flex items-center justify-center">
                  <Share2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Share Your Trade</h3>
                  <p className="text-sm text-muted-foreground">
                    Show off your trading success with MoonX Farm
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-muted/20 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Side - Image Preview */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Camera className="h-5 w-5 text-primary" />
                  <span className="text-lg font-medium">Share Image Preview</span>
                </div>
                
                {/* Image Preview */}
                <div ref={shareCardRef} className="bg-gradient-to-br from-indigo-900 via-purple-900 to-black rounded-xl p-6 text-white relative overflow-hidden aspect-[4/3]">
                  {/* Background Pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_25%_25%,#8B5CF6_0%,transparent_50%)]"></div>
                    <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_75%_25%,#3B82F6_0%,transparent_50%)]"></div>
                    <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(circle_at_25%_75%,#10B981_0%,transparent_50%)]"></div>
                  </div>
                  
                  {/* Header */}
                  <div className="relative z-10 text-center mb-4">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-gradient-to-r from-primary to-primary/60 rounded-full flex items-center justify-center">
                        <span className="text-lg">🌙</span>
                      </div>
                      <div className="text-xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                        MoonX Farm
                      </div>
                    </div>
                    <div className="text-gray-300 text-xs">Professional Trading Platform</div>
                  </div>

                  {/* Trade Info */}
                  <div className="relative z-10 text-center">
                    <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                      <div className="text-2xl mb-2">
                        {(selectedTrade.pnl?.netPnlUSD || selectedTrade.profitLoss || 0) >= 0 ? '🚀' : '📈'}
                      </div>
                      
                      <div className="text-xl font-bold mb-1 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        {selectedTrade.fromToken?.symbol} → {selectedTrade.toToken?.symbol}
                      </div>
                      
                      <div className={`text-lg font-bold ${(selectedTrade.pnl?.netPnlUSD || selectedTrade.profitLoss || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(selectedTrade.pnl?.netPnlUSD || selectedTrade.profitLoss || 0) >= 0 ? '+' : ''}
                        {formatCurrency(selectedTrade.pnl?.netPnlUSD || selectedTrade.profitLoss || 0)}
                      </div>
                      
                      <div className="text-gray-400 text-sm mt-2">
                        Trade Value: {formatCurrency(selectedTrade.valueUSD || 0)}
                      </div>
                    </div>
                  </div>

                  {/* Decorative Elements */}
                  <div className="absolute top-4 right-4 w-8 h-8 bg-primary/20 rounded-full blur-xl"></div>
                  <div className="absolute bottom-4 left-4 w-10 h-10 bg-purple-500/20 rounded-full blur-xl"></div>
                </div>

                {/* Image Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={generateShareImage}
                    disabled={isGenerating}
                    className="flex items-center justify-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span className="text-sm">Generating...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 text-primary" />
                        <span className="text-sm">Download Image</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={copyShareImageToClipboard}
                    disabled={isGenerating}
                    className="flex items-center justify-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span className="text-sm">Copying...</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 text-primary" />
                        <span className="text-sm">Copy Image</span>
                      </>
                    )}
                  </button>
                </div>
                
                {/* Clipboard support indicator */}
                {!navigator.clipboard?.write && (
                  <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded mt-2">
                    ⚠️ Clipboard not supported - will download instead
                  </div>
                )}
              </div>

              {/* Right Side - Share Options */}
              <div className="space-y-6">
                {/* Trade Summary */}
                <div className="bg-muted/20 border border-border/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{selectedTrade.fromToken?.symbol}</span>
                      <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{selectedTrade.toToken?.symbol}</span>
                    </div>
                    <div className={`font-bold ${(selectedTrade.pnl?.netPnlUSD || selectedTrade.profitLoss || 0) >= 0 ? 'text-success' : 'text-error'}`}>
                      {formatCurrency(selectedTrade.pnl?.netPnlUSD || selectedTrade.profitLoss || 0)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground">Trade Value:</span>
                      <div className="font-medium">{formatCurrency(selectedTrade.valueUSD || 0)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Time:</span>
                      <div className="font-medium">
                        {selectedTrade.timestamp ? new Date(selectedTrade.timestamp).toLocaleString() : 'Recently'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <div className="text-xs text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Swap Again:</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generateSwapURL(selectedTrade))
                            toast.success('Swap URL copied to clipboard!')
                          }}
                          className="text-primary hover:text-primary/80 transition-colors p-1 rounded"
                          title="Copy full URL"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      <a 
                        href={generateSwapURL(selectedTrade)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 hover:underline block mt-1"
                        title={generateSwapURL(selectedTrade)}
                      >
                        {getCompactSwapURL(selectedTrade)}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Share Options */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Share2 className="h-5 w-5 text-primary" />
                    <span className="text-lg font-medium">Share Options</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={shareToTwitter}
                      className="flex flex-col items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors group"
                      title="Share on X (Twitter)"
                    >
                      <Twitter className="h-5 w-5 text-blue-500 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-medium text-blue-500">X</span>
                    </button>

                    <button
                      onClick={shareToTelegram}
                      className="flex flex-col items-center gap-2 p-3 bg-blue-400/10 border border-blue-400/20 rounded-lg hover:bg-blue-400/20 transition-colors group"
                      title="Share on Telegram"
                    >
                      <Send className="h-5 w-5 text-blue-400 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-medium text-blue-400 hidden sm:inline">Telegram</span>
                      <span className="text-xs font-medium text-blue-400 sm:hidden">TG</span>
                    </button>

                    <button
                      onClick={shareToFarcaster}
                      className="flex flex-col items-center gap-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg hover:bg-purple-500/20 transition-colors group"
                      title="Share on Farcaster"
                    >
                      <Zap className="h-5 w-5 text-purple-500 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-medium text-purple-500 hidden sm:inline">Farcaster</span>
                      <span className="text-xs font-medium text-purple-500 sm:hidden">FC</span>
                    </button>
                  </div>

                  <button
                    onClick={copyToClipboard}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-muted/20 border border-border/50 rounded-lg hover:bg-muted/30 transition-colors group"
                  >
                    <Copy className="h-4 w-4 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium hidden sm:inline">Copy Share Text</span>
                    <span className="text-sm font-medium sm:hidden">Copy Text</span>
                  </button>
                </div>

                {/* Tips */}
                <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm">💡</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-primary mb-1">Pro Tip</div>
                      <div className="text-xs text-muted-foreground">
                        Download or copy the image for sharing. Share on social media to showcase your trades. 
                        The swap link lets others try the same pair on MoonX Farm.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Share Card */}
      <div ref={shareCardRef} className="absolute -left-[9999px] top-0 opacity-0 pointer-events-none">
        {selectedTrade && (
          <div className="w-[1200px] h-[900px] bg-gradient-to-br from-gray-900 via-black to-gray-800 p-12 text-white relative overflow-hidden">
            {/* Background Pattern - Updated with brand colors */}
            <div className="absolute inset-0 opacity-15">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_25%_25%,rgba(255,120,66,0.3)_0%,transparent_50%)]"></div>
              <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_75%_25%,rgba(255,120,66,0.2)_0%,transparent_50%)]"></div>
              <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(circle_at_25%_75%,rgba(34,197,94,0.2)_0%,transparent_50%)]"></div>
              <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_75%_75%,rgba(239,68,68,0.15)_0%,transparent_50%)]"></div>
            </div>
            
            {/* Header */}
            <div className="relative z-10 text-center mb-12">
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-3xl">🌙</span>
                </div>
                <div>
                  <div className="text-5xl font-bold bg-gradient-to-r from-primary-500 to-primary-400 bg-clip-text text-transparent">
                    MoonX Farm
                  </div>
                  <div className="text-gray-300 text-lg">Professional Trading Platform</div>
                </div>
              </div>
            </div>

            {/* Trade Info */}
            <div className="relative z-10 text-center mb-12">
              <div className="bg-black/40 backdrop-blur-sm rounded-3xl p-8 border border-white/10 max-w-3xl mx-auto shadow-2xl">
                <div className="text-8xl mb-6">
                  {(selectedTrade.pnl?.netPnlUSD || selectedTrade.profitLoss || 0) >= 0 ? '🚀' : '📈'}
                </div>
                
                <div className="text-6xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  {selectedTrade.fromToken?.symbol} → {selectedTrade.toToken?.symbol}
                </div>
                
                <div className="mb-6">
                  <div className={`text-5xl font-bold ${(selectedTrade.pnl?.netPnlUSD || selectedTrade.profitLoss || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(selectedTrade.pnl?.netPnlUSD || selectedTrade.profitLoss || 0) >= 0 ? '+' : ''}
                    {formatCurrency(selectedTrade.pnl?.netPnlUSD || selectedTrade.profitLoss || 0)}
                  </div>
                  <div className="text-gray-400 text-2xl mt-2">
                    Trade Value: {formatCurrency(selectedTrade.valueUSD || 0)}
                  </div>
                </div>
                
                <div className="text-lg text-gray-500 mb-4">
                  {selectedTrade.timestamp ? new Date(selectedTrade.timestamp).toLocaleString() : 'Recently'}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 text-center">
              <div className="text-2xl text-gray-300 mb-4">
                Try this pair yourself on MoonX Farm! 🚀
              </div>
              <div className="text-lg text-gray-400 mb-6 font-mono bg-black/50 border border-primary-500/30 px-6 py-3 rounded-xl inline-block">
                {getCompactSwapURL(selectedTrade)}
              </div>
              <div className="text-lg text-gray-500">
                #MoonXFarm #DeFi #CryptoTrading #WAGMI
              </div>
            </div>

            {/* Decorative Elements - Updated with brand colors */}
            <div className="absolute top-12 right-12 w-24 h-24 bg-primary-500/20 rounded-full blur-2xl"></div>
            <div className="absolute bottom-12 left-12 w-28 h-28 bg-primary-600/25 rounded-full blur-2xl"></div>
            <div className="absolute top-1/2 left-12 w-20 h-20 bg-green-500/20 rounded-full blur-2xl"></div>
            <div className="absolute top-1/3 right-12 w-16 h-16 bg-primary-400/30 rounded-full blur-xl"></div>
            <div className="absolute bottom-1/3 right-24 w-12 h-12 bg-warning/15 rounded-full blur-lg"></div>
          </div>
        )}
      </div>
    </div>
  )
} 