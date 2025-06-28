'use client'

import { useState, useEffect } from 'react'
import { coreApi } from '@/lib/api-client'
import { toast } from 'react-hot-toast'

interface TokenHolding {
  tokenSymbol: string
  tokenName: string
  tokenAddress: string
  chainId: number
  balance: string
  balanceFormatted: string
  valueUSD: number
  priceUSD: number
  logoUrl?: string
  isSpam: boolean
}

export function TokenHoldings() {
  const [holdings, setHoldings] = useState<TokenHolding[]>([])
  const [totalValue, setTotalValue] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchHoldings() {
      try {
        setIsLoading(true)
        const response = await coreApi.getPortfolio({ 
          includeSpam: false, 
          minValueUSD: 1 
        })
        
        if (response.success && response.data.portfolio) {
          const portfolioHoldings = response.data.portfolio.holdings || []
          setHoldings(portfolioHoldings)
          setTotalValue(response.data.portfolio.totalValueUSD || 0)
        } else {
          throw new Error('Failed to fetch holdings')
        }
      } catch (error) {
        console.error('Token holdings fetch error:', error)
        toast.error('Failed to load token holdings')
        setHoldings([])
        setTotalValue(0)
      } finally {
        setIsLoading(false)
      }
    }

    fetchHoldings()
  }, [])

  if (isLoading) {
    return (
      <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold">Token Holdings</h3>
            <p className="text-sm text-muted-foreground">
              Your current token positions
            </p>
          </div>
          <div className="text-right animate-pulse">
            <div className="h-6 bg-muted/40 rounded w-24 mb-1"></div>
            <div className="h-4 bg-muted/40 rounded w-16"></div>
          </div>
        </div>
        
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-muted/20 border border-border/50 rounded-lg animate-pulse">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-muted/40 rounded-full"></div>
                <div>
                  <div className="h-4 bg-muted/40 rounded w-16 mb-1"></div>
                  <div className="h-3 bg-muted/40 rounded w-24"></div>
                </div>
              </div>
              <div className="text-right">
                <div className="h-4 bg-muted/40 rounded w-20 mb-1"></div>
                <div className="h-3 bg-muted/40 rounded w-16"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold">Token Holdings</h3>
          <p className="text-sm text-muted-foreground">
            Your current token positions
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">${totalValue.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Total Value</div>
        </div>
      </div>

      {holdings.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">💰</div>
          <div className="text-muted-foreground">No tokens found</div>
          <div className="text-sm text-muted-foreground mt-1">
            Your token holdings will appear here
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {holdings.map((holding, index) => {
              const allocation = totalValue > 0 ? (holding.valueUSD / totalValue) * 100 : 0
              
              return (
                <div key={`${holding.tokenAddress}-${holding.chainId}`} className="flex items-center justify-between p-3 bg-muted/20 border border-border/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                      {holding.logoUrl ? (
                        <img 
                          src={holding.logoUrl} 
                          alt={holding.tokenSymbol} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            target.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center ${holding.logoUrl ? 'hidden' : ''}`}>
                        {holding.tokenSymbol.slice(0, 2)}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">{holding.tokenSymbol}</div>
                      <div className="text-sm text-muted-foreground">{holding.tokenName}</div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-medium">{holding.balanceFormatted} {holding.tokenSymbol}</div>
                    <div className="text-sm text-muted-foreground">
                      ${holding.valueUSD.toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-medium text-blue-600">
                      ${holding.priceUSD.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {allocation.toFixed(1)}% allocation
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-border/50">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Tokens: </span>
                <span className="font-medium">{holdings.length}</span>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground">Total Value: </span>
                <span className="font-medium">${totalValue.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
} 