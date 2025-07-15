'use client'

import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { X, ExternalLink, Copy, Check, TrendingUp, TrendingDown, BarChart3, DollarSign, Percent, Clock } from 'lucide-react'
import { getChainConfig } from '@/config/chains'
import { toast } from 'react-hot-toast'
import { formatCurrency, formatBalance, copyToClipboard, getTokenTypeDisplay } from '@/utils/formatting'

interface TokenHoldingDetailProps {
  token: any
  totalPortfolioValue: number
  isOpen: boolean
  onClose: () => void
}

export function TokenHoldingDetail({ token, totalPortfolioValue, isOpen, onClose }: TokenHoldingDetailProps) {
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [selectedTimeframe, setSelectedTimeframe] = useState('24h')

  // Always call hooks - move early return after hooks
  const chainConfig = getChainConfig(token?.chainId)
  const allocation = totalPortfolioValue > 0 && token ? (token.valueUSD / totalPortfolioValue) * 100 : 0

  // Handle copy to clipboard
  const handleCopyToClipboard = async (text: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedAddress(true)
      toast.success('Address copied to clipboard')
      setTimeout(() => setCopiedAddress(false), 2000)
    } else {
      toast.error('Failed to copy to clipboard')
    }
  }

  const openExplorer = (address: string) => {
    if (chainConfig?.explorer) {
      const url = `${chainConfig.explorer}/token/${address}`
      window.open(url, '_blank')
    }
  }

  // Real price history data placeholder - to be connected to API
  const priceHistory = useMemo(() => {
    if (!token) return []
    
    // For now, show simple data point for current price
    // In real app, this would come from price history API
    const currentPrice = token.priceUSD || 0
    
    return [{
      time: Date.now(),
      price: currentPrice
    }]
  }, [token?.priceUSD])

  console.log('🔍 TokenHoldingDetail - Token Data:', {
    token,
    totalPortfolioValue,
    allocation,
    priceHistory
  })

  // Real-time price display (placeholder for chart)
  const PriceDisplay = ({ data }: { data: any[] }) => {
    if (!data.length) {
      return (
        <div className="h-40 w-full bg-muted/10 rounded-lg p-4 flex items-center justify-center">
          <div className="text-center">
            <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Price chart coming soon</p>
          </div>
        </div>
      )
    }

    const currentPrice = data[0].price
    
    return (
      <div className="h-40 w-full bg-muted/10 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium">Current Price</span>
          <div className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary">Real-time</span>
          </div>
        </div>
        
        <div className="flex items-center justify-center h-20">
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground mb-1">
              {formatCurrency(currentPrice)}
            </div>
            <div className="text-sm text-muted-foreground">
              per {token.tokenSymbol}
            </div>
          </div>
        </div>
        
        <div className="mt-4 text-xs text-muted-foreground text-center">
          Historical price charts coming soon
        </div>
      </div>
    )
  }

  // Early return after hooks - prevent rendering if not open
  if (!isOpen || !token) return null

  const modalContent = (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[48] bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 z-[49] flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div className="w-full max-w-6xl bg-card border border-border/50 rounded-xl shadow-2xl 
                       pointer-events-auto transform transition-all duration-300 
                       animate-in slide-in-from-bottom-8 fade-in-0 my-8 
                       flex flex-col max-h-[calc(100vh-4rem)]">
          
          {/* Header */}
          <div className="bg-card/95 backdrop-blur-sm border-b border-border/50 p-6 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary/30 to-primary/20 flex items-center justify-center">
                  {token.logoUrl ? (
                    <Image 
                      src={token.logoUrl} 
                      alt={token.tokenSymbol}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="text-lg font-bold text-primary">
                      {token.tokenSymbol.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{token.tokenSymbol}</h3>
                  <p className="text-sm text-muted-foreground">
                    {token.tokenName || 'Unknown Token'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                      {chainConfig?.name || `Chain ${token.chainId}`}
                    </span>
                    <span className="text-xs bg-muted/30 px-2 py-1 rounded">
                      {getTokenTypeDisplay(token)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground p-2 hover:bg-muted/20 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-muted/20 border border-border/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Current Value</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{formatCurrency(token.valueUSD)}</div>
                <div className="text-xs text-muted-foreground">USD Value</div>
              </div>

              <div className="bg-muted/20 border border-border/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Holdings</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{formatBalance(token.balanceFormatted)}</div>
                <div className="text-xs text-muted-foreground">{token.tokenSymbol}</div>
              </div>

              <div className="bg-muted/20 border border-border/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Allocation</span>
                </div>
                <div className="text-2xl font-bold text-primary">{allocation.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">of Portfolio</div>
              </div>

              <div className="bg-muted/20 border border-border/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Token Price</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{formatCurrency(token.priceUSD || 0)}</div>
                <div className="text-xs text-muted-foreground">per {token.tokenSymbol}</div>
              </div>
            </div>

            {/* Price Display */}
            <div className="bg-muted/10 border border-border/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold">Price Information</h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Live Data</span>
                </div>
              </div>
              <PriceDisplay data={priceHistory} />
            </div>

            {/* Token Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contract Info */}
              <div className="bg-muted/10 border border-border/30 rounded-lg p-4">
                <h4 className="text-lg font-semibold mb-4">Contract Information</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Network</label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-medium">{chainConfig?.name || 'Unknown'}</span>
                      <span className="text-xs bg-muted/30 px-2 py-1 rounded">Chain ID: {token.chainId}</span>
                    </div>
                  </div>
                  
                  {token.tokenAddress && token.tokenAddress !== '0x0000000000000000000000000000000000000000' && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Contract Address</label>
                      <div className="flex items-center gap-2 mt-1 p-2 bg-muted/20 rounded border">
                        <code className="text-xs font-mono flex-1">
                          {token.tokenAddress}
                        </code>
                        <button
                          onClick={() => handleCopyToClipboard(token.tokenAddress)}
                          className="p-1 hover:bg-muted/20 rounded"
                        >
                          {copiedAddress ? (
                            <Check className="h-3 w-3 text-success" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                        <button
                          onClick={() => openExplorer(token.tokenAddress)}
                          className="p-1 hover:bg-muted/20 rounded"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Token Type</label>
                    <div className="mt-1">
                      <span className="text-sm bg-muted/30 px-2 py-1 rounded">
                        {getTokenTypeDisplay(token)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Holdings Summary */}
              <div className="bg-muted/10 border border-border/30 rounded-lg p-4">
                <h4 className="text-lg font-semibold mb-4">Holdings Summary</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted/20 rounded">
                    <span className="text-sm font-medium">Total Balance</span>
                    <span className="text-sm font-bold">{formatBalance(token.balanceFormatted)} {token.tokenSymbol}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted/20 rounded">
                    <span className="text-sm font-medium">USD Value</span>
                    <span className="text-sm font-bold text-success">{formatCurrency(token.valueUSD)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted/20 rounded">
                    <span className="text-sm font-medium">Portfolio Weight</span>
                    <span className="text-sm font-bold text-primary">{allocation.toFixed(2)}%</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted/20 rounded">
                    <span className="text-sm font-medium">Average Price</span>
                    <span className="text-sm font-bold">
                      {token.balanceFormatted > 0 ? 
                        formatCurrency(token.valueUSD / token.balanceFormatted) : 
                        'N/A'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-4 pt-4 border-t border-border/30">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-muted/20 hover:bg-muted/30 rounded-lg transition-colors"
              >
                Close
              </button>
              
              {chainConfig?.explorer && token.tokenAddress && token.tokenAddress !== '0x0000000000000000000000000000000000000000' && (
                <button
                  onClick={() => openExplorer(token.tokenAddress)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  View on Explorer
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )

  return createPortal(modalContent, document.body)
} 